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

describe('Database Schema Integration Test', () => {

    test('should have a clean database connection', async () => {
        const res = await db.query('SELECT 1 as val');
        expect(res.rows[0].val).toBe(1);
    });

    describe('Core Tables', () => {
        test('should have users table', async () => {
            const res = await db.query("SELECT to_regclass('users')");
            expect(res.rows[0].to_regclass).toBe('users');
        });

        test('should have settings table', async () => {
            const res = await db.query("SELECT to_regclass('settings')");
            expect(res.rows[0].to_regclass).toBe('settings');
        });
    });

    describe('Configuration Tables (Service Configs)', () => {
        test('should have ollama_config instead of ai_config', async () => {
            // Check ollama_config exists
            const ollama = await db.query("SELECT to_regclass('ollama_config')");
            expect(ollama.rows[0].to_regclass).toBe('ollama_config');

            // Check ai_config does NOT exist
            const ai = await db.query("SELECT to_regclass('ai_config')");
            expect(ai.rows[0].to_regclass).toBeNull();
        });

        test('ollama_config should have host and port columns', async () => {
            const res = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'ollama_config'
      `);
            const columns = res.rows.map(r => r.column_name);
            expect(columns).toContain('host');
            expect(columns).toContain('port');
            expect(columns).not.toContain('api_url'); // Old schema used api_url
        });

        test('should have radarr_config', async () => {
            const res = await db.query("SELECT to_regclass('radarr_config')");
            expect(res.rows[0].to_regclass).toBe('radarr_config');
        });

        test('should have sonarr_config', async () => {
            const res = await db.query("SELECT to_regclass('sonarr_config')");
            expect(res.rows[0].to_regclass).toBe('sonarr_config');
        });

        test('should have media_server', async () => {
            const res = await db.query("SELECT to_regclass('media_server')");
            expect(res.rows[0].to_regclass).toBe('media_server');
        });
    });

    describe('Classification History', () => {
        test('should have correct columns (library_id, metadata)', async () => {
            const res = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'classification_history'
      `);
            const columns = res.rows.map(r => r.column_name);

            expect(columns).toContain('library_id');
            expect(columns).toContain('metadata');
            expect(columns).toContain('confidence');

            // Ensure we don't have old columns
            expect(columns).not.toContain('selected_library');
            expect(columns).not.toContain('webhook_response');
            expect(columns).not.toContain('confidence_score');
        });
    });

    describe('System Check Queries', () => {
        test('System Health queries should execution without error', async () => {
            // Simulate system.js health checks
            await expect(db.query('SELECT id FROM ollama_config WHERE is_active = true LIMIT 1')).resolves.not.toThrow();
            await expect(db.query('SELECT id FROM radarr_config WHERE is_active = true LIMIT 1')).resolves.not.toThrow();
        });

        test('System Logs query should execute without error', async () => {
            // Simulate system.js logs query
            const query = `
        SELECT 
          ch.id,
          ch.title,
          ch.media_type,
          l.name as selected_library,
          ch.confidence as confidence_score,
          ch.created_at,
          ch.metadata as details
        FROM classification_history ch
        LEFT JOIN libraries l ON ch.library_id = l.id
        ORDER BY ch.created_at DESC
        LIMIT 10
      `;
            await expect(db.query(query)).resolves.not.toThrow();
        });
    });

});
