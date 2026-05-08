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

const mockHttpGet = jest.fn();
const mockHttpPost = jest.fn();
const mockHttpPut = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  httpGet: mockHttpGet,
  httpPost: mockHttpPost,
  httpPut: mockHttpPut,
  httpDelete: jest.fn(),
  httpGetBinary: jest.fn(),
  httpStream: jest.fn(),
  createHttpClient: jest.fn(),
  defaultHttpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));const mockLogger = {
    createLogger: jest.fn(() => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
    }))
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({
    ...mockLogger,
    default: mockLogger,
}));

const { embyAuthService: svc } = await import('../services/embyAuth.mjs');

const SERVER = 'http://emby.local:8096';

beforeEach(() => {
    mockHttpGet.mockReset();
    mockHttpPost.mockReset();
    jest.restoreAllMocks();
});

describe('testConnection', () => {
    test('returns success with server info', async () => {
        mockHttpGet.mockResolvedValueOnce({
            data: { ServerName: 'My Emby', Version: '4.8.0', Id: 'server-uuid' }
        });
        const result = await svc.testConnection(SERVER);
        expect(result.success).toBe(true);
        expect(result.serverName).toBe('My Emby');
        expect(result.version).toBe('4.8.0');
        expect(result.id).toBe('server-uuid');
        expect(mockHttpGet).toHaveBeenCalledWith(
            `${SERVER}/System/Info/Public`,
            expect.any(Object)
        );
    });

    test('strips trailing slash from serverUrl', async () => {
        mockHttpGet.mockResolvedValueOnce({ data: {} });
        await svc.testConnection(`${SERVER}/`);
        expect(mockHttpGet.mock.calls[0][0]).toBe(`${SERVER}/System/Info/Public`);
    });

    test('returns failure on network error', async () => {
        mockHttpGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const result = await svc.testConnection(SERVER);
        expect(result.success).toBe(false);
        expect(result.error).toBe('ECONNREFUSED');
    });
});

describe('authenticateWithPassword', () => {
    test('returns success with token and user info', async () => {
        mockHttpPost.mockResolvedValueOnce({
            data: {
                AccessToken: 'tok123',
                ServerId: 'srv1',
                User: { Id: 'usr1', Name: 'admin', Policy: { IsAdministrator: true } }
            }
        });
        const result = await svc.authenticateWithPassword(SERVER, 'admin', 'password');
        expect(result.success).toBe(true);
        expect(result.accessToken).toBe('tok123');
        expect(result.userId).toBe('usr1');
        expect(result.username).toBe('admin');
        expect(result.isAdmin).toBe(true);
        expect(mockHttpPost).toHaveBeenCalledWith(
            `${SERVER}/Users/AuthenticateByName`,
            { Username: 'admin', Pw: 'password' },
            expect.objectContaining({ headers: expect.objectContaining({ 'X-Emby-Authorization': expect.any(String) }) })
        );
    });

    test('defaults password to empty string', async () => {
        mockHttpPost.mockResolvedValueOnce({ data: { AccessToken: 't', ServerId: 's', User: { Id: 'u', Name: 'n' } } });
        await svc.authenticateWithPassword(SERVER, 'user');
        expect(mockHttpPost.mock.calls[0][1]).toEqual({ Username: 'user', Pw: '' });
    });

    test('returns "Invalid username or password" on 401', async () => {
        const err = new Error('Unauthorized');
        err.response = { status: 401 };
        mockHttpPost.mockRejectedValueOnce(err);
        const result = await svc.authenticateWithPassword(SERVER, 'bad', 'wrong');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid username or password');
    });

    test('returns server error message from response body', async () => {
        const err = new Error('Error');
        err.response = { status: 403, data: { Message: 'Account locked' } };
        mockHttpPost.mockRejectedValueOnce(err);
        const result = await svc.authenticateWithPassword(SERVER, 'user', 'pass');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Account locked');
    });

    test('returns generic error message on network failure', async () => {
        mockHttpPost.mockRejectedValueOnce(new Error('ETIMEDOUT'));
        const result = await svc.authenticateWithPassword(SERVER, 'user', 'pass');
        expect(result.success).toBe(false);
        expect(result.error).toBe('ETIMEDOUT');
    });
});

describe('getServerInfo', () => {
    test('returns server info on success', async () => {
        mockHttpGet.mockResolvedValueOnce({
            data: { ServerName: 'Emby', Version: '4.8.0', Id: 'id1', OperatingSystem: 'Linux' }
        });
        const result = await svc.getServerInfo(SERVER, 'my-token');
        expect(result.success).toBe(true);
        expect(result.operatingSystem).toBe('Linux');
        const headers = mockHttpGet.mock.calls[0][1].headers;
        expect(headers['X-Emby-Authorization']).toContain('my-token');
    });

    test('returns failure on error', async () => {
        mockHttpGet.mockRejectedValueOnce(new Error('timeout'));
        const result = await svc.getServerInfo(SERVER, 'tok');
        expect(result.success).toBe(false);
        expect(result.error).toBe('timeout');
    });
});

describe('verifyToken', () => {
    test('returns {valid: true} when request succeeds', async () => {
        mockHttpGet.mockResolvedValueOnce({ data: {} });
        const result = await svc.verifyToken(SERVER, 'tok');
        expect(result.valid).toBe(true);
    });

    test('returns {valid: false} with error message on failure', async () => {
        mockHttpGet.mockRejectedValueOnce(new Error('401 Unauthorized'));
        const result = await svc.verifyToken(SERVER, 'expired');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('401 Unauthorized');
    });
});

describe('getUsers', () => {
    test('maps user list to id/name/isAdmin shape', async () => {
        mockHttpGet.mockResolvedValueOnce({
            data: [
                { Id: 'u1', Name: 'admin', Policy: { IsAdministrator: true } },
                { Id: 'u2', Name: 'guest', Policy: { IsAdministrator: false } }
            ]
        });
        const result = await svc.getUsers(SERVER, 'admin-token');
        expect(result.success).toBe(true);
        expect(result.users).toHaveLength(2);
        expect(result.users[0]).toEqual({ id: 'u1', name: 'admin', isAdmin: true });
        expect(result.users[1]).toEqual({ id: 'u2', name: 'guest', isAdmin: false });
    });

    test('returns failure on error', async () => {
        mockHttpGet.mockRejectedValueOnce(new Error('Forbidden'));
        const result = await svc.getUsers(SERVER, 'bad-token');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Forbidden');
    });
});

describe('X-Emby-Authorization header', () => {
    test('contains required Emby authorization fields', async () => {
        mockHttpPost.mockResolvedValueOnce({ data: { AccessToken: 'tok', ServerId: 's', User: { Id: 'u', Name: 'n' } } });
        await svc.authenticateWithPassword(SERVER, 'user', 'pass');
        const auth = mockHttpPost.mock.calls[0][2].headers['X-Emby-Authorization'];
        expect(auth).toContain('Client="Classifarr"');
        expect(auth).toContain('Device="Server"');
        expect(auth).toContain('Version="1.0.0"');
        expect(auth).toContain('DeviceId="');
    });

    test('includes Token field when token is provided', async () => {
        mockHttpGet.mockResolvedValueOnce({ data: {} });
        await svc.verifyToken(SERVER, 'my-secret-token');
        const auth = mockHttpGet.mock.calls[0][1].headers['X-Emby-Authorization'];
        expect(auth).toContain('Token="my-secret-token"');
    });
});
