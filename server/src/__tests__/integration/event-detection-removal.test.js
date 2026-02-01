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

const db = require('../../config/database');
const fs = require('fs');
const path = require('path');

describe('Event Detection Removal Migration Tests (v0.41.0)', () => {
    describe('Migration 072: Event Detection System Removal', () => {
        test('should verify event detection columns are removed from libraries table', async () => {
            const result = await db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'libraries' 
                  AND column_name IN ('event_detection_type', 'event_sub_type')
            `);

            // Should have no event detection columns
            expect(result.rows.length).toBe(0);
        });

        test('should verify no event presets exist in content_presets', async () => {
            const result = await db.query(`
                SELECT key 
                FROM content_presets 
                WHERE key LIKE 'event_%'
            `);

            // Should have no event presets
            expect(result.rows.length).toBe(0);
        });

        test('should verify no policy references to event presets exist', async () => {
            const result = await db.query(`
                SELECT pp.* 
                FROM policy_presets pp
                LEFT JOIN content_presets cp ON pp.preset_id = cp.id
                WHERE cp.key LIKE 'event_%'
            `);

            // Should have no policy references to event presets
            expect(result.rows.length).toBe(0);
        });

        test('should verify migration 072 file exists and contains correct SQL', async () => {
            const migrationPath = path.join(__dirname, '../../../database/migrations/072_remove_event_detection.sql');
            expect(fs.existsSync(migrationPath)).toBe(true);

            const migrationContent = fs.readFileSync(migrationPath, 'utf8');
            
            // Verify it drops the columns
            expect(migrationContent).toContain('DROP COLUMN IF EXISTS event_detection_type');
            expect(migrationContent).toContain('DROP COLUMN IF EXISTS event_sub_type');
            
            // Verify it deletes event presets
            expect(migrationContent).toContain("DELETE FROM content_presets");
            expect(migrationContent).toContain("'event_holiday'");
            expect(migrationContent).toContain("'event_sports'");
            expect(migrationContent).toContain("'event_ppv'");
            expect(migrationContent).toContain("'event_concert'");
            expect(migrationContent).toContain("'event_standup'");
            expect(migrationContent).toContain("'event_awards'");
            
            // Verify it deletes policy references
            expect(migrationContent).toContain("DELETE FROM policy_presets");
        });
    });

    describe('Event Detection System Deprecated Features', () => {
        test('detectEventContent method should no longer exist', () => {
            const classificationService = require('../../services/classification');
            
            // Method should not exist anymore
            expect(classificationService.detectEventContent).toBeUndefined();
        });

        test('checkLibraryRulesForExceptions method should no longer exist', () => {
            const classificationService = require('../../services/classification');
            
            // Method should not exist anymore
            expect(classificationService.checkLibraryRulesForExceptions).toBeUndefined();
        });

        test('detectEventTypesFromMetadata should still exist (used by library rules)', () => {
            const classificationService = require('../../services/classification');
            
            // This method should still exist as it's used for rule condition evaluation
            expect(typeof classificationService.detectEventTypesFromMetadata).toBe('function');
        });
    });

    describe('Library API Event Detection Fields', () => {
        let testLibraryId;
        let testMediaServerId;

        beforeAll(async () => {
            // Create test media server
            const serverRes = await db.query(`
                INSERT INTO media_server (type, name, url, api_key)
                VALUES ('plex', 'Test Migration Server', 'http://localhost:32400', 'test-migration-key')
                RETURNING id
            `);
            testMediaServerId = serverRes.rows[0].id;

            // Create test library
            const libRes = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
                VALUES ($1, 'test-migration-lib-' || gen_random_uuid()::text, 'Test Migration Library', 'movie', true)
                RETURNING id
            `, [testMediaServerId]);
            testLibraryId = libRes.rows[0].id;
        });

        afterAll(async () => {
            if (testLibraryId) {
                await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
            }
            if (testMediaServerId) {
                await db.query('DELETE FROM media_server WHERE id = $1', [testMediaServerId]);
            }
        });

        test('should verify libraries table no longer has event detection columns', async () => {
            const result = await db.query(`
                SELECT * FROM libraries WHERE id = $1
            `, [testLibraryId]);

            expect(result.rows.length).toBe(1);
            const library = result.rows[0];
            
            // Event detection fields should not exist
            expect(library.event_detection_type).toBeUndefined();
            expect(library.event_sub_type).toBeUndefined();
        });
    });

    describe('Policy Engine Event Presets', () => {
        test('should verify event category presets are removed', async () => {
            const result = await db.query(`
                SELECT key, name, category 
                FROM content_presets 
                WHERE category = 'events'
            `);

            // Should have no presets in the 'events' category
            expect(result.rows.length).toBe(0);
        });

        test('should verify other preset categories are unaffected', async () => {
            const result = await db.query(`
                SELECT DISTINCT category 
                FROM content_presets 
                WHERE category != 'events' AND is_system = true
                ORDER BY category
            `);

            // Should still have other categories (this verifies we didn't delete everything)
            expect(result.rows.length).toBeGreaterThan(0);
        });
    });
});
