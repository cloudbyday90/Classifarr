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
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const runtimeSettings = await import('../../config/runtimeSettings.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { issueCsrfToken, clearCsrfToken } = await import('../../middleware/csrf.mjs');
const { resolveSecureCookieFlag } = await import('../../utils/cookieSecurity.shared.mjs');
const authService = { ...(await import('../../services/auth.mjs')) };
const { createAuthRouter } = await import('../../routes/authRouteShared.mjs');

const noopRateLimit = () => (req, res, next) => next();

/**
 * Parse a named cookie value out of a supertest response's Set-Cookie header.
 * The route uses HttpOnly cookies for token transport; this helper lets tests
 * inspect the raw token value without relying on response body fields.
 */
function extractCookie(headers, name) {
    const cookies = [].concat(headers['set-cookie'] || []);
    for (const cookie of cookies) {
        const [kv] = cookie.split(';');
        const eqIdx = kv.indexOf('=');
        if (eqIdx === -1) continue;
        const key = kv.slice(0, eqIdx).trim();
        const value = kv.slice(eqIdx + 1);
        if (key === name) return value;
    }
    return null;
}

// Build test app - matches production setup for auth routes
describe('Auth Routes Integration Tests', () => {
    let app;
    let testUserId;
    let testToken;
    const testPassword = 'TestPass123!';

    beforeAll(async () => {
        app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use('/api/auth', createAuthRouter({
            express,
            rateLimit: noopRateLimit,
            db,
            authenticate: (...args) => authService.authenticate(...args),
            auditLog: (...args) => authService.auditLog(...args),
            generateAccessToken: (...args) => authService.generateAccessToken(...args),
            generateRefreshToken: (...args) => authService.generateRefreshToken(...args),
            getCookieOptions: (...args) => authService.getCookieOptions(...args),
            getRefreshTokenCookieOptions: (...args) => authService.getRefreshTokenCookieOptions(...args),
            hashPassword: (...args) => authService.hashPassword(...args),
            hashToken: (...args) => authService.hashToken(...args),
            revokeAllUserTokens: (...args) => authService.revokeAllUserTokens(...args),
            revokeRefreshToken: (...args) => authService.revokeRefreshToken(...args),
            validatePasswordStrength: (...args) => authService.validatePasswordStrength(...args),
            validateRefreshToken: (...args) => authService.validateRefreshToken(...args),
            verifyPassword: (...args) => authService.verifyPassword(...args),
            runtimeSettings,
            authenticateToken,
            issueCsrfToken,
            clearCsrfToken,
            resolveSecureCookieFlag,
        }));

        const passwordHash = await authService.hashPassword(testPassword);
        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('authtest_user', $1, 'admin', true)
            RETURNING id
        `, [passwordHash]);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'authtest_user',
            role: 'admin'
        });
    });

    afterAll(async () => {
        await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [testUserId]);
        await db.query('DELETE FROM audit_log WHERE user_id = $1', [testUserId]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [testUserId]);
    });

    describe('POST /api/auth/login', () => {
        test('should login with valid credentials and return tokens', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user.username).toBe('authtest_user');
            expect(response.body.user.role).toBe('admin');
            expect(response.body.user).not.toHaveProperty('password_hash');
            const setCookies = response.headers['set-cookie'];
            expect(setCookies).toBeDefined();
            expect(extractCookie(response.headers, 'refresh_token')).toBeTruthy();
            expect(extractCookie(response.headers, 'access_token')).toBeTruthy();
        });

        test('should return 401 for wrong password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: 'WrongPass999!' })
                .expect(401);

            expect(response.body.error).toBeDefined();
        });

        test('should return 401 for non-existent user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'ghost_user_xyz', password: 'SomePass123!' })
                .expect(401);

            expect(response.body.error).toBeDefined();
        });

        test('should return 400 when identifier is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ password: testPassword })
                .expect(400);

            expect(response.body.error).toBe('Username and password are required');
        });

        test('should return 400 when password is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user' })
                .expect(400);

            expect(response.body.error).toBe('Username and password are required');
        });

        test('should record login in audit_log', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const audit = await db.query(
                `SELECT action FROM audit_log WHERE user_id = $1 AND action = 'login_success' ORDER BY created_at DESC LIMIT 1`,
                [testUserId]
            );
            expect(audit.rows.length).toBeGreaterThan(0);
        });
    });

    describe('POST /api/auth/refresh', () => {
        test('should issue new access + refresh tokens with valid refresh token', async () => {
            const agent = request.agent(app);

            const loginResp = await agent
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const firstRefreshToken = extractCookie(loginResp.headers, 'refresh_token');
            expect(firstRefreshToken).toBeTruthy();

            const response = await agent
                .post('/api/auth/refresh')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user.username).toBe('authtest_user');
            const newRefreshToken = extractCookie(response.headers, 'refresh_token');
            expect(newRefreshToken).toBeTruthy();
            expect(newRefreshToken).not.toBe(firstRefreshToken);
        });

        test('should return 401 for invalid refresh token string', async () => {
            await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', 'refresh_token=this_is_not_a_valid_token')
                .expect(401);
        });

        test('should return 400 when refresh token is missing', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({})
                .expect(400);

            expect(response.body.error).toBe('Refresh token is required');
        });

        test('should reject an already-used refresh token (token rotation)', async () => {
            const agent = request.agent(app);

            const loginResp = await agent
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const originalToken = extractCookie(loginResp.headers, 'refresh_token');
            expect(originalToken).toBeTruthy();

            await agent
                .post('/api/auth/refresh')
                .expect(200);

            await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', `refresh_token=${originalToken}`)
                .expect(401);
        });

        test('should leave the original refresh token usable when rotation fails before old-token revocation completes', async () => {
            const agent = request.agent(app);

            const loginResp = await agent
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const originalToken = extractCookie(loginResp.headers, 'refresh_token');
            expect(originalToken).toBeTruthy();

            const revokeSpy = jest.spyOn(authService, 'revokeRefreshToken')
                .mockRejectedValueOnce(new Error('rotation write failed'));

            const failedRefresh = await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', `refresh_token=${originalToken}`);

            expect(failedRefresh.status).toBe(500);

            revokeSpy.mockRestore();

            await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', `refresh_token=${originalToken}`)
                .expect(200);
        });
    });

    describe('GET /api/auth/me', () => {
        test('should return current user info when authenticated', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.id).toBe(testUserId);
            expect(response.body.username).toBe('authtest_user');
            expect(response.body.role).toBe('admin');
            expect(response.body).not.toHaveProperty('password_hash');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/auth/me')
                .expect(401);
        });

        test('should return 403 with malformed token', async () => {
            await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer not.a.valid.jwt')
                .expect(403);
        });

        test('should return 401 (not 403) for an expired access token so the client interceptor can refresh', async () => {
            const secret = await authService.getJWTSecret();
            const expiredToken = jwt.sign(
                { id: testUserId, username: 'authtest_user', role: 'admin', type: 'access' },
                secret,
                { expiresIn: -1, issuer: 'classifarr' }
            );

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body.error).toMatch(/expired/i);
        });
    });

    describe('GET /api/auth/session', () => {
        test('should return current session info when authenticated', async () => {
            const response = await request(app)
                .get('/api/auth/session')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('ip');
            expect(Object.keys(response.body)).toEqual(
                expect.arrayContaining(['ip', 'createdAt'])
            );
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/auth/session')
                .expect(401);
        });
    });

    describe('GET /api/auth/sessions', () => {
        test('should return empty sessions list when no refresh tokens exist', async () => {
            const response = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('sessions');
            expect(Array.isArray(response.body.sessions)).toBe(true);
            expect(response.body.sessions.length).toBe(0);
        });

        test('should list active sessions after login', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const response = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.sessions.length).toBeGreaterThan(0);
            expect(response.body.sessions[0]).toHaveProperty('id');
            expect(response.body.sessions[0]).toHaveProperty('expires_at');
            expect(response.body.sessions[0]).not.toHaveProperty('token_hash');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/auth/sessions')
                .expect(401);
        });
    });

    describe('DELETE /api/auth/sessions/:id', () => {
        test('should revoke an active session by ID', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const sessionsResp = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            const sessionId = sessionsResp.body.sessions[0].id;

            const response = await request(app)
                .delete(`/api/auth/sessions/${sessionId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            const afterResp = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            const stillExists = afterResp.body.sessions.find((session) => session.id === sessionId);
            expect(stillExists).toBeUndefined();
        });

        test('should return 404 for non-existent session', async () => {
            await request(app)
                .delete('/api/auth/sessions/999999')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(404);
        });

        test('should return 400 for non-numeric session ID', async () => {
            await request(app)
                .delete('/api/auth/sessions/notanumber')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(400);
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .delete('/api/auth/sessions/1')
                .expect(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        test('should logout and revoke refresh token', async () => {
            const agent = request.agent(app);

            const loginResp = await agent
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const refreshToken = extractCookie(loginResp.headers, 'refresh_token');
            expect(refreshToken).toBeTruthy();

            const tokenRows = await db.query(
                'SELECT token_hash FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
                [testUserId]
            );
            expect(tokenRows.rows.length).toBeGreaterThan(0);

            const response = await agent
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            const afterRows = await db.query(
                'SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1',
                [tokenRows.rows[0].token_hash]
            );
            expect(afterRows.rows[0].revoked_at).not.toBeNull();
        });

        test('should logout without a refresh token (cookie-only logout)', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${testToken}`)
                .send({})
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .post('/api/auth/logout')
                .send({})
                .expect(401);
        });
    });

    describe('POST /api/auth/logout-all', () => {
        test('should revoke all active refresh tokens for the user', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword });
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword });

            const response = await request(app)
                .post('/api/auth/logout-all')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(typeof response.body.tokensRevoked).toBe('number');
            expect(response.body.tokensRevoked).toBeGreaterThanOrEqual(2);

            const sessionsResp = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(sessionsResp.body.sessions.length).toBe(0);
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .post('/api/auth/logout-all')
                .expect(401);
        });
    });

    describe('POST /api/auth/change-password', () => {
        let changePwUserId;
        let changePwToken;
        const originalPw = 'OriginalSecure123!';
        const newPw = 'NewSecurePass456@';

        beforeAll(async () => {
            const pwHash = await authService.hashPassword(originalPw);
            const result = await db.query(`
                INSERT INTO users (username, password_hash, role, is_active)
                VALUES ('changepw_user', $1, 'user', true)
                RETURNING id
            `, [pwHash]);
            changePwUserId = result.rows[0].id;
            changePwToken = await authService.generateAccessToken({
                id: changePwUserId,
                username: 'changepw_user',
                role: 'viewer'
            });
        });

        afterAll(async () => {
            await db.query('DELETE FROM audit_log WHERE user_id = $1', [changePwUserId]);
            await db.query('DELETE FROM users WHERE id = $1', [changePwUserId]);
        });

        test('should change password successfully', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${changePwToken}`)
                .send({
                    currentPassword: originalPw,
                    newPassword: newPw,
                    confirmPassword: newPw
                })
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('should reject when new passwords do not match', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${changePwToken}`)
                .send({
                    currentPassword: newPw,
                    newPassword: 'Password123!',
                    confirmPassword: 'DifferentPass999#'
                })
                .expect(400);

            expect(response.body.error).toContain('do not match');
        });

        test('should return 400 when fields are missing', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${changePwToken}`)
                .send({ currentPassword: newPw })
                .expect(400);

            expect(response.body.error).toContain('required');
        });

        test('should return 401 when current password is incorrect', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${changePwToken}`)
                .send({
                    currentPassword: 'WrongCurrentPass999!',
                    newPassword: 'SomethingElse123!',
                    confirmPassword: 'SomethingElse123!'
                })
                .expect(401);

            expect(response.body.error).toContain('incorrect');
        });

        test('should return 400 for weak new password', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${changePwToken}`)
                .send({
                    currentPassword: newPw,
                    newPassword: 'weak',
                    confirmPassword: 'weak'
                })
                .expect(400);

            expect(response.body.error).toBeDefined();
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .post('/api/auth/change-password')
                .send({
                    currentPassword: 'anything',
                    newPassword: 'NewPass123!',
                    confirmPassword: 'NewPass123!'
                })
                .expect(401);
        });
    });

    describe('Remember-Me feature', () => {
        function extractCookieAttrib(headers, cookieName, attrib) {
            const cookies = [].concat(headers['set-cookie'] || []);
            for (const cookie of cookies) {
                const parts = cookie.split(';').map((part) => part.trim());
                const [kv] = parts;
                const eq = kv.indexOf('=');
                if (eq === -1) continue;
                if (kv.slice(0, eq).trim() !== cookieName) continue;
                for (let index = 1; index < parts.length; index += 1) {
                    const eq2 = parts[index].indexOf('=');
                    if (eq2 === -1) continue;
                    const key = parts[index].slice(0, eq2).trim().toLowerCase();
                    if (key === attrib.toLowerCase()) return parts[index].slice(eq2 + 1).trim();
                }
                return null;
            }
            return undefined;
        }

        const REMEMBER_ME_MAX_AGE_S = 30 * 24 * 60 * 60;
        const SESSION_MAX_AGE_S = 48 * 60 * 60;

        test('login with rememberMe=true sets 30-day Max-Age on access_token cookie', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: true })
                .expect(200);

            const maxAge = parseInt(extractCookieAttrib(response.headers, 'access_token', 'max-age'), 10);
            expect(maxAge).toBe(REMEMBER_ME_MAX_AGE_S);
        });

        test('login with rememberMe=true sets 30-day Max-Age on refresh_token cookie', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: true })
                .expect(200);

            const maxAge = parseInt(extractCookieAttrib(response.headers, 'refresh_token', 'max-age'), 10);
            expect(maxAge).toBe(REMEMBER_ME_MAX_AGE_S);
        });

        test('login with rememberMe=false sets 48-hour Max-Age on access_token cookie', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: false })
                .expect(200);

            const maxAge = parseInt(extractCookieAttrib(response.headers, 'access_token', 'max-age'), 10);
            expect(maxAge).toBe(SESSION_MAX_AGE_S);
        });

        test('login with rememberMe=true stores remember_me=true in refresh_tokens table', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: true })
                .expect(200);

            const row = await db.query(
                'SELECT remember_me FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
                [testUserId]
            );
            expect(row.rows[0].remember_me).toBe(true);
        });

        test('login with rememberMe=false stores remember_me=false in refresh_tokens table', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: false })
                .expect(200);

            const row = await db.query(
                'SELECT remember_me FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
                [testUserId]
            );
            expect(row.rows[0].remember_me).toBe(false);
        });

        test('revokeAllRefreshTokensOnStartup preserves remember-me tokens', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: true })
                .expect(200);

            await authService.revokeAllRefreshTokensOnStartup();

            const active = await db.query(
                'SELECT remember_me FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
                [testUserId]
            );
            expect(active.rows.length).toBe(1);
            expect(active.rows[0].remember_me).toBe(true);
        });

        test('revokeAllRefreshTokensOnStartup revokes non-remember-me tokens', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: false })
                .expect(200);

            const revoked = await authService.revokeAllRefreshTokensOnStartup();
            expect(revoked).toBeGreaterThanOrEqual(1);

            const active = await db.query(
                'SELECT id FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
                [testUserId]
            );
            expect(active.rows.length).toBe(0);
        });

        test('remember-me session can refresh after simulated server restart', async () => {
            const agent = request.agent(app);

            const loginResp = await agent
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: true })
                .expect(200);
            const accessToken = extractCookie(loginResp.headers, 'access_token');
            expect(accessToken).toBeTruthy();

            await authService.revokeAllRefreshTokensOnStartup();

            await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            const refreshResp = await agent
                .post('/api/auth/refresh')
                .expect(200);

            expect(refreshResp.body.success).toBe(true);
            expect(refreshResp.body.user.username).toBe('authtest_user');
        });

        test('refresh after remember-me login issues new tokens with 30-day Max-Age', async () => {
            const agent = request.agent(app);

            await agent
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: true })
                .expect(200);

            const refreshResp = await agent
                .post('/api/auth/refresh')
                .expect(200);

            const maxAge = parseInt(extractCookieAttrib(refreshResp.headers, 'refresh_token', 'max-age'), 10);
            expect(maxAge).toBe(REMEMBER_ME_MAX_AGE_S);
        });

        test('non-remember-me session does NOT survive simulated server restart', async () => {
            const agent = request.agent(app);

            const loginResp = await agent
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword, rememberMe: false })
                .expect(200);
            const accessToken = extractCookie(loginResp.headers, 'access_token');
            expect(accessToken).toBeTruthy();

            await authService.revokeAllRefreshTokensOnStartup();

            await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(401);

            await agent
                .post('/api/auth/refresh')
                .expect(401);
        });
    });
});
