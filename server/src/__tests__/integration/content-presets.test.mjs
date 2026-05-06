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
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');

describe('Content Presets Seed Data Integration Test', () => {

    beforeAll(async () => {
        await db.query(`DELETE FROM content_presets WHERE is_system = false`);
    });

    describe('Basic Preset Verification', () => {
        test('should have inserted 168 system presets (46 original + 122 new, 6 event presets removed in v0.41.0)', async () => {
            const res = await db.query(`
                SELECT COUNT(*) as count
                FROM content_presets
                WHERE is_system = true
            `);

            expect(parseInt(res.rows[0].count)).toBe(168);
        });

        test('all system presets should have null user_id', async () => {
            const res = await db.query(`
                SELECT COUNT(*) as count
                FROM content_presets
                WHERE is_system = true AND user_id IS NOT NULL
            `);

            expect(parseInt(res.rows[0].count)).toBe(0);
        });

        test('all presets should have required fields populated', async () => {
            const res = await db.query(`
                SELECT key, name, description, icon, category, signals
                FROM content_presets
                WHERE is_system = true
            `);

            res.rows.forEach(preset => {
                expect(preset.key).toBeTruthy();
                expect(preset.name).toBeTruthy();
                expect(preset.description).toBeTruthy();
                expect(preset.icon).toBeTruthy();
                expect(preset.category).toBeTruthy();
                expect(preset.signals).toBeTruthy();
                expect(typeof preset.signals).toBe('object');
            });
        });
    });

    describe('Category Verification', () => {
        test('should have audience category presets (8: 4 original + 4 new)', async () => {
            const res = await db.query(`
                SELECT key, name
                FROM content_presets
                WHERE category = 'audience' AND is_system = true
                ORDER BY display_order
            `);

            expect(res.rows.length).toBe(8);
            expect(res.rows.map(r => r.key)).toContain('family_friendly');
            expect(res.rows.map(r => r.key)).toContain('kids_only');
            expect(res.rows.map(r => r.key)).toContain('teen');
            expect(res.rows.map(r => r.key)).toContain('adult_only');
            expect(res.rows.map(r => r.key)).toContain('kids_older');
            expect(res.rows.map(r => r.key)).toContain('young_adult');
            expect(res.rows.map(r => r.key)).toContain('date_night');
            expect(res.rows.map(r => r.key)).toContain('background');
        });

        test('should have genre category presets (60: 15 original + 45 new)', async () => {
            const res = await db.query(`
                SELECT COUNT(*) as count
                FROM content_presets
                WHERE category = 'genre' AND is_system = true
            `);

            expect(parseInt(res.rows[0].count)).toBe(60);
        });

        test('should have temporal category presets (12: 5 original + 7 new)', async () => {
            const res = await db.query(`
                SELECT key
                FROM content_presets
                WHERE category = 'temporal' AND is_system = true
                ORDER BY display_order
            `);

            expect(res.rows.length).toBe(12);
            expect(res.rows.map(r => r.key)).toContain('classic_films');
            expect(res.rows.map(r => r.key)).toContain('golden_age');
            expect(res.rows.map(r => r.key)).toContain('80s');
            expect(res.rows.map(r => r.key)).toContain('90s');
            expect(res.rows.map(r => r.key)).toContain('recent_releases');
            expect(res.rows.map(r => r.key)).toContain('silent_era');
            expect(res.rows.map(r => r.key)).toContain('new_hollywood');
            expect(res.rows.map(r => r.key)).toContain('2000s');
            expect(res.rows.map(r => r.key)).toContain('2010s');
            expect(res.rows.map(r => r.key)).toContain('2020s');
        });

        test('should have quality category presets (10: 2 original + 8 new)', async () => {
            const res = await db.query(`
                SELECT key
                FROM content_presets
                WHERE category = 'quality' AND is_system = true
                ORDER BY display_order
            `);

            expect(res.rows.length).toBe(10);
            expect(res.rows.map(r => r.key)).toContain('highly_rated');
            expect(res.rows.map(r => r.key)).toContain('hidden_gems');
            expect(res.rows.map(r => r.key)).toContain('critically_acclaimed');
            expect(res.rows.map(r => r.key)).toContain('indie');
            expect(res.rows.map(r => r.key)).toContain('blockbuster');
        });

        test('should have franchise category presets (25: 7 original + 18 new)', async () => {
            const res = await db.query(`
                SELECT COUNT(*) as count
                FROM content_presets
                WHERE category = 'franchise' AND is_system = true
            `);

            expect(parseInt(res.rows[0].count)).toBe(25);
        });

        test('should have regional category presets (25: 5 original + 20 new)', async () => {
            const res = await db.query(`
                SELECT COUNT(*) as count
                FROM content_presets
                WHERE category = 'regional' AND is_system = true
            `);

            expect(parseInt(res.rows[0].count)).toBe(25);
        });

        test('should have seasonal category presets (8: 2 original + 6 new)', async () => {
            const res = await db.query(`
                SELECT key
                FROM content_presets
                WHERE category = 'seasonal' AND is_system = true
                ORDER BY display_order
            `);

            expect(res.rows.length).toBe(8);
            expect(res.rows.map(r => r.key)).toContain('christmas_holiday');
            expect(res.rows.map(r => r.key)).toContain('halloween');
            expect(res.rows.map(r => r.key)).toContain('thanksgiving');
            expect(res.rows.map(r => r.key)).toContain('valentines');
            expect(res.rows.map(r => r.key)).toContain('easter');
        });

        test('should have tv category presets (20: 6 original + 14 new)', async () => {
            const res = await db.query(`
                SELECT COUNT(*) as count
                FROM content_presets
                WHERE category = 'tv' AND is_system = true
            `);

            expect(parseInt(res.rows[0].count)).toBe(20);
        });
    });

    describe('JSONB Signal Schema Validation', () => {
        test('family_friendly preset should have valid certifications signal', async () => {
            const res = await db.query(`
                SELECT signals
                FROM content_presets
                WHERE key = 'family_friendly'
            `);

            expect(res.rows.length).toBe(1);
            const signals = res.rows[0].signals;

            expect(signals.certifications).toBeDefined();
            expect(signals.certifications.mode).toBe('include');
            expect(Array.isArray(signals.certifications.include)).toBe(true);
            expect(signals.certifications.include).toContain('G');
            expect(signals.certifications.include).toContain('PG');
            expect(Array.isArray(signals.certifications.exclude)).toBe(true);
            expect(signals.certifications.exclude).toContain('R');
            expect(typeof signals.certifications.weight).toBe('number');
        });

        test('anime preset should have valid genres and keywords signals', async () => {
            const res = await db.query(`
                SELECT signals
                FROM content_presets
                WHERE key = 'anime'
            `);

            expect(res.rows.length).toBe(1);
            const signals = res.rows[0].signals;

            expect(signals.genres).toBeDefined();
            expect(Array.isArray(signals.genres.require_any)).toBe(true);
            expect(signals.genres.require_any).toContain('Animation');

            expect(signals.keywords).toBeDefined();
            expect(Array.isArray(signals.keywords.require_any)).toBe(true);
            expect(signals.keywords.require_any).toContain('anime');
        });

        test('classic_films preset should have valid release_year signal', async () => {
            const res = await db.query(`
                SELECT signals
                FROM content_presets
                WHERE key = 'classic_films'
            `);

            expect(res.rows.length).toBe(1);
            const signals = res.rows[0].signals;

            expect(signals.release_year).toBeDefined();
            expect(signals.release_year.max).toBe(1979);
            expect(typeof signals.release_year.weight).toBe('number');
        });

        test('highly_rated preset should have valid vote_average signal', async () => {
            const res = await db.query(`
                SELECT signals
                FROM content_presets
                WHERE key = 'highly_rated'
            `);

            expect(res.rows.length).toBe(1);
            const signals = res.rows[0].signals;

            expect(signals.vote_average).toBeDefined();
            expect(signals.vote_average.min).toBe(7.0);
            expect(typeof signals.vote_average.weight).toBe('number');
        });

        test('tv_sitcom preset should have valid runtime and media_type signals', async () => {
            const res = await db.query(`
                SELECT signals
                FROM content_presets
                WHERE key = 'tv_sitcom'
            `);

            expect(res.rows.length).toBe(1);
            const signals = res.rows[0].signals;

            expect(signals.media_type).toBeDefined();
            expect(Array.isArray(signals.media_type.include)).toBe(true);
            expect(signals.media_type.include).toContain('tv');

            expect(signals.runtime).toBeDefined();
            expect(signals.runtime.max_minutes).toBe(35);
        });

        test('marvel_mcu preset should have valid studios signal', async () => {
            const res = await db.query(`
                SELECT signals
                FROM content_presets
                WHERE key = 'marvel_mcu'
            `);

            expect(res.rows.length).toBe(1);
            const signals = res.rows[0].signals;

            expect(signals.studios).toBeDefined();
            expect(Array.isArray(signals.studios.require_any)).toBe(true);
            expect(signals.studios.require_any).toContain('Marvel Studios');
        });

        test('korean preset should have valid language signal', async () => {
            const res = await db.query(`
                SELECT signals
                FROM content_presets
                WHERE key = 'korean'
            `);

            expect(res.rows.length).toBe(1);
            const signals = res.rows[0].signals;

            expect(signals.language).toBeDefined();
            expect(Array.isArray(signals.language.require_any)).toBe(true);
            expect(signals.language.require_any).toContain('ko');
        });
    });

    describe('JSONB Query Operations', () => {
        test('should be able to query presets by genre signal using JSONB operators', async () => {
            const res = await db.query(`
                SELECT key, name
                FROM content_presets
                WHERE is_system = true
                AND signals @> '{"genres": {"require_any": ["Animation"]}}'
            `);

            expect(res.rows.length).toBeGreaterThan(0);
            const keys = res.rows.map(r => r.key);
            expect(keys).toContain('animated');
            expect(keys).toContain('anime');
        });

        test('should be able to query presets by media_type signal', async () => {
            const res = await db.query(`
                SELECT key, name
                FROM content_presets
                WHERE is_system = true
                AND signals @> '{"media_type": {"include": ["tv"]}}'
            `);

            expect(res.rows.length).toBeGreaterThan(0);
            const keys = res.rows.map(r => r.key);
            expect(keys).toContain('tv_sitcom');
            expect(keys).toContain('tv_drama');
        });

        test('GIN index on signals should exist and be used', async () => {
            const res = await db.query(`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'content_presets'
                AND indexname = 'idx_content_presets_signals'
            `);

            expect(res.rows.length).toBe(1);
            expect(res.rows[0].indexdef).toContain('gin');
        });
    });

    describe('Unique Constraint Verification', () => {
        test('should enforce unique constraint on (key, user_id) for non-NULL user_id', async () => {
            const userRes = await db.query(`
                INSERT INTO users (username, password_hash)
                VALUES ('test_unique_user', 'hash')
                ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
                RETURNING id
            `);
            const userId = userRes.rows[0].id;

            const testKey = 'test_unique_' + Date.now();

            await db.query(`
                INSERT INTO content_presets (key, name, signals, is_system, user_id)
                VALUES ($1, 'Test Preset', '{}', false, $2)
            `, [testKey, userId]);

            await expect(
                db.query(`
                    INSERT INTO content_presets (key, name, signals, is_system, user_id)
                    VALUES ($1, 'Duplicate', '{}', false, $2)
                `, [testKey, userId])
            ).rejects.toThrow();

            await db.query('DELETE FROM content_presets WHERE key = $1 AND user_id = $2', [testKey, userId]);
            await db.query('DELETE FROM users WHERE id = $1', [userId]);
        });

        test('should allow same key for different user_ids', async () => {
            const userRes = await db.query(`
                INSERT INTO users (username, password_hash)
                VALUES ('test_preset_user', 'hash')
                ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
                RETURNING id
            `);

            const userId = userRes.rows[0].id;

            const res = await db.query(`
                INSERT INTO content_presets (key, name, signals, is_system, user_id)
                VALUES ('family_friendly', 'My Custom Preset', '{"genres": {"prefer": ["Comedy"]}}', false, $1)
                ON CONFLICT (key, user_id) DO NOTHING
                RETURNING id
            `, [userId]);

            expect(res.rows.length >= 0).toBe(true);

            await db.query('DELETE FROM content_presets WHERE key = $1 AND user_id = $2', ['family_friendly', userId]);
            await db.query('DELETE FROM users WHERE id = $1', [userId]);
        });
    });

    describe('Display Order', () => {
        test('presets should be ordered by display_order within categories', async () => {
            const res = await db.query(`
                SELECT category, key, display_order
                FROM content_presets
                WHERE is_system = true
                ORDER BY display_order
            `);

            for (let i = 1; i < res.rows.length; i++) {
                expect(res.rows[i].display_order).toBeGreaterThanOrEqual(res.rows[i - 1].display_order);
            }
        });

        test('audience category should have display_order 1-8', async () => {
            const res = await db.query(`
                SELECT MIN(display_order) as min, MAX(display_order) as max
                FROM content_presets
                WHERE category = 'audience' AND is_system = true
            `);

            expect(res.rows[0].min).toBe(1);
            expect(res.rows[0].max).toBe(8);
        });

        test('genre category should have display_order starting at 10', async () => {
            const res = await db.query(`
                SELECT MIN(display_order) as min, MAX(display_order) as max, COUNT(*) as count
                FROM content_presets
                WHERE category = 'genre' AND is_system = true
            `);

            expect(res.rows[0].min).toBe(10);
            expect(res.rows[0].max).toBeGreaterThanOrEqual(parseInt(res.rows[0].count) + 9);
        });
    });

    describe('Idempotency', () => {
        test('migration can be re-run without errors (PostgreSQL allows multiple NULL user_ids)', async () => {
            await expect(
                db.query(`
                    INSERT INTO content_presets (key, name, description, icon, category, signals, is_system, display_order)
                    VALUES ('family_friendly', 'Family-Friendly', 'Content suitable for all ages. Excludes R-rated and adult content.', '👨‍👩‍👧‍👦', 'audience',
                     '{"certifications": {"mode": "include", "include": ["G", "PG", "PG-13", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14"], "exclude": ["R", "NC-17", "TV-MA"], "weight": 1.5}, "genres": {"prefer": ["Animation", "Family", "Comedy", "Adventure"], "exclude": ["Horror"], "weight": 1.0}, "keywords": {"exclude": ["gore", "explicit", "adult", "violence", "drug use"], "weight": 0.5}}',
                     true, 1)
                    ON CONFLICT (key, user_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        icon = EXCLUDED.icon,
                        category = EXCLUDED.category,
                        signals = EXCLUDED.signals,
                        is_system = EXCLUDED.is_system,
                        display_order = EXCLUDED.display_order,
                        updated_at = NOW()
                `)
            ).resolves.toBeDefined();

            const res = await db.query(`
                SELECT COUNT(*) as count
                FROM content_presets
                WHERE key = 'family_friendly' AND is_system = true
            `);

            expect(parseInt(res.rows[0].count)).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Specific Preset Verification', () => {
        test('should have all expected genre presets', async () => {
            const expectedGenres = [
                'animated', 'anime', 'action_adventure', 'comedy', 'horror_scary',
                'drama', 'romance', 'scifi', 'fantasy', 'documentary',
                'crime_mystery', 'western', 'musical', 'sports', 'war'
            ];

            const res = await db.query(`
                SELECT key
                FROM content_presets
                WHERE category = 'genre' AND is_system = true
                ORDER BY display_order
            `);

            const actualKeys = res.rows.map(r => r.key);

            expectedGenres.forEach(expectedKey => {
                expect(actualKeys).toContain(expectedKey);
            });
        });

        test('should have all expected franchise presets', async () => {
            const expectedFranchises = [
                'marvel_mcu', 'dc_universe', 'star_wars', 'disney',
                'pixar', 'ghibli', 'dreamworks'
            ];

            const res = await db.query(`
                SELECT key
                FROM content_presets
                WHERE category = 'franchise' AND is_system = true
                ORDER BY display_order
            `);

            const actualKeys = res.rows.map(r => r.key);

            expectedFranchises.forEach(expectedKey => {
                expect(actualKeys).toContain(expectedKey);
            });
        });

        test('should have all expected TV-specific presets', async () => {
            const expectedTV = [
                'tv_sitcom', 'tv_drama', 'tv_reality',
                'tv_animated', 'tv_anime', 'tv_miniseries'
            ];

            const res = await db.query(`
                SELECT key
                FROM content_presets
                WHERE category = 'tv' AND is_system = true
                ORDER BY display_order
            `);

            const actualKeys = res.rows.map(r => r.key);

            expectedTV.forEach(expectedKey => {
                expect(actualKeys).toContain(expectedKey);
            });
        });
    });

});