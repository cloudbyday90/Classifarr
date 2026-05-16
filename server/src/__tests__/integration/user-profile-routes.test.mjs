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
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { router: authRouter } = await import('../../routes/auth.mjs');
const { router: userRouter } = await import('../../routes/user.mjs');
const integrationRouter = express.Router();
integrationRouter.use('/api/user', userRouter);
integrationRouter.use('/api/auth', authRouter);
const app = createIntegrationTestApp({
    router: integrationRouter,
});

describe('User Profile Routes Integration Tests', () => {
    let testUserId;
    let testToken;
    let testUsername = 'profiletestuser';
    let testPassword = 'TestPass123!';
    let adminUserId;
    let adminToken;
    let adminUsername = 'profileadminuser';

    // Setup test user and JWT token
    beforeAll(async () => {
        const hashedPassword = await authService.hashPassword(testPassword);

        // Create a regular test user
        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ($1, $2, 'user', true)
            RETURNING id
        `, [testUsername, hashedPassword]);
        testUserId = userResult.rows[0].id;

        // Generate a test JWT token for regular user
        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: testUsername,
            role: 'user'
        });

        // Create an admin test user
        const adminResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ($1, $2, 'admin', true)
            RETURNING id
        `, [adminUsername, hashedPassword]);
        adminUserId = adminResult.rows[0].id;

        // Generate a test JWT token for admin user
        adminToken = await authService.generateAccessToken({
            id: adminUserId,
            username: adminUsername,
            role: 'admin'
        });
    });

    // Clean up after all tests
    afterAll(async () => {
        await db.query('DELETE FROM audit_log WHERE user_id = $1 OR user_id = $2', [testUserId, adminUserId]);
        await db.query('DELETE FROM users WHERE id = $1 OR id = $2', [testUserId, adminUserId]);
    });

    describe('GET /api/user/me', () => {
        test('should return current user info', async () => {
            const response = await request(app)
                .get('/api/user/me')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', testUserId);
            expect(response.body).toHaveProperty('username', testUsername);
            expect(response.body).toHaveProperty('role', 'user');
            expect(response.body).toHaveProperty('is_active', true);
            expect(response.body).not.toHaveProperty('password_hash');
        });

        test('should return admin user info for admin users', async () => {
            const response = await request(app)
                .get('/api/user/me')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', adminUserId);
            expect(response.body).toHaveProperty('username', adminUsername);
            expect(response.body).toHaveProperty('role', 'admin');
            expect(response.body).toHaveProperty('is_active', true);
            expect(response.body).not.toHaveProperty('password_hash');
        });

        test('should require authentication', async () => {
            await request(app)
                .get('/api/user/me')
                .expect(401);
        });
    });

    describe('PATCH /api/user/profile', () => {
        test('should update username successfully', async () => {
            const newUsername = 'updatedprofileuser';

            const response = await request(app)
                .patch('/api/user/profile')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ username: newUsername })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('username', newUsername);

            // Verify in database
            const userResult = await db.query('SELECT username FROM users WHERE id = $1', [testUserId]);
            expect(userResult.rows[0].username).toBe(newUsername);

            // Verify audit log
            const auditResult = await db.query(
                'SELECT * FROM audit_log WHERE user_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1',
                [testUserId, 'username_changed']
            );
            expect(auditResult.rows.length).toBe(1);
            expect(auditResult.rows[0].metadata.new_username).toBe(newUsername);

            // Reset username for other tests
            await db.query('UPDATE users SET username = $1 WHERE id = $2', [testUsername, testUserId]);
        });

        test('should allow admin users to update their username', async () => {
            const newAdminUsername = 'updatedadminuser';

            const response = await request(app)
                .patch('/api/user/profile')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ username: newAdminUsername })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('username', newAdminUsername);

            // Verify in database
            const userResult = await db.query('SELECT username FROM users WHERE id = $1', [adminUserId]);
            expect(userResult.rows[0].username).toBe(newAdminUsername);

            // Reset username for other tests
            await db.query('UPDATE users SET username = $1 WHERE id = $2', [adminUsername, adminUserId]);
        });

        test('should reject username shorter than 3 characters', async () => {
            const response = await request(app)
                .patch('/api/user/profile')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ username: 'ab' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('between 3 and 50 characters');
        });

        test('should reject username longer than 50 characters', async () => {
            const longUsername = 'a'.repeat(51);
            const response = await request(app)
                .patch('/api/user/profile')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ username: longUsername })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('between 3 and 50 characters');
        });

        test('should reject duplicate username', async () => {
            // Create another user
            const otherUserResult = await db.query(`
                INSERT INTO users (username, password_hash, role, is_active)
                VALUES ('otheruserprofile', 'hash', 'user', true)
                RETURNING id
            `);
            const otherUserId = otherUserResult.rows[0].id;

            const response = await request(app)
                .patch('/api/user/profile')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ username: 'otheruserprofile' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('already taken');

            // Clean up
            await db.query('DELETE FROM users WHERE id = $1', [otherUserId]);
        });

        test('should require authentication', async () => {
            await request(app)
                .patch('/api/user/profile')
                .send({ username: 'newname' })
                .expect(401);
        });
    });

    describe('PATCH /api/user/password', () => {
        test('should change password successfully', async () => {
            const newPassword = 'NewPass123!';

            const response = await request(app)
                .patch('/api/user/password')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    currentPassword: testPassword,
                    newPassword: newPassword,
                    confirmPassword: newPassword
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);

            // Verify audit log
            const auditResult = await db.query(
                'SELECT * FROM audit_log WHERE user_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1',
                [testUserId, 'password_changed']
            );
            expect(auditResult.rows.length).toBe(1);

            // Verify new password works
            const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [testUserId]);
            const isValid = await authService.verifyPassword(newPassword, userResult.rows[0].password_hash);
            expect(isValid).toBe(true);

            // Reset password for other tests
            const originalHash = await authService.hashPassword(testPassword);
            await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [originalHash, testUserId]);
        });

        test('should allow admin users to change their password', async () => {
            const newAdminPassword = 'AdminNewPass123!';

            const response = await request(app)
                .patch('/api/user/password')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    currentPassword: testPassword,
                    newPassword: newAdminPassword,
                    confirmPassword: newAdminPassword
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);

            // Verify new password works
            const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [adminUserId]);
            const isValid = await authService.verifyPassword(newAdminPassword, userResult.rows[0].password_hash);
            expect(isValid).toBe(true);

            // Reset password for other tests
            const originalHash = await authService.hashPassword(testPassword);
            await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [originalHash, adminUserId]);
        });

        test('should reject incorrect current password', async () => {
            const response = await request(app)
                .patch('/api/user/password')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    currentPassword: 'WrongPass123!',
                    newPassword: 'NewPass123!',
                    confirmPassword: 'NewPass123!'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Current password is incorrect');
        });

        test('should reject mismatched new passwords', async () => {
            const response = await request(app)
                .patch('/api/user/password')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    currentPassword: testPassword,
                    newPassword: 'NewPass123!',
                    confirmPassword: 'DifferentPass123!'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('do not match');
        });

        test('should reject weak password', async () => {
            const response = await request(app)
                .patch('/api/user/password')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    currentPassword: testPassword,
                    newPassword: 'weak',
                    confirmPassword: 'weak'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should require all fields', async () => {
            const response = await request(app)
                .patch('/api/user/password')
                .set('Authorization', `Bearer ${testToken}`)
                .set('User-Agent', 'Jest-Test-Runner')
                .send({
                    currentPassword: testPassword
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('required');
        });

        test('should require authentication', async () => {
            await request(app)
                .patch('/api/user/password')
                .send({
                    currentPassword: testPassword,
                    newPassword: 'NewPass123!',
                    confirmPassword: 'NewPass123!'
                })
                .expect(401);
        });
    });

    describe('GET /api/auth/session', () => {
        test('should return session information', async () => {
            const response = await request(app)
                .get('/api/auth/session')
                .set('Authorization', `Bearer ${testToken}`)
                .set('User-Agent', 'Jest-Test-Runner')
                .expect(200);

            expect(response.body).toHaveProperty('started');
            expect(response.body).toHaveProperty('ip');
            expect(response.body).toHaveProperty('userAgent');
            expect(response.body.userAgent).toBe('Jest-Test-Runner');
            expect(response.body).toHaveProperty('createdAt');
        });

        test('should require authentication', async () => {
            await request(app)
                .get('/api/auth/session')
                .expect(401);
        });
    });
});
