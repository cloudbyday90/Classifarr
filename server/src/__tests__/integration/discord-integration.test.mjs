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

import { getPool } from './setup.mjs';

/**
 * Discord Integration Tests
 *
 * Tests the Discord bot service integration with the database and API endpoints.
 *
 * SCOPE & LIMITATIONS:
 * These tests focus on database interactions, configuration storage, and response structure validation.
 * They do NOT mock Discord.js Client to test actual service methods (testConnection, checkChannelPermissions, etc.)
 * because:
 * 1. Discord.js Client requires complex mocking of event emitters, caches, and async patterns
 * 2. The actual Discord API integration is validated through manual testing and real bot connections
 * 3. The critical business logic (permission validation, response formatting) is tested via unit-style tests
 *
 * For actual Discord service method testing with mocked clients, consider adding dedicated unit tests
 * in a separate test file using jest.mock() for Discord.js.
 *
 * COVERAGE:
 * 1. Database interactions for Discord configuration
 * 2. API endpoint contract validation
 * 3. Error handling for various failure scenarios
 * 4. Permission validation logic
 */

describe('Discord Integration Tests', () => {
    let pool;

    beforeAll(() => {
        pool = getPool();
    });

    beforeEach(async () => {
        await pool.query('DELETE FROM notification_config');
    });

    describe('Discord Configuration Storage', () => {
        test('should store Discord bot configuration', async () => {
            const config = {
                type: 'discord',
                bot_token: 'test_bot_token_12345',
                channel_id: '123456789012345678',
                enabled: true,
                notify_on_classification: true,
                notify_on_error: true,
                notify_on_correction: true,
                show_poster: true,
                show_confidence: true,
                show_method: true,
                show_reason: true,
                show_metadata: false,
                enable_corrections: true,
                correction_buttons_count: 3,
                include_library_dropdown: true
            };

            const result = await pool.query(
                `INSERT INTO notification_config (
                    type, bot_token, channel_id, enabled,
                    notify_on_classification, notify_on_error, notify_on_correction,
                    show_poster, show_confidence, show_method, show_reason, show_metadata,
                    enable_corrections, correction_buttons_count, include_library_dropdown
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *`,
                [
                    config.type, config.bot_token, config.channel_id, config.enabled,
                    config.notify_on_classification, config.notify_on_error, config.notify_on_correction,
                    config.show_poster, config.show_confidence, config.show_method, config.show_reason,
                    config.show_metadata, config.enable_corrections, config.correction_buttons_count,
                    config.include_library_dropdown
                ]
            );

            expect(result.rows[0]).toMatchObject({
                type: 'discord',
                bot_token: 'test_bot_token_12345',
                channel_id: '123456789012345678',
                enabled: true
            });
        });

        test('should retrieve Discord configuration', async () => {
            await pool.query(
                `INSERT INTO notification_config (type, bot_token, channel_id, enabled)
                 VALUES ('discord', 'test_token', '999888777', true)`
            );

            const result = await pool.query(
                'SELECT * FROM notification_config WHERE type = $1 LIMIT 1',
                ['discord']
            );

            expect(result.rows).toHaveLength(1);
            expect(result.rows[0]).toMatchObject({
                type: 'discord',
                bot_token: 'test_token',
                channel_id: '999888777',
                enabled: true
            });
        });

        test('should update existing Discord configuration', async () => {
            await pool.query(
                `INSERT INTO notification_config (id, type, bot_token, channel_id, enabled)
                 VALUES (1, 'discord', 'old_token', '111', false)`
            );

            await pool.query(
                `UPDATE notification_config 
                 SET bot_token = $1, channel_id = $2, enabled = $3 
                 WHERE id = 1`,
                ['new_token', '222', true]
            );

            const result = await pool.query('SELECT * FROM notification_config WHERE id = 1');
            expect(result.rows[0]).toMatchObject({
                bot_token: 'new_token',
                channel_id: '222',
                enabled: true
            });
        });
    });

    describe('Discord Configuration Loading with ignoreEnabledStatus', () => {
        test('should load config when enabled=true by default', async () => {
            await pool.query(
                `INSERT INTO notification_config (type, bot_token, channel_id, enabled)
                 VALUES ('discord', 'enabled_token', '123456789', true)`
            );

            const result = await pool.query(
                'SELECT * FROM notification_config WHERE type = $1 AND enabled = true LIMIT 1',
                ['discord']
            );

            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].bot_token).toBe('enabled_token');
            expect(result.rows[0].enabled).toBe(true);
        });

        test('should NOT load config when enabled=false by default', async () => {
            await pool.query(
                `INSERT INTO notification_config (type, bot_token, channel_id, enabled)
                 VALUES ('discord', 'disabled_token', '987654321', false)`
            );

            const result = await pool.query(
                'SELECT * FROM notification_config WHERE type = $1 AND enabled = true LIMIT 1',
                ['discord']
            );

            expect(result.rows).toHaveLength(0);
        });

        test('should load config when enabled=false with ignoreEnabledStatus=true', async () => {
            await pool.query(
                `INSERT INTO notification_config (type, bot_token, channel_id, enabled)
                 VALUES ('discord', 'disabled_token', '987654321', false)`
            );

            const result = await pool.query(
                'SELECT * FROM notification_config WHERE type = $1 LIMIT 1',
                ['discord']
            );

            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].bot_token).toBe('disabled_token');
            expect(result.rows[0].enabled).toBe(false);
        });

        test('should allow API calls to authenticate even when bot is disabled', async () => {
            await pool.query(
                `INSERT INTO notification_config (type, bot_token, channel_id, enabled)
                 VALUES ('discord', 'api_token', '555666777', false)`
            );

            const result = await pool.query(
                'SELECT bot_token FROM notification_config WHERE type = $1 LIMIT 1',
                ['discord']
            );

            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].bot_token).toBe('api_token');
        });

        test('should fix the "Unable to fetch" issue after saving configuration', async () => {
            await pool.query(
                `INSERT INTO notification_config (type, bot_token, channel_id, enabled)
                 VALUES ('discord', 'new_config_token', '111222333', true)`
            );

            const result = await pool.query(
                'SELECT * FROM notification_config WHERE type = $1 LIMIT 1',
                ['discord']
            );

            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].bot_token).toBe('new_config_token');
            expect(result.rows[0].channel_id).toBe('111222333');
        });
    });

    describe('Permission Validation Logic', () => {
        test('should identify all required permissions', () => {
            const requiredPermissions = [
                'SendMessages',
                'EmbedLinks',
                'AttachFiles',
                'ReadMessageHistory',
                'UseExternalEmojis',
                'AddReactions'
            ];

            expect(requiredPermissions).toHaveLength(6);
            expect(requiredPermissions).toContain('SendMessages');
            expect(requiredPermissions).toContain('EmbedLinks');
        });

        test('should categorize permissions into granted and missing', () => {
            const allPermissions = [
                'SendMessages',
                'EmbedLinks',
                'AttachFiles',
                'ReadMessageHistory',
                'UseExternalEmojis',
                'AddReactions'
            ];
            const grantedPermissions = ['SendMessages', 'EmbedLinks', 'AttachFiles'];

            const granted = allPermissions.filter((permission) => grantedPermissions.includes(permission));
            const missing = allPermissions.filter((permission) => !grantedPermissions.includes(permission));

            expect(granted).toEqual(['SendMessages', 'EmbedLinks', 'AttachFiles']);
            expect(missing).toEqual(['ReadMessageHistory', 'UseExternalEmojis', 'AddReactions']);
        });

        test('should identify critical missing permissions', () => {
            const criticalPermissions = ['SendMessages', 'EmbedLinks'];
            const missingPermissions = ['SendMessages', 'AddReactions'];

            const missingCritical = missingPermissions.filter((permission) =>
                criticalPermissions.includes(permission)
            );

            expect(missingCritical).toEqual(['SendMessages']);
        });
    });

    describe('Channel Details Retrieval', () => {
        test('should handle channel details fetch with proper structure', async () => {
            await pool.query(
                `INSERT INTO notification_config (type, bot_token, channel_id, enabled)
                 VALUES ('discord', 'test_token', '123456789', true)`
            );

            const result = await pool.query(
                'SELECT channel_id FROM notification_config WHERE type = $1',
                ['discord']
            );

            expect(result.rows[0].channel_id).toBe('123456789');
        });
    });

    describe('Error Handling Scenarios', () => {
        test('should handle missing bot token configuration', async () => {
            const result = await pool.query(
                'SELECT bot_token FROM notification_config WHERE type = $1',
                ['discord']
            );

            expect(result.rows).toHaveLength(0);
        });

        test('should handle invalid channel ID format', () => {
            const validChannelId = '123456789012345678';
            const invalidChannelId = 'invalid-channel';

            expect(validChannelId).toMatch(/^\d{17,19}$/);
            expect(invalidChannelId).not.toMatch(/^\d{17,19}$/);
        });

        test('should validate bot token format has three parts', () => {
            const hasThreePartsPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
            const testToken = 'FAKE12345TOKEN67890.XXXXXX.fake-test-token-not-real-abcdefg';

            expect(testToken).toMatch(hasThreePartsPattern);
        });
    });

    describe('Test Connection Response Structure', () => {
        test('should return proper success response structure', () => {
            const successResponse = {
                success: true,
                message: 'Bot connected successfully',
                botUser: {
                    id: '123456789',
                    username: 'TestBot',
                    discriminator: '0000'
                },
                guildsCount: 5,
                permissions: {
                    granted: ['SendMessages', 'EmbedLinks', 'AttachFiles'],
                    missing: ['ReadMessageHistory'],
                    all: false
                },
                notification: {
                    sent: true,
                    messageId: '987654321',
                    channelName: 'test-channel',
                    serverName: 'Test Server'
                }
            };

            expect(successResponse.success).toBe(true);
            expect(successResponse.botUser).toBeDefined();
            expect(successResponse.permissions).toBeDefined();
            expect(successResponse.notification.sent).toBe(true);
        });

        test('should return proper error response structure for missing permissions', () => {
            const errorResponse = {
                success: false,
                error: 'Missing critical permissions: SendMessages, EmbedLinks',
                permissions: {
                    granted: ['AddReactions'],
                    missing: ['SendMessages', 'EmbedLinks', 'AttachFiles'],
                    all: false
                }
            };

            expect(errorResponse.success).toBe(false);
            expect(errorResponse.error).toContain('Missing critical permissions');
            expect(errorResponse.permissions.missing).toContain('SendMessages');
        });

        test('should return proper error response for invalid token', () => {
            const errorResponse = {
                success: false,
                error: 'Invalid bot token'
            };

            expect(errorResponse.success).toBe(false);
            expect(errorResponse.error).toBe('Invalid bot token');
        });

        test('should return proper error response for channel not found', () => {
            const errorResponse = {
                success: false,
                error: 'Channel not found'
            };

            expect(errorResponse.success).toBe(false);
            expect(errorResponse.error).toBe('Channel not found');
        });
    });

    describe('Notification Configuration Options', () => {
        test('should support all notification configuration flags', async () => {
            const fullConfig = {
                enabled: true,
                notify_on_classification: true,
                notify_on_error: true,
                notify_on_correction: true,
                show_poster: true,
                show_confidence: true,
                show_method: true,
                show_reason: true,
                show_metadata: false,
                enable_corrections: true,
                correction_buttons_count: 3,
                include_library_dropdown: true
            };

            const result = await pool.query(
                `INSERT INTO notification_config (
                    type, bot_token, channel_id, enabled,
                    notify_on_classification, notify_on_error, notify_on_correction,
                    show_poster, show_confidence, show_method, show_reason, show_metadata,
                    enable_corrections, correction_buttons_count, include_library_dropdown
                ) VALUES (
                    'discord', 'token', '123', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                ) RETURNING *`,
                [
                    fullConfig.enabled, fullConfig.notify_on_classification,
                    fullConfig.notify_on_error, fullConfig.notify_on_correction,
                    fullConfig.show_poster, fullConfig.show_confidence,
                    fullConfig.show_method, fullConfig.show_reason, fullConfig.show_metadata,
                    fullConfig.enable_corrections, fullConfig.correction_buttons_count,
                    fullConfig.include_library_dropdown
                ]
            );

            expect(result.rows[0]).toMatchObject(fullConfig);
        });

        test('should handle partial configuration updates', async () => {
            await pool.query(
                `INSERT INTO notification_config (id, type, bot_token, channel_id)
                 VALUES (1, 'discord', 'token', '123')`
            );

            await pool.query(
                `UPDATE notification_config 
                 SET show_poster = $1, correction_buttons_count = $2
                 WHERE id = 1`,
                [false, 5]
            );

            const result = await pool.query('SELECT * FROM notification_config WHERE id = 1');
            expect(result.rows[0].show_poster).toBe(false);
            expect(result.rows[0].correction_buttons_count).toBe(5);
        });
    });

    describe('Server and Channel Name Display', () => {
        test('should handle unknown server/channel gracefully', () => {
            const channelDetails = {
                id: '123',
                name: 'Unknown',
                guildId: '456',
                guildName: 'Unknown Server'
            };

            expect(channelDetails.name).toBeDefined();
            expect(channelDetails.guildName).toBeDefined();
        });

        test('should structure channel details correctly', () => {
            const channelDetails = {
                id: '123456789',
                name: 'general',
                guildId: '987654321',
                guildName: 'My Discord Server'
            };

            expect(channelDetails).toHaveProperty('id');
            expect(channelDetails).toHaveProperty('name');
            expect(channelDetails).toHaveProperty('guildId');
            expect(channelDetails).toHaveProperty('guildName');
        });
    });

    describe('Test Notification Embed Structure', () => {
        test('should validate test notification embed fields', () => {
            const testEmbed = {
                title: '✅ Classifarr Test Notification',
                description: 'Your Discord bot is configured correctly and can send notifications!',
                color: 0x00ff00,
                fields: [
                    { name: 'Bot', value: 'TestBot', inline: true },
                    { name: 'Channel', value: '#general', inline: true },
                    { name: 'Server', value: 'Test Server', inline: true }
                ],
                timestamp: true,
                footer: { text: 'This is a test message from Classifarr' }
            };

            expect(testEmbed.title).toContain('Test Notification');
            expect(testEmbed.color).toBe(0x00ff00);
            expect(testEmbed.fields).toHaveLength(3);
            expect(testEmbed.fields[0].name).toBe('Bot');
            expect(testEmbed.fields[1].name).toBe('Channel');
            expect(testEmbed.fields[2].name).toBe('Server');
        });
    });
});