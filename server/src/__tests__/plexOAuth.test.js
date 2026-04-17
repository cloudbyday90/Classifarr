/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

'use strict';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  }))
}));

const axios = require('axios');
const svc = require('../services/plexOAuth');

beforeEach(() => {
  axios.get.mockReset();
  axios.post.mockReset();
  jest.restoreAllMocks();
  // Reset clientIdentifier so tests get a fresh one
  svc.clientIdentifier = null;
});

// ---------------------------------------------------------------------------
// getClientIdentifier
// ---------------------------------------------------------------------------

describe('getClientIdentifier', () => {
  test('returns a non-empty string', () => {
    expect(typeof svc.getClientIdentifier()).toBe('string');
    expect(svc.getClientIdentifier().length).toBeGreaterThan(0);
  });

  test('returns the same value on repeated calls (stable within session)', () => {
    const id1 = svc.getClientIdentifier();
    const id2 = svc.getClientIdentifier();
    expect(id1).toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// setClientIdentifier
// ---------------------------------------------------------------------------

describe('setClientIdentifier', () => {
  test('overrides the generated identifier', () => {
    svc.setClientIdentifier('my-fixed-id');
    expect(svc.getClientIdentifier()).toBe('my-fixed-id');
  });
});

// ---------------------------------------------------------------------------
// createPin
// ---------------------------------------------------------------------------

describe('createPin', () => {
  test('returns id, code, clientId, and authUrl on success', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 123, code: 'ABCD' } });
    const result = await svc.createPin();
    expect(result.id).toBe(123);
    expect(result.code).toBe('ABCD');
    expect(result.clientId).toBe(svc.getClientIdentifier());
    expect(result.authUrl).toContain('app.plex.tv');
    expect(result.authUrl).toContain('ABCD');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/pins'),
      { strong: true },
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Product': 'Classifarr' })
      })
    );
  });

  test('throws wrapped error on failure', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network error'));
    await expect(svc.createPin()).rejects.toThrow('Failed to create Plex PIN');
  });
});

// ---------------------------------------------------------------------------
// checkPin
// ---------------------------------------------------------------------------

describe('checkPin', () => {
  test('returns authenticated=true with token when approved', async () => {
    axios.get.mockResolvedValueOnce({ data: { authToken: 'plex-tok-123' } });
    const result = await svc.checkPin(456);
    expect(result.authenticated).toBe(true);
    expect(result.authToken).toBe('plex-tok-123');
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/pins/456'),
      expect.any(Object)
    );
  });

  test('returns authenticated=false when not yet approved (null authToken)', async () => {
    axios.get.mockResolvedValueOnce({ data: { authToken: null } });
    const result = await svc.checkPin(456);
    expect(result.authenticated).toBe(false);
    expect(result.authToken).toBeNull();
  });

  test('throws wrapped error on failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('timeout'));
    await expect(svc.checkPin(456)).rejects.toThrow('Failed to check Plex PIN');
  });
});

// ---------------------------------------------------------------------------
// getUser
// ---------------------------------------------------------------------------

describe('getUser', () => {
  test('returns user fields on success', async () => {
    axios.get.mockResolvedValueOnce({
      data: { id: 1, uuid: 'uuid1', username: 'plexuser', email: 'plex@test.com', thumb: 'thumb.jpg', title: 'Plex User' }
    });
    const result = await svc.getUser('tok123');
    expect(result.username).toBe('plexuser');
    expect(result.email).toBe('plex@test.com');
    const headers = axios.get.mock.calls[0][1].headers;
    expect(headers['X-Plex-Token']).toBe('tok123');
  });

  test('throws wrapped error on failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('401'));
    await expect(svc.getUser('bad-tok')).rejects.toThrow('Failed to get Plex user');
  });
});

// ---------------------------------------------------------------------------
// getServers
// ---------------------------------------------------------------------------

describe('getServers', () => {
  const serverResource = {
    provides: 'server',
    name: 'My Plex',
    clientIdentifier: 'srv-client-id',
    owned: true,
    accessToken: 'srv-tok',
    connections: [
      { uri: 'http://192.168.1.1:32400', protocol: 'http', address: '192.168.1.1', port: 32400, local: true, relay: false },
      { uri: 'https://plex.example.com:32400', protocol: 'https', address: 'plex.example.com', port: 32400, local: false, relay: false }
    ]
  };

  test('returns filtered servers with connections', async () => {
    axios.get.mockResolvedValueOnce({
      data: [
        serverResource,
        { provides: 'player', name: 'Player', clientIdentifier: 'p1', owned: false, accessToken: '', connections: [] }
      ]
    });
    const result = await svc.getServers('tok');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My Plex');
    expect(result[0].connections).toHaveLength(2);
    expect(result[0].preferredConnection).not.toBeNull();
  });

  test('throws wrapped error on failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('fail'));
    await expect(svc.getServers('tok')).rejects.toThrow('Failed to get Plex servers');
  });
});

// ---------------------------------------------------------------------------
// getPreferredConnection
// ---------------------------------------------------------------------------

describe('getPreferredConnection', () => {
  test('returns null for empty connections', () => {
    expect(svc.getPreferredConnection([])).toBeNull();
    expect(svc.getPreferredConnection(null)).toBeNull();
  });

  test('prefers local non-relay over remote', () => {
    const conns = [
      { relay: false, local: false, protocol: 'https', uri: 'https://remote' },
      { relay: false, local: true, protocol: 'http', uri: 'http://local' }
    ];
    expect(svc.getPreferredConnection(conns).uri).toBe('http://local');
  });

  test('prefers non-relay over relay', () => {
    const conns = [
      { relay: true, local: false, protocol: 'https', uri: 'https://relay' },
      { relay: false, local: false, protocol: 'http', uri: 'http://direct' }
    ];
    expect(svc.getPreferredConnection(conns).uri).toBe('http://direct');
  });

  test('prefers https over http when local/relay match', () => {
    const conns = [
      { relay: false, local: false, protocol: 'http', uri: 'http://remote' },
      { relay: false, local: false, protocol: 'https', uri: 'https://remote' }
    ];
    expect(svc.getPreferredConnection(conns).uri).toBe('https://remote');
  });
});

// ---------------------------------------------------------------------------
// testServerConnection
// ---------------------------------------------------------------------------

describe('testServerConnection', () => {
  test('returns success with server info', async () => {
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { friendlyName: 'Plex', version: '1.2.3', machineIdentifier: 'machine-id' } }
    });
    const result = await svc.testServerConnection('http://plex:32400', 'srv-tok');
    expect(result.success).toBe(true);
    expect(result.serverName).toBe('Plex');
    expect(result.version).toBe('1.2.3');
    const headers = axios.get.mock.calls[0][1].headers;
    expect(headers['X-Plex-Token']).toBe('srv-tok');
  });

  test('returns failure on error', async () => {
    axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await svc.testServerConnection('http://bad:32400', 'tok');
    expect(result.success).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });
});
