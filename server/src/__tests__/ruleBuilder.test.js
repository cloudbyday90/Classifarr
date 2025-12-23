/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const ruleBuilderService = require('../services/ruleBuilder');
const db = require('../config/database');

// Mock the DB
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

// Mock contentTypeAnalyzer (which might use ollama internally, but we mock that separately)
jest.mock('../services/contentTypeAnalyzer', () => ({
    analyzeContent: jest.fn().mockResolvedValue({})
}));

describe('RuleBuilderService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('previewRule', () => {
        test('should build correct SQL for basic title match', async () => {
            const criteria = [
                { field: 'title', operator: 'contains', value: 'The Matrix' }
            ];

            db.query.mockResolvedValue({ rows: [] });

            await ruleBuilderService.previewRule(1, criteria);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("AND LOWER(title) LIKE LOWER($2)"),
                expect.arrayContaining([1, '%The Matrix%'])
            );
        });

        test('should build correct SQL for content type match', async () => {
            const criteria = [
                { field: 'content_type', operator: 'equals', value: 'holiday' }
            ];

            db.query.mockResolvedValue({ rows: [] });

            await ruleBuilderService.previewRule(1, criteria);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("AND metadata->'content_analysis'->>'type' = $2"),
                expect.arrayContaining([1, 'holiday'])
            );
        });

        test('should build correct SQL for greater_than operator', async () => {
            const criteria = [
                { field: 'year', operator: 'greater_than', value: '2000' }
            ];

            db.query.mockResolvedValue({ rows: [] });

            await ruleBuilderService.previewRule(1, criteria);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("AND year > $2"),
                expect.arrayContaining([1, 2000])
            );
        });

        test('should handle contains operator (case insensitive)', async () => {
            const criteria = [
                { field: 'title', operator: 'contains', value: 'star' }
            ];

            db.query.mockResolvedValue({ rows: [] });

            await ruleBuilderService.previewRule(1, criteria);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("AND LOWER(title) LIKE LOWER($2)"),
                expect.arrayContaining([1, '%star%'])
            );
        });

        test('should handle multiple criteria (AND logic)', async () => {
            const criteria = [
                { field: 'title', operator: 'contains', value: 'Christmas' },
                { field: 'year', operator: 'greater_than', value: '1990' }
            ];

            db.query.mockResolvedValue({ rows: [] });

            await ruleBuilderService.previewRule(1, criteria);

            const queryCalls = db.query.mock.calls[0];
            const sql = queryCalls[0];
            const params = queryCalls[1];

            expect(sql).toContain("AND LOWER(title) LIKE LOWER($2)");
            expect(sql).toContain("AND year > $3");
            expect(params).toEqual([1, '%Christmas%', 1990]);
        });

        test('previewRule generates correct SQL for is_one_of content_type', async () => {
            const criteria = [{
                field: 'content_type',
                operator: 'is_one_of',
                value: ['holiday', 'standup']
            }];

            db.query.mockResolvedValue({
                rows: [
                    { id: 1, title: 'Holiday Special', metadata: { content_analysis: { type: 'holiday' } } },
                    { id: 2, title: 'Comedy Night', metadata: { content_analysis: { type: 'standup' } } }
                ]
            });

            await ruleBuilderService.previewRule(1, criteria);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("metadata->'content_analysis'->>'type' = ANY($2)"),
                expect.arrayContaining([1, ['holiday', 'standup']])
            );
        });
    });
});
