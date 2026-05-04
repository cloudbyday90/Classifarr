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

import { jest } from '@jest/globals';

const mockAxios = { get: jest.fn(), post: jest.fn() };
jest.mock('axios', () => mockAxios);
jest.unstable_mockModule('axios', () => ({
    ...mockAxios,
    default: mockAxios,
}));

const mockLogger = {
    createLogger: jest.fn(() => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
    }))
};
jest.mock('../utils/logger', () => mockLogger);
jest.unstable_mockModule('../utils/logger', () => ({
    ...mockLogger,
    default: mockLogger,
}));

const { default: axios } = await import('axios');
const { default: svc } = await import('../services/jellyfinAuth.mjs');

const SERVER = 'http://jellyfin.local:8096';

beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
    jest.restoreAllMocks();
});

describe('testConnection', () => {
    test('returns success with server info', async () => {
        axios.get.mockResolvedValueOnce({
            data: { ServerName: 'My Jellyfin', Version: '10.9.0', Id: 'srv-id', StartupWizardCompleted: true }
        });
        const result = await svc.testConnection(SERVER);
        expect(result.success).toBe(true);
        expect(result.serverName).toBe('My Jellyfin');
        expect(result.version).toBe('10.9.0');
        expect(result.startupWizardCompleted).toBe(true);
        expect(axios.get).toHaveBeenCalledWith(
            `${SERVER}/System/Info/Public`,
            expect.any(Object)
        );
    });

    test('strips trailing slash from serverUrl', async () => {
        axios.get.mockResolvedValueOnce({ data: {} });
        await svc.testConnection(`${SERVER}/`);
        expect(axios.get.mock.calls[0][0]).toBe(`${SERVER}/System/Info/Public`);
    });

    test('returns failure on network error', async () => {
        axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const result = await svc.testConnection(SERVER);
        expect(result.success).toBe(false);
        expect(result.error).toBe('ECONNREFUSED');
    });
});

describe('isQuickConnectEnabled', () => {
    test('returns true when server responds with true', async () => {
        axios.get.mockResolvedValueOnce({ data: true });
        expect(await svc.isQuickConnectEnabled(SERVER)).toBe(true);
    });

    test('returns false when server responds with false', async () => {
        axios.get.mockResolvedValueOnce({ data: false });
        expect(await svc.isQuickConnectEnabled(SERVER)).toBe(false);
    });

    test('returns false on error', async () => {
        axios.get.mockRejectedValueOnce(new Error('Not found'));
        expect(await svc.isQuickConnectEnabled(SERVER)).toBe(false);
    });
});

describe('initiateQuickConnect', () => {
    test('returns code and secret on success', async () => {
        axios.post.mockResolvedValueOnce({
            data: { Code: '123456', Secret: 'abc-secret' }
        });
        const result = await svc.initiateQuickConnect(SERVER);
        expect(result.success).toBe(true);
        expect(result.code).toBe('123456');
        expect(result.secret).toBe('abc-secret');
        expect(axios.post).toHaveBeenCalledWith(
            `${SERVER}/QuickConnect/Initiate`,
            null,
            expect.any(Object)
        );
    });

    test('returns failure on error', async () => {
        const err = new Error('Disabled');
        err.response = { data: { Message: 'Quick Connect is disabled' } };
        axios.post.mockRejectedValueOnce(err);
        const result = await svc.initiateQuickConnect(SERVER);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Quick Connect is disabled');
    });
});

describe('checkQuickConnect', () => {
    test('returns authenticated=true when approved', async () => {
        axios.get.mockResolvedValueOnce({ data: { Authenticated: true, Secret: 'abc-secret' } });
        const result = await svc.checkQuickConnect(SERVER, 'abc-secret');
        expect(result.authenticated).toBe(true);
        expect(axios.get).toHaveBeenCalledWith(
            `${SERVER}/QuickConnect/Connect`,
            expect.objectContaining({ params: { secret: 'abc-secret' } })
        );
    });

    test('returns authenticated=false when not yet approved', async () => {
        axios.get.mockResolvedValueOnce({ data: { Authenticated: false, Secret: 'abc-secret' } });
        const result = await svc.checkQuickConnect(SERVER, 'abc-secret');
        expect(result.authenticated).toBe(false);
    });

    test('returns authenticated=false on error', async () => {
        axios.get.mockRejectedValueOnce(new Error('expired'));
        const result = await svc.checkQuickConnect(SERVER, 'stale-secret');
        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('expired');
    });
});

describe('authenticateWithQuickConnect', () => {
    test('returns token and user info on success', async () => {
        axios.post.mockResolvedValueOnce({
            data: {
                AccessToken: 'qt-tok',
                ServerId: 'srv1',
                User: { Id: 'u1', Name: 'admin' }
            }
        });
        const result = await svc.authenticateWithQuickConnect(SERVER, 'abc-secret');
        expect(result.success).toBe(true);
        expect(result.accessToken).toBe('qt-tok');
        expect(result.userId).toBe('u1');
        expect(result.username).toBe('admin');
        expect(axios.post).toHaveBeenCalledWith(
            `${SERVER}/Users/AuthenticateWithQuickConnect`,
            { Secret: 'abc-secret' },
            expect.any(Object)
        );
    });

    test('returns failure on error', async () => {
        const err = new Error('error');
        err.response = { data: { Message: 'Secret expired' } };
        axios.post.mockRejectedValueOnce(err);
        const result = await svc.authenticateWithQuickConnect(SERVER, 'bad');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Secret expired');
    });
});

describe('authenticateWithPassword', () => {
    test('returns success with token and user info', async () => {
        axios.post.mockResolvedValueOnce({
            data: {
                AccessToken: 'pw-tok',
                ServerId: 'srv1',
                User: { Id: 'u1', Name: 'admin', Policy: { IsAdministrator: true } }
            }
        });
        const result = await svc.authenticateWithPassword(SERVER, 'admin', 'secret');
        expect(result.success).toBe(true);
        expect(result.accessToken).toBe('pw-tok');
        expect(result.isAdmin).toBe(true);
        expect(axios.post).toHaveBeenCalledWith(
            `${SERVER}/Users/AuthenticateByName`,
            { Username: 'admin', Pw: 'secret' },
            expect.any(Object)
        );
    });

    test('returns failure on error', async () => {
        axios.post.mockRejectedValueOnce(new Error('401'));
        const result = await svc.authenticateWithPassword(SERVER, 'bad', 'pass');
        expect(result.success).toBe(false);
    });
});

describe('getServerInfo', () => {
    test('returns server info with authenticated headers', async () => {
        axios.get.mockResolvedValueOnce({
            data: { ServerName: 'JF', Version: '10.9.0', Id: 'id1', OperatingSystem: 'Linux' }
        });
        const result = await svc.getServerInfo(SERVER, 'my-token');
        expect(result.success).toBe(true);
        expect(result.operatingSystem).toBe('Linux');
        const headers = axios.get.mock.calls[0][1].headers;
        expect(headers['X-Emby-Authorization']).toContain('my-token');
    });

    test('returns failure on error', async () => {
        axios.get.mockRejectedValueOnce(new Error('403'));
        const result = await svc.getServerInfo(SERVER, 'tok');
        expect(result.success).toBe(false);
    });
});

describe('verifyToken', () => {
    test('returns {valid: true} when request succeeds', async () => {
        axios.get.mockResolvedValueOnce({ data: {} });
        expect((await svc.verifyToken(SERVER, 'tok')).valid).toBe(true);
    });

    test('returns {valid: false} on error', async () => {
        axios.get.mockRejectedValueOnce(new Error('401'));
        const result = await svc.verifyToken(SERVER, 'bad');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('401');
    });
});

describe('X-Emby-Authorization header (Jellyfin)', () => {
    test('uses MediaBrowser prefix with required fields', async () => {
        axios.get.mockResolvedValueOnce({ data: true });
        await svc.isQuickConnectEnabled(SERVER);
        const auth = axios.get.mock.calls[0][1].headers['X-Emby-Authorization'];
        expect(auth).toMatch(/^MediaBrowser /);
        expect(auth).toContain('Client="Classifarr"');
        expect(auth).toContain('Device="Server"');
        expect(auth).toContain('Version="1.0.0"');
        expect(auth).toContain('DeviceId="');
    });
});
