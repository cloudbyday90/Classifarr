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

const db = require('../../config/database');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const runtimeSettings = require('../../config/runtimeSettings');
const { authenticateToken } = require('../../middleware/auth');
const { issueCsrfToken, clearCsrfToken } = require('../../middleware/csrf');
const { resolveSecureCookieFlag } = require('../../utils/cookieSecurity');

const authService = require('../../services/auth');

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
        const k = kv.slice(0, eqIdx).trim();
        const v = kv.slice(eqIdx + 1);
        if (k === name) return v;
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
        const { createAuthRouter } = await import('../../routes/authRouteShared.mjs');
        app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use('/api/auth', createAuthRouter({
            express,
            rateLimit: noopRateLimit,
            db,
            authService,
            runtimeSettings,
            authenticateToken,
            issueCsrfToken,
            clearCsrfToken,
            resolveSecureCookieFlag,
        }));

        // Create test user with a real bcrypt hash so login works
        const passwordHash = await authService.hashPassword(testPassword);
        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('authtest_user', $1, 'admin', true)
            RETURNING id
        `, [passwordHash]);
        testUserId = userResult.rows[0].id;

        // Generate a token (also seeds jwt_secrets table for verify to work)
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
        // Clean refresh tokens between tests to avoid interference
        await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [testUserId]);
    });

    // ============================================================
    // POST /api/auth/login
    // ============================================================
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
            // Tokens are delivered as HttpOnly cookies, not in the JSON body
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

    // ============================================================
    // POST /api/auth/refresh
    // ============================================================
    describe('POST /api/auth/refresh', () => {
        test('should issue new access + refresh tokens with valid refresh token', async () => {
            // Use a cookie-aware agent so the refresh_token cookie set by /login
            // is automatically forwarded to /refresh (which reads req.cookies).
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
            // A new refresh_token cookie should be set and differ from the original
            const newRefreshToken = extractCookie(response.headers, 'refresh_token');
            expect(newRefreshToken).toBeTruthy();
            expect(newRefreshToken).not.toBe(firstRefreshToken);
        });

        test('should return 401 for invalid refresh token string', async () => {
            // Send a garbage value via the refresh_token cookie
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

            // First use via agent (cookies carry through) - succeeds, rotates token
            await agent
                .post('/api/auth/refresh')
                .expect(200);

            // Second use of the original token (now revoked) — must be 401
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

    // ============================================================
    // GET /api/auth/me
    // ============================================================
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
            // Generate a real JWT that is already expired (expiresIn=-1s)
            const jwt = require('jsonwebtoken');
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

    // ============================================================
    // GET /api/auth/session
    // ============================================================
    describe('GET /api/auth/session', () => {
        test('should return current session info when authenticated', async () => {
            const response = await request(app)
                .get('/api/auth/session')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('ip');
            // userAgent may be undefined in test environment; just verify shape
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

    // ============================================================
    // GET /api/auth/sessions
    // ============================================================
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
            // Token hash must not be exposed
            expect(response.body.sessions[0]).not.toHaveProperty('token_hash');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/auth/sessions')
                .expect(401);
        });
    });

    // ============================================================
    // DELETE /api/auth/sessions/:id
    // ============================================================
    describe('DELETE /api/auth/sessions/:id', () => {
        test('should revoke an active session by ID', async () => {
            // Create a session via login
            await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            // List sessions to get an ID
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

            // Confirm it no longer appears in sessions list
            const afterResp = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            const stillExists = afterResp.body.sessions.find(s => s.id === sessionId);
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

    // ============================================================
    // POST /api/auth/logout
    // ============================================================
    describe('POST /api/auth/logout', () => {
        test('should logout and revoke refresh token', async () => {
            const agent = request.agent(app);

            const loginResp = await agent
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            // Capture the raw token value so we can independently verify it was revoked
            const refreshToken = extractCookie(loginResp.headers, 'refresh_token');
            expect(refreshToken).toBeTruthy();

            // Decode the stored token hash by looking it up directly
            const tokenRows = await db.query(
                'SELECT token_hash FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
                [testUserId]
            );
            expect(tokenRows.rows.length).toBeGreaterThan(0);

            // Logout via the agent (carries the refresh_token cookie automatically)
            const response = await agent
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify token was revoked — the row should now have revoked_at set
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

    // ============================================================
    // POST /api/auth/logout-all
    // ============================================================
    describe('POST /api/auth/logout-all', () => {
        test('should revoke all active refresh tokens for the user', async () => {
            // Create multiple sessions
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

            // All sessions should be gone
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

    // ============================================================
    // POST /api/auth/change-password
    // ============================================================
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

    // ============================================================
    // Remember-Me feature
    // ============================================================
    describe('Remember-Me feature', () => {
        /**
         * Parse a single named attribute out of a Set-Cookie header entry.
         * Returns the attribute value string, null if the cookie was found but the
         * attribute was absent, or undefined if the cookie itself was not found.
         */
        function extractCookieAttrib(headers, cookieName, attrib) {
            const cookies = [].concat(headers['set-cookie'] || []);
            for (const c of cookies) {
                const parts = c.split(';').map(p => p.trim());
                const [kv] = parts;
                const eq = kv.indexOf('=');
                if (eq === -1) continue;
                if (kv.slice(0, eq).trim() !== cookieName) continue;
                for (let i = 1; i < parts.length; i++) {
                    const eq2 = parts[i].indexOf('=');
                    if (eq2 === -1) continue;
                    const k = parts[i].slice(0, eq2).trim().toLowerCase();
                    if (k === attrib.toLowerCase()) return parts[i].slice(eq2 + 1).trim();
                }
                return null; // cookie present but attribute absent
            }
            return undefined; // cookie not set at all
        }

        // 30 × 24 × 60 × 60  expressed in seconds (the Max-Age cookie attribute unit)
        const REMEMBER_ME_MAX_AGE_S = 30 * 24 * 60 * 60;
        // 48 × 60 × 60  (SESSION_EXPIRY_HOURS)
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

            // Simulate server restart
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

            // Simulate server restart (revokes only non-remember-me tokens)
            await authService.revokeAllRefreshTokensOnStartup();

            await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            // The remember-me refresh token should still be valid
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

            // Simulate server restart — non-remember-me tokens are revoked
            await authService.revokeAllRefreshTokensOnStartup();

            await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(401);

            // Refresh should now fail (token was revoked)
            await agent
                .post('/api/auth/refresh')
                .expect(401);
        });
    });
});
