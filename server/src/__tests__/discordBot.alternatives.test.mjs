/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
    query: jest.fn()
};

const mockClarificationService = {};

const mockAutoLearningService = {};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/clarificationService.mjs', () => createNamedMockModule('clarificationService', mockClarificationService));

jest.unstable_mockModule('../services/autoLearningService.mjs', () => createNamedMockModule('autoLearningService', mockAutoLearningService));

const { discordBotService: discordBot } = await import('../services/discordBot.mjs');

describe('discordBot top alternatives formatting', () => {
    test('uses clarification candidate scores and excludes selected library', () => {
        const result = {
            library_id: 1,
            library_name: 'Movies',
            clarification: {
                meta: {
                    candidates: [
                        { library_id: 1, library_name: 'Movies', score: 95 },
                        { library_id: 3, library_name: 'Comedy', score: 62.5 },
                        { library_id: 2, library_name: 'Family', score: 40 }
                    ]
                }
            },
            libraries: [
                { id: 9, name: 'Fallback Library', score: 10 }
            ]
        };

        const alternatives = discordBot.getTopAlternatives(result, 3);

        expect(alternatives).toEqual([
            { id: 3, name: 'Comedy', score: 62.5 },
            { id: 2, name: 'Family', score: 40 }
        ]);
    });

    test('renders alternatives without ?% when scores are unavailable', async () => {
        const metadata = {
            title: 'No Scores Example',
            year: 2026,
            media_type: 'movie',
            genres: []
        };
        const result = {
            library_name: 'Movies',
            confidence: 85,
            method: 'ai_analysis',
            libraries: [
                { id: 1, name: 'Movies' },
                { id: 2, name: 'Family' },
                { id: 3, name: 'Comedy' }
            ]
        };
        const tier = { tier: 'auto', description: 'Policy threshold met - auto route' };

        const embed = await discordBot.createTieredEmbed(metadata, result, tier, false, false);
        const fields = embed.toJSON().fields || [];
        const alternativesField = fields.find((field) => field.name === '📊 Top Alternatives');

        expect(alternativesField).toBeDefined();
        expect(alternativesField.value).toContain('Family');
        expect(alternativesField.value).toContain('Comedy');
        expect(alternativesField.value).not.toContain('?%');
    });

    test('falls back to top alternative when suggested library name is missing', async () => {
        const metadata = {
            title: 'One Mile: Chapter Two',
            year: 2026,
            media_type: 'movie',
            genres: ['Action', 'Crime']
        };
        const result = {
            library_name: undefined,
            confidence: 30.94,
            method: 'queued_for_retry',
            policy_question: {
                meta: {
                    candidates: [
                        { library_id: 15, library_name: 'Movies', score: 30.94 },
                        { library_id: 11, library_name: 'Anime Movies', score: 12.64 }
                    ]
                }
            }
        };
        const tier = { tier: 'manual', description: 'Request manual library selection' };

        const embed = await discordBot.createTieredEmbed(metadata, result, tier, false, false);
        const description = embed.toJSON().description || '';

        expect(description).toContain('Suggested library: Movies');
        expect(description).not.toContain('Suggested library: undefined');
    });
});
describe('discordBot.sendSystemAlert — Issue #330 Gap 5.6', () => {
    beforeEach(() => {
        // Reset cooldown map between tests by clearing any prior alerts
        // (The map is module-scoped but we can work around it by using unique service keys per test)
        discordBot.isInitialized = false;
        discordBot.client = null;
        discordBot.channelId = null;
    });

    it('does nothing when the bot is not initialized', async () => {
        discordBot.isInitialized = false;
        discordBot.client = null;
        // Should resolve without throwing
        await expect(discordBot.sendSystemAlert('imageEmbeddings', 'disconnected', 'connected')).resolves.toBeUndefined();
    });

    it('does nothing when notify_on_system_errors is false', async () => {
        discordBot.isInitialized = true;
        const mockChannel = { send: jest.fn() };
        discordBot.client = { channels: { fetch: jest.fn().mockResolvedValue(mockChannel) } };
        discordBot.channelId = 'chan-1';
        discordBot.loadConfig = jest.fn().mockResolvedValue({ notify_on_system_errors: false });

        await discordBot.sendSystemAlert('svc_flag_test', 'degraded', 'connected');

        expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('sends an embed with red color for disconnected status', async () => {
        discordBot.isInitialized = true;
        const mockChannel = { send: jest.fn().mockResolvedValue({}) };
        discordBot.client = { channels: { fetch: jest.fn().mockResolvedValue(mockChannel) } };
        discordBot.channelId = 'chan-1';
        discordBot.loadConfig = jest.fn().mockResolvedValue({ notify_on_system_errors: true });

        await discordBot.sendSystemAlert('svc_disconnected_test', 'disconnected', 'connected');

        expect(mockChannel.send).toHaveBeenCalledTimes(1);
        const sentEmbeds = mockChannel.send.mock.calls[0][0].embeds;
        expect(sentEmbeds).toHaveLength(1);
        const embedJson = sentEmbeds[0].toJSON();
        expect(embedJson.color).toBe(0xE74C3C); // red
        expect(embedJson.title).toContain('Disconnected');
    });

    it('sends an embed with green color for recovery (connected)', async () => {
        discordBot.isInitialized = true;
        const mockChannel = { send: jest.fn().mockResolvedValue({}) };
        discordBot.client = { channels: { fetch: jest.fn().mockResolvedValue(mockChannel) } };
        discordBot.channelId = 'chan-1';
        discordBot.loadConfig = jest.fn().mockResolvedValue({ notify_on_system_errors: true });

        await discordBot.sendSystemAlert('svc_recovery_test', 'connected', 'disconnected');

        const sentEmbeds = mockChannel.send.mock.calls[0][0].embeds;
        const embedJson = sentEmbeds[0].toJSON();
        expect(embedJson.color).toBe(0x2ECC71); // green
        expect(embedJson.title).toContain('Recovered');
    });

    it('sends a yellow embed for degraded status', async () => {
        discordBot.isInitialized = true;
        const mockChannel = { send: jest.fn().mockResolvedValue({}) };
        discordBot.client = { channels: { fetch: jest.fn().mockResolvedValue(mockChannel) } };
        discordBot.channelId = 'chan-1';
        discordBot.loadConfig = jest.fn().mockResolvedValue({ notify_on_system_errors: true });

        await discordBot.sendSystemAlert('svc_degraded_test', 'degraded', 'connected');

        const sentEmbeds = mockChannel.send.mock.calls[0][0].embeds;
        const embedJson = sentEmbeds[0].toJSON();
        expect(embedJson.color).toBe(0xF0A500); // yellow
        expect(embedJson.title).toContain('Degraded');
    });

    it('recovery alert bypasses the 15-minute cooldown', async () => {
        discordBot.isInitialized = true;
        const mockChannel = { send: jest.fn().mockResolvedValue({}) };
        discordBot.client = { channels: { fetch: jest.fn().mockResolvedValue(mockChannel) } };
        discordBot.channelId = 'chan-1';
        discordBot.loadConfig = jest.fn().mockResolvedValue({ notify_on_system_errors: true });

        // First call: degraded (sets cooldown)
        await discordBot.sendSystemAlert('svc_cooldown_test', 'degraded', 'connected');
        // Second call immediately: still degraded — should be suppressed by cooldown
        await discordBot.sendSystemAlert('svc_cooldown_test', 'degraded', 'connected');
        // Third call: recovery — should bypass cooldown and send
        await discordBot.sendSystemAlert('svc_cooldown_test', 'connected', 'degraded');

        // Only 2 sends: first degraded + recovery; second degraded is suppressed
        expect(mockChannel.send).toHaveBeenCalledTimes(2);
    });

    it('does not throw when Discord send fails — swallows the error', async () => {
        discordBot.isInitialized = true;
        const mockChannel = { send: jest.fn().mockRejectedValue(new Error('discord send failed')) };
        discordBot.client = { channels: { fetch: jest.fn().mockResolvedValue(mockChannel) } };
        discordBot.channelId = 'chan-1';
        discordBot.loadConfig = jest.fn().mockResolvedValue({ notify_on_system_errors: true });

        await expect(
            discordBot.sendSystemAlert('svc_throw_test', 'error', 'connected')
        ).resolves.toBeUndefined();
    });
});