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

// Bypass rate limiters so login-heavy tests don't hit 429
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const authRouter = require('../../routes/auth');
const authService = require('../../services/auth');

// Build test app - matches production setup for auth routes
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

describe('Auth Routes Integration Tests', () => {
    let testUserId;
    let testToken;
    const testPassword = 'TestPass123!';

    beforeAll(async () => {
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
            expect(response.body.refreshToken).toBeDefined();
            // Should set access_token cookie
            expect(response.headers['set-cookie']).toBeDefined();
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
            // Get a real refresh token by logging in
            const loginResp = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const { refreshToken } = loginResp.body;

            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.refreshToken).toBeDefined();
            expect(response.body.refreshToken).not.toBe(refreshToken);
            expect(response.body.user.username).toBe('authtest_user');
        });

        test('should return 401 for invalid refresh token string', async () => {
            await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'this_is_not_a_valid_token' })
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
            const loginResp = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const { refreshToken } = loginResp.body;

            // First use - succeeds
            await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            // Second use - should be rejected (token revoked on first use)
            await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken })
                .expect(401);
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
            const loginResp = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'authtest_user', password: testPassword })
                .expect(200);

            const { refreshToken } = loginResp.body;

            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ refreshToken })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify token was revoked
            const tokenData = await authService.validateRefreshToken(refreshToken);
            expect(tokenData).toBeNull();
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
});
