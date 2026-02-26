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

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const authService = require('../services/auth');
const { createConsoleSpy } = require('./setup/consoleHelpers');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('Auth Service - token and persistence flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.JWT_SECRET;
  });

  test('hashPassword delegates to bcrypt with configured salt rounds', async () => {
    const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashed-value');

    await expect(authService.hashPassword('Password123!')).resolves.toBe('hashed-value');
    expect(hashSpy).toHaveBeenCalledWith('Password123!', 12);
  });

  test('verifyPassword delegates to bcrypt.compare', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

    await expect(authService.verifyPassword('Password123!', 'stored-hash')).resolves.toBe(true);
    expect(compareSpy).toHaveBeenCalledWith('Password123!', 'stored-hash');
  });

  test('getJWTSecret returns active DB secret when available', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ secret: 'db-secret' }] });

    await expect(authService.getJWTSecret()).resolves.toBe('db-secret');
    expect(db.query).toHaveBeenCalledWith(
      'SELECT secret FROM jwt_secrets WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );
  });

  test('getJWTSecret creates and stores a new secret when none exists', async () => {
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('a'.repeat(64)));
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const secret = await authService.getJWTSecret();

    expect(secret).toBe(Buffer.from('a'.repeat(64)).toString('hex'));
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO jwt_secrets (secret, is_active) VALUES ($1, true)',
      [secret]
    );
    expect(randomBytesSpy).toHaveBeenCalledWith(64);
  });

  test('getJWTSecret falls back to JWT_SECRET env var on DB failure', async () => {
    const errorSpy = createConsoleSpy('error', { suppress: true });
    process.env.JWT_SECRET = 'env-fallback-secret';
    db.query.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(authService.getJWTSecret()).resolves.toBe('env-fallback-secret');
    expect(errorSpy.spy).toHaveBeenCalled();
  });

  test('getJWTSecret generates random fallback when DB fails and env var is missing', async () => {
    const errorSpy = createConsoleSpy('error', { suppress: true });
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('b'.repeat(64)));
    db.query.mockRejectedValueOnce(new Error('database unavailable'));

    const secret = await authService.getJWTSecret();

    expect(secret).toBe(Buffer.from('b'.repeat(64)).toString('hex'));
    expect(randomBytesSpy).toHaveBeenCalledWith(64);
    expect(errorSpy.spy).toHaveBeenCalled();
  });

  test('generateAccessToken signs expected payload and metadata', async () => {
    const signSpy = jest.spyOn(jwt, 'sign').mockReturnValue('access-token');
    db.query.mockResolvedValueOnce({ rows: [{ secret: 'jwt-secret' }] });

    const token = await authService.generateAccessToken({
      id: 7,
      username: 'admin',
      role: 'admin',
    });

    expect(token).toBe('access-token');
    expect(signSpy).toHaveBeenCalledWith(
      { id: 7, username: 'admin', role: 'admin', type: 'access' },
      'jwt-secret',
      { expiresIn: authService.ACCESS_TOKEN_EXPIRY, issuer: 'classifarr' }
    );
  });

  test('generateRefreshToken stores hashed token, user-agent and device metadata', async () => {
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('c'.repeat(48)));
    db.query.mockResolvedValueOnce({ rows: [] });

    const token = await authService.generateRefreshToken(42, 'UnitTestAgent', { platform: 'linux' });
    const dbArgs = db.query.mock.calls[0][1];

    expect(token).toBe(Buffer.from('c'.repeat(48)).toString('base64url'));
    expect(dbArgs[0]).toBe(42);
    expect(dbArgs[1]).toBe(sha256(token));
    expect(dbArgs[2]).toBeInstanceOf(Date);
    expect(dbArgs[3]).toBe('UnitTestAgent');
    expect(dbArgs[4]).toBe(JSON.stringify({ platform: 'linux' }));

    const min = Date.now() + 6 * 24 * 60 * 60 * 1000;
    const max = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(dbArgs[2].getTime()).toBeGreaterThan(min);
    expect(dbArgs[2].getTime()).toBeLessThan(max);
    expect(randomBytesSpy).toHaveBeenCalledWith(48);
  });

  test('generateRefreshToken stores null device_info when omitted', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await authService.generateRefreshToken(11, 'AgentOnly');

    expect(db.query.mock.calls[0][1][4]).toBeNull();
  });

  test('validateRefreshToken queries by hash only when userId is absent', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 99 }] });

    const result = await authService.validateRefreshToken('token-value');
    const [query, params] = db.query.mock.calls[0];

    expect(query).not.toContain('AND user_id = $2');
    expect(params).toEqual([sha256('token-value')]);
    expect(result).toEqual({ id: 1, user_id: 99 });
  });

  test('validateRefreshToken adds userId filter when provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 42 }] });

    await authService.validateRefreshToken('token-value', 42);
    const [query, params] = db.query.mock.calls[0];

    expect(query).toContain('AND user_id = $2');
    expect(params).toEqual([sha256('token-value'), 42]);
  });

  test('validateRefreshToken returns null when token is not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(authService.validateRefreshToken('missing')).resolves.toBeNull();
  });

  test('revokeRefreshToken returns true when a token is revoked', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1 });
    await expect(authService.revokeRefreshToken('token', '127.0.0.1')).resolves.toBe(true);
  });

  test('revokeRefreshToken returns false when no token is revoked', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(authService.revokeRefreshToken('token')).resolves.toBe(false);
  });

  test('revokeAllUserTokens returns number of revoked tokens and supports exception hash', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 3 });
    await expect(authService.revokeAllUserTokens(5, 'keep-this-hash')).resolves.toBe(3);
    expect(db.query.mock.calls[0][0]).toContain('AND token_hash != $2');
    expect(db.query.mock.calls[0][1]).toEqual([5, 'keep-this-hash']);
  });

  test('cleanupExpiredTokens returns number of deleted rows', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 4 });
    await expect(authService.cleanupExpiredTokens()).resolves.toBe(4);
  });

  test('verifyToken returns decoded payload when jwt.verify succeeds', async () => {
    const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1, type: 'access' });
    db.query.mockResolvedValueOnce({ rows: [{ secret: 'jwt-secret' }] });

    await expect(authService.verifyToken('token-value')).resolves.toEqual({ id: 1, type: 'access' });
    expect(verifySpy).toHaveBeenCalledWith('token-value', 'jwt-secret');
  });

  test('verifyToken throws normalized error when jwt.verify fails', async () => {
    const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    db.query.mockResolvedValueOnce({ rows: [{ secret: 'jwt-secret' }] });

    await expect(authService.verifyToken('bad-token')).rejects.toThrow('Invalid or expired token');
    expect(verifySpy).toHaveBeenCalled();
  });

  test('auditLog writes JSON metadata', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await authService.auditLog(1, 'login', '127.0.0.1', 'agent', { source: 'unit' });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      [1, 'login', '127.0.0.1', 'agent', JSON.stringify({ source: 'unit' })]
    );
  });

  test('auditLog swallows DB write errors', async () => {
    const errorSpy = createConsoleSpy('error', { suppress: true });
    db.query.mockRejectedValueOnce(new Error('insert failure'));

    await expect(
      authService.auditLog(1, 'login', '127.0.0.1', 'agent', { source: 'unit' })
    ).resolves.toBeUndefined();
    expect(errorSpy.spy).toHaveBeenCalled();
  });

  test('authenticate throws when user is not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(authService.authenticate('missing', 'password')).rejects.toThrow('Invalid credentials');
  });

  test('authenticate throws when password does not match', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'user', password_hash: 'stored-hash', is_active: true }],
    });

    await expect(authService.authenticate('user', 'bad-password')).rejects.toThrow('Invalid credentials');
    expect(compareSpy).toHaveBeenCalledWith('bad-password', 'stored-hash');
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('authenticate updates last_login and strips password hash on success', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'admin', role: 'admin', password_hash: 'stored-hash', is_active: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const user = await authService.authenticate('admin', 'Password123!');

    expect(compareSpy).toHaveBeenCalledWith('Password123!', 'stored-hash');
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [2]
    );
    expect(user).toEqual(expect.objectContaining({ id: 2, username: 'admin', role: 'admin', is_active: true }));
    expect(user.password_hash).toBeUndefined();
  });

  test('getCookieOptions returns secure and default variants', () => {
    expect(authService.getCookieOptions()).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    expect(authService.getCookieOptions(true)).toEqual(
      expect.objectContaining({
        secure: true,
      })
    );
  });
});
