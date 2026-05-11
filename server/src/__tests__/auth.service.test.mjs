import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { createDbRowsResult, createDbSingleRowResult, createDbWriteResult, createNamedMockModule } from './helpers/mockFactory.mjs';

const db = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));

const {
  ACCESS_TOKEN_EXPIRY,
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_LOGINS,
  REMEMBER_ME_EXPIRY_DAYS,
  SESSION_EXPIRY_HOURS,
  auditLog,
  authenticate,
  cleanupExpiredTokens,
  generateAccessToken,
  generateRefreshToken,
  getCookieOptions,
  getJWTSecret,
  getNonPersistentAccessInvalidBeforeMs,
  getRefreshTokenCookieOptions,
  hashPassword,
  hashToken,
  revokeAllRefreshTokensOnStartup,
  revokeAllUserTokens,
  revokeRefreshToken,
  validateRefreshToken,
  verifyPassword,
  verifyToken,
} = await import('../services/auth.mjs');
const { createConsoleSpy } = await import('./setup/consoleHelpers.mjs');

const authService = {
  ACCESS_TOKEN_EXPIRY,
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_LOGINS,
  REMEMBER_ME_EXPIRY_DAYS,
  SESSION_EXPIRY_HOURS,
  auditLog,
  authenticate,
  cleanupExpiredTokens,
  generateAccessToken,
  generateRefreshToken,
  getCookieOptions,
  getJWTSecret,
  getNonPersistentAccessInvalidBeforeMs,
  getRefreshTokenCookieOptions,
  hashPassword,
  hashToken,
  revokeAllRefreshTokensOnStartup,
  revokeAllUserTokens,
  revokeRefreshToken,
  validateRefreshToken,
  verifyPassword,
  verifyToken,
};

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
    db.query.mockResolvedValueOnce(createDbSingleRowResult({ secret: 'db-secret' }));

    await expect(authService.getJWTSecret()).resolves.toBe('db-secret');
    expect(db.query).toHaveBeenCalledWith(
      'SELECT secret FROM jwt_secrets WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );
  });

  test('getJWTSecret creates and stores a new secret when none exists', async () => {
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('a'.repeat(64)));
    db.query
      .mockResolvedValueOnce(createDbRowsResult())
      .mockResolvedValueOnce(createDbRowsResult());

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

  test('hashToken returns the SHA-256 hex digest of the input string', async () => {
    const result = await authService.hashToken('some-token-string');
    expect(result).toBe(sha256('some-token-string'));
  });

  test('generateAccessToken signs expected payload and metadata', async () => {
    const signSpy = jest.spyOn(jwt, 'sign').mockReturnValue('access-token');
    db.query.mockResolvedValueOnce(createDbSingleRowResult({ secret: 'jwt-secret' }));

    const token = await authService.generateAccessToken({
      id: 7,
      username: 'admin',
      role: 'admin',
    });

    expect(token).toBe('access-token');
    expect(signSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        username: 'admin',
        role: 'admin',
        type: 'access',
        persistent_session: false,
      }),
      'jwt-secret',
      { expiresIn: authService.ACCESS_TOKEN_EXPIRY, issuer: 'classifarr' }
    );
    expect(signSpy.mock.calls[0][0].issued_at_ms).toEqual(expect.any(Number));
  });

  test('generateAccessToken marks remember-me access tokens as persistent', async () => {
    const signSpy = jest.spyOn(jwt, 'sign').mockReturnValue('persistent-access-token');
    db.query.mockResolvedValueOnce(createDbSingleRowResult({ secret: 'jwt-secret' }));

    await authService.generateAccessToken({
      id: 9,
      username: 'remembered',
      role: 'admin',
    }, true);

    expect(signSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ persistent_session: true })
    );
  });

  test('generateRefreshToken stores hashed token, user-agent and device metadata', async () => {
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('c'.repeat(48)));
    db.query.mockResolvedValueOnce(createDbRowsResult());

    const token = await authService.generateRefreshToken(42, 'UnitTestAgent', { platform: 'linux' });
    const dbArgs = db.query.mock.calls[0][1];

    expect(token).toBe(Buffer.from('c'.repeat(48)).toString('base64url'));
    expect(dbArgs[0]).toBe(42);
    expect(dbArgs[1]).toBe(sha256(token));
    expect(dbArgs[2]).toBeInstanceOf(Date);
    expect(dbArgs[3]).toBe('UnitTestAgent');
    expect(JSON.parse(dbArgs[4])).toEqual({ platform: 'linux' });
    expect(dbArgs[5]).toBe(false);

    const min = Date.now() + 47 * 60 * 60 * 1000;
    const max = Date.now() + 49 * 60 * 60 * 1000;
    expect(dbArgs[2].getTime()).toBeGreaterThan(min);
    expect(dbArgs[2].getTime()).toBeLessThan(max);
    expect(randomBytesSpy).toHaveBeenCalledWith(48);
  });

  test('generateRefreshToken uses 30-day expiry and stores remember_me=true when rememberMe is true', async () => {
    jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('d'.repeat(48)));
    db.query.mockResolvedValueOnce(createDbRowsResult());

    await authService.generateRefreshToken(42, 'Agent', { platform: 'linux' }, true);
    const dbArgs = db.query.mock.calls[0][1];

    expect(dbArgs[5]).toBe(true);
    const min = Date.now() + 29 * 24 * 60 * 60 * 1000;
    const max = Date.now() + 31 * 24 * 60 * 60 * 1000;
    expect(dbArgs[2].getTime()).toBeGreaterThan(min);
    expect(dbArgs[2].getTime()).toBeLessThan(max);
  });

  test('generateRefreshToken stores null device_info when omitted', async () => {
    db.query.mockResolvedValueOnce(createDbRowsResult());

    await authService.generateRefreshToken(11, 'AgentOnly');

    expect(db.query.mock.calls[0][1][4]).toBeNull();
  });

  test('generateRefreshToken sliding expiry: extends 30 days from slideFromDate when it is in the future', async () => {
    jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('e'.repeat(48)));
    db.query.mockResolvedValueOnce(createDbRowsResult());

    const slideFromDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    await authService.generateRefreshToken(42, 'Agent', null, true, slideFromDate);
    const expiresAt = db.query.mock.calls[0][1][2];

    const expectedMin = slideFromDate.getTime() + 29 * 24 * 60 * 60 * 1000;
    const expectedMax = slideFromDate.getTime() + 31 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThan(expectedMin);
    expect(expiresAt.getTime()).toBeLessThan(expectedMax);
  });

  test('generateRefreshToken sliding expiry: falls back to now when slideFromDate is in the past', async () => {
    jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('f'.repeat(48)));
    db.query.mockResolvedValueOnce(createDbRowsResult());

    const slideFromDate = new Date(Date.now() - 1000);
    await authService.generateRefreshToken(42, 'Agent', null, true, slideFromDate);
    const expiresAt = db.query.mock.calls[0][1][2];

    const expectedMin = Date.now() + 29 * 24 * 60 * 60 * 1000;
    const expectedMax = Date.now() + 31 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThan(expectedMin);
    expect(expiresAt.getTime()).toBeLessThan(expectedMax);
  });

  test('validateRefreshToken queries by hash only when userId is absent', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60);
    db.query.mockResolvedValueOnce(createDbSingleRowResult({ id: 1, user_id: 99, revoked_at: null, expires_at: future }));

    const result = await authService.validateRefreshToken('token-value');
    const [query, params] = db.query.mock.calls[0];

    expect(query).not.toContain('AND user_id = $2');
    expect(query).not.toContain('revoked_at IS NULL');
    expect(query).not.toContain('expires_at > NOW()');
    expect(params).toEqual([sha256('token-value')]);
    expect(result).toEqual({ id: 1, user_id: 99, revoked_at: null, expires_at: future });
  });

  test('validateRefreshToken adds userId filter when provided', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60);
    db.query.mockResolvedValueOnce(createDbSingleRowResult({ id: 1, user_id: 42, revoked_at: null, expires_at: future }));

    await authService.validateRefreshToken('token-value', 42);
    const [query, params] = db.query.mock.calls[0];

    expect(query).toContain('AND user_id = $2');
    expect(params).toEqual([sha256('token-value'), 42]);
  });

  test('validateRefreshToken returns null when token is not found', async () => {
    db.query.mockResolvedValueOnce(createDbRowsResult());
    await expect(authService.validateRefreshToken('missing')).resolves.toBeNull();
  });

  test('validateRefreshToken returns null when token is found but expired', async () => {
    const past = new Date(Date.now() - 1000);
    db.query.mockResolvedValueOnce(createDbSingleRowResult({ id: 1, user_id: 5, revoked_at: null, expires_at: past }));
    await expect(authService.validateRefreshToken('expired-token')).resolves.toBeNull();
  });

  test('validateRefreshToken returns compromised sentinel when token is revoked', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60);
    db.query.mockResolvedValueOnce(createDbSingleRowResult({ id: 7, user_id: 55, revoked_at: new Date(), expires_at: future }));
    const result = await authService.validateRefreshToken('stolen-token');
    expect(result).toMatchObject({ compromised: true, user_id: 55 });
  });

  test('revokeRefreshToken returns true when a token is revoked', async () => {
    db.query.mockResolvedValueOnce(createDbWriteResult(1));
    await expect(authService.revokeRefreshToken('token', '127.0.0.1')).resolves.toBe(true);
  });

  test('revokeRefreshToken returns false when no token is revoked', async () => {
    db.query.mockResolvedValueOnce(createDbWriteResult(0));
    await expect(authService.revokeRefreshToken('token')).resolves.toBe(false);
  });

  test('revokeAllUserTokens returns number of revoked tokens and supports exception hash', async () => {
    db.query.mockResolvedValueOnce(createDbWriteResult(3));
    await expect(authService.revokeAllUserTokens(5, 'keep-this-hash')).resolves.toBe(3);
    expect(db.query.mock.calls[0][0]).toContain('AND token_hash != $2');
    expect(db.query.mock.calls[0][1]).toEqual([5, 'keep-this-hash']);
  });

  test('revokeAllUserTokens without exceptTokenHash revokes all tokens for user', async () => {
    db.query.mockResolvedValueOnce(createDbWriteResult(5));
    await expect(authService.revokeAllUserTokens(7)).resolves.toBe(5);
    expect(db.query.mock.calls[0][0]).not.toContain('AND token_hash != $2');
    expect(db.query.mock.calls[0][1]).toEqual([7]);
  });

  test('cleanupExpiredTokens returns number of deleted rows', async () => {
    db.query.mockResolvedValueOnce(createDbWriteResult(4));
    await expect(authService.cleanupExpiredTokens()).resolves.toBe(4);
  });

  test('revokeAllRefreshTokensOnStartup revokes only non-remember-me tokens and returns count', async () => {
    db.query.mockResolvedValueOnce(createDbWriteResult(7));
    await expect(authService.revokeAllRefreshTokensOnStartup()).resolves.toBe(7);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('UPDATE refresh_tokens SET revoked_at = NOW()');
    expect(sql).toContain('WHERE revoked_at IS NULL');
    expect(sql).toContain('remember_me = false');
  });

  test('verifyToken returns decoded payload when jwt.verify succeeds', async () => {
    const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1, type: 'access' });
    db.query.mockResolvedValueOnce({ rows: [{ secret: 'jwt-secret' }] });

    await expect(authService.verifyToken('token-value')).resolves.toEqual({ id: 1, type: 'access' });
    expect(verifySpy).toHaveBeenCalledWith('token-value', 'jwt-secret');
  });

  test('verifyToken propagates the original JWT error so callers can inspect error.name', async () => {
    const malformedErr = new Error('jwt malformed');
    malformedErr.name = 'JsonWebTokenError';
    const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation(() => {
      throw malformedErr;
    });
    db.query.mockResolvedValueOnce({ rows: [{ secret: 'jwt-secret' }] });

    await expect(authService.verifyToken('bad-token')).rejects.toHaveProperty('name', 'JsonWebTokenError');
    expect(verifySpy).toHaveBeenCalled();
  });

  test('verifyToken propagates TokenExpiredError so middleware can return 401', async () => {
    const expiredErr = new Error('jwt expired');
    expiredErr.name = 'TokenExpiredError';
    jest.spyOn(jwt, 'verify').mockImplementation(() => { throw expiredErr; });
    db.query.mockResolvedValueOnce({ rows: [{ secret: 'jwt-secret' }] });

    await expect(authService.verifyToken('expired-token')).rejects.toHaveProperty('name', 'TokenExpiredError');
  });

  test('verifyToken rejects non-persistent access tokens issued before startup invalidation', async () => {
    const issuedAtMs = Date.now() - 5000;
    jest.spyOn(jwt, 'verify').mockReturnValue({
      id: 1,
      type: 'access',
      persistent_session: false,
      issued_at_ms: issuedAtMs,
    });
    db.query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ secret: 'jwt-secret' }] });

    await authService.revokeAllRefreshTokensOnStartup();

    await expect(authService.verifyToken('stale-non-persistent-token')).rejects.toHaveProperty('name', 'TokenExpiredError');
    expect(authService.getNonPersistentAccessInvalidBeforeMs()).toBeGreaterThan(issuedAtMs);
  });

  test('verifyToken preserves remember-me access tokens across startup invalidation', async () => {
    const issuedAtMs = Date.now() - 5000;
    jest.spyOn(jwt, 'verify').mockReturnValue({
      id: 1,
      type: 'access',
      persistent_session: true,
      issued_at_ms: issuedAtMs,
    });
    db.query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ secret: 'jwt-secret' }] });

    await authService.revokeAllRefreshTokensOnStartup();

    await expect(authService.verifyToken('persistent-token')).resolves.toEqual(
      expect.objectContaining({ persistent_session: true, issued_at_ms: issuedAtMs })
    );
  });

  test('auditLog writes JSON metadata', async () => {
    db.query.mockResolvedValueOnce(createDbRowsResult());

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
    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);
    db.query.mockResolvedValueOnce(createDbRowsResult());

    await expect(authService.authenticate('missing', 'password')).rejects.toThrow('Invalid credentials');

    expect(compareSpy).toHaveBeenCalledTimes(1);
    const [, hashArg] = compareSpy.mock.calls[0];
    expect(typeof hashArg).toBe('string');
    expect(hashArg).toMatch(/^\$2[aby]\$/);
  });

  test('authenticate throws when password does not match and increments failed_login_count', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, username: 'user', password_hash: 'stored-hash', is_active: true, locked_until: null, failed_login_count: 0 }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    await expect(authService.authenticate('user', 'bad-password')).rejects.toThrow('Invalid credentials');
    expect(compareSpy).toHaveBeenCalledWith('bad-password', 'stored-hash');
    const [incrementSql, incrementParams] = db.query.mock.calls[1];
    expect(incrementSql).toMatch(/failed_login_count = failed_login_count \+ 1/i);
    expect(incrementParams[0]).toBe(1);
  });

  test('authenticate updates last_login, resets lockout state, and strips password hash on success', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: 'admin', role: 'admin', password_hash: 'stored-hash', is_active: true, locked_until: null, failed_login_count: 0 }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const user = await authService.authenticate('admin', 'Password123!');

    expect(compareSpy).toHaveBeenCalledWith('Password123!', 'stored-hash');
    const [resetSql, resetParams] = db.query.mock.calls[1];
    expect(resetSql).toMatch(/failed_login_count = 0/i);
    expect(resetSql).toMatch(/locked_until = NULL/i);
    expect(resetSql).toMatch(/last_login = NOW/i);
    expect(resetParams).toEqual([2]);
    expect(user).toEqual(expect.objectContaining({ id: 2, username: 'admin', role: 'admin', is_active: true }));
    expect(user.password_hash).toBeUndefined();
  });

  test('authenticate throws lockout error when locked_until is in the future', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 3, username: 'locked', password_hash: 'hash', is_active: true, locked_until: lockedUntil, failed_login_count: 10 }],
    });

    await expect(authService.authenticate('locked', 'any-password'))
      .rejects.toThrow(/temporarily locked/i);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('authenticate includes remaining minutes in lockout error message', async () => {
    const lockedUntil = new Date(Date.now() + 7 * 60 * 1000 + 30000);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 4, username: 'locked2', password_hash: 'hash', is_active: true, locked_until: lockedUntil, failed_login_count: 10 }],
    });

    await expect(authService.authenticate('locked2', 'any-password'))
      .rejects.toThrow(/8 minute/);
  });

  test('authenticate uses singular "minute" when exactly 1 minute remains in lockout', async () => {
    const lockedUntil = new Date(Date.now() + 30 * 1000);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 8, username: 'locked3', password_hash: 'hash', is_active: true, locked_until: lockedUntil, failed_login_count: 10 }],
    });

    await expect(authService.authenticate('locked3', 'any-password'))
      .rejects.toThrow(/Try again in 1 minute\./);
  });

  test('authenticate proceeds normally when locked_until is in the past (expired)', async () => {
    const expiredLock = new Date(Date.now() - 1000);
    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 5, username: 'prevlocked', password_hash: 'hash', is_active: true, locked_until: expiredLock, failed_login_count: 10 }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const user = await authService.authenticate('prevlocked', 'correct-password');
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(user.username).toBe('prevlocked');
  });

  test('authenticate sets locked_until after MAX_FAILED_LOGINS consecutive failures', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 6, username: 'almostlocked', password_hash: 'hash', is_active: true, locked_until: null, failed_login_count: 9 }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    await expect(authService.authenticate('almostlocked', 'wrong'))
      .rejects.toThrow('Invalid credentials');

    const [, incrementParams] = db.query.mock.calls[1];
    expect(incrementParams[1]).toBe(authService.MAX_FAILED_LOGINS);
    expect(incrementParams[2]).toBe(authService.LOCKOUT_DURATION_MINUTES);
    expect(compareSpy).toHaveBeenCalledTimes(1);
  });

  test('getCookieOptions returns 48-hour persistent cookie by default (non-rememberMe)', () => {
    const opts = authService.getCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(authService.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  });

  test('getCookieOptions returns 30-day maxAge when rememberMe is true', () => {
    const opts = authService.getCookieOptions(false, true);
    expect(opts.maxAge).toBe(authService.REMEMBER_ME_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  });

  test('getCookieOptions respects secure flag', () => {
    expect(authService.getCookieOptions(true).secure).toBe(true);
  });

  test('getRefreshTokenCookieOptions scopes cookie to /api/auth with 48-hour maxAge by default', () => {
    const opts = authService.getRefreshTokenCookieOptions(false, false);
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe('/api/auth');
    expect(opts.maxAge).toBe(authService.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  });

  test('getRefreshTokenCookieOptions returns 30-day maxAge for rememberMe', () => {
    const opts = authService.getRefreshTokenCookieOptions(false, true);
    expect(opts.maxAge).toBe(authService.REMEMBER_ME_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  });
});
