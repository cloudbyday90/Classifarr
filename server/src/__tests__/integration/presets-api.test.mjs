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
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { router: presetsRouter } = await import('../../routes/presets.mjs');
const app = express();
app.use(express.json());
app.use('/api/presets', presetsRouter);

describe('Custom Presets API Integration Tests', () => {
    let testPresetId;

    // Clean up any test presets before and after tests
    beforeAll(async () => {
        await db.query("DELETE FROM content_presets WHERE is_system = false AND name LIKE 'Test%'");
    });

    afterAll(async () => {
        await db.query("DELETE FROM content_presets WHERE is_system = false AND name LIKE 'Test%'");
    });

    describe('GET /api/presets/custom', () => {
        test('should return empty array initially', async () => {
            const response = await request(app)
                .get('/api/presets/custom')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/presets/custom', () => {
        test('should create a new custom preset', async () => {
            const newPreset = {
                name: 'Test Family Preset',
                description: 'A test preset for family content',
                icon: '👨‍👩‍👧',
                category: 'custom',
                signals: {
                    genres: {
                        prefer: ['Family', 'Comedy'],
                        exclude: ['Horror']
                    },
                    certifications: {
                        include: ['G', 'PG']
                    }
                }
            };

            const response = await request(app)
                .post('/api/presets/custom')
                .send(newPreset)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.name).toBe('Test Family Preset');
            expect(response.body.icon).toBe('👨‍👩‍👧');
            expect(response.body.signals).toHaveProperty('genres');
            expect(response.body.signals.genres.prefer).toContain('Family');
            expect(response.body.source).toBe('custom');

            testPresetId = response.body.id;

            const persistedPreset = await db.query(`
                SELECT id, key, is_system
                FROM content_presets
                WHERE id = $1
            `, [testPresetId]);

            expect(persistedPreset.rows[0].is_system).toBe(false);
            expect(persistedPreset.rows[0].key).toContain(`custom_${testPresetId}_`);
        });

        test('should fail without name', async () => {
            await request(app)
                .post('/api/presets/custom')
                .send({ description: 'Missing name' })
                .expect(400);
        });

        test('should fail with empty name', async () => {
            await request(app)
                .post('/api/presets/custom')
                .send({ name: '   ', description: 'Empty name' })
                .expect(400);
        });

        test('should fail with name over 100 characters', async () => {
            await request(app)
                .post('/api/presets/custom')
                .send({ name: 'A'.repeat(101) })
                .expect(400);
        });

        test('should fail with null signals', async () => {
            await request(app)
                .post('/api/presets/custom')
                .send({
                    name: 'Test Invalid Signals Preset',
                    signals: null
                })
                .expect(400);
        });
    });

    describe('GET /api/presets/custom/:id', () => {
        test('should return preset by ID', async () => {
            const response = await request(app)
                .get(`/api/presets/custom/${testPresetId}`)
                .expect(200);

            expect(response.body.id).toBe(testPresetId);
            expect(response.body.name).toBe('Test Family Preset');
        });

        test('should return 404 for non-existent preset', async () => {
            await request(app)
                .get('/api/presets/custom/999999')
                .expect(404);
        });
    });

    describe('PUT /api/presets/custom/:id', () => {
        test('should update preset', async () => {
            const updates = {
                name: 'Test Updated Preset',
                description: 'Updated description',
                signals: {
                    genres: {
                        prefer: ['Action', 'Adventure'],
                        exclude: ['Romance']
                    }
                }
            };

            const response = await request(app)
                .put(`/api/presets/custom/${testPresetId}`)
                .send(updates)
                .expect(200);

            expect(response.body.name).toBe('Test Updated Preset');
            expect(response.body.description).toBe('Updated description');
            expect(response.body.signals.genres.prefer).toContain('Action');
        });

        test('should return 404 for non-existent preset', async () => {
            await request(app)
                .put('/api/presets/custom/999999')
                .send({ name: 'Nonexistent' })
                .expect(404);
        });

        test('should fail with empty name', async () => {
            await request(app)
                .put(`/api/presets/custom/${testPresetId}`)
                .send({ name: '' })
                .expect(400);
        });

        test('should fail with array signals', async () => {
            await request(app)
                .put(`/api/presets/custom/${testPresetId}`)
                .send({ signals: ['bad'] })
                .expect(400);
        });
    });

    describe('GET /api/presets/all', () => {
        test('should return all presets including custom', async () => {
            const response = await request(app)
                .get('/api/presets/all')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);

            // Should include both builtin and custom
            const sources = [...new Set(response.body.map(p => p.source))];
            expect(sources).toContain('builtin');
            expect(sources).toContain('custom');
        });

        test('should filter by category', async () => {
            const response = await request(app)
                .get('/api/presets/all?category=genre')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach(preset => {
                if (preset.source === 'builtin') {
                    expect(preset.category).toBe('genre');
                }
            });
        });

        test('should search presets', async () => {
            const response = await request(app)
                .get('/api/presets/all?search=updated')
                .expect(200);

            // Should find our test preset
            const found = response.body.find(p => p.name.includes('Updated'));
            expect(found).toBeDefined();
            expect(found.source).toBe('custom');
        });
    });

    describe('DELETE /api/presets/custom/:id', () => {
        test('should delete preset', async () => {
            const response = await request(app)
                .delete(`/api/presets/custom/${testPresetId}`)
                .expect(200);

            expect(response.body.message).toContain('deleted');

            // Verify it's really deleted
            await request(app)
                .get(`/api/presets/custom/${testPresetId}`)
                .expect(404);
        });

        test('should return 404 for non-existent preset', async () => {
            await request(app)
                .delete('/api/presets/custom/999999')
                .expect(404);
        });
    });
});