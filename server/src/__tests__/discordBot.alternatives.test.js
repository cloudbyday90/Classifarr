/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/clarificationService', () => ({}));
jest.mock('../services/autoLearningService', () => ({}));

const discordBot = require('../services/discordBot');

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
});

