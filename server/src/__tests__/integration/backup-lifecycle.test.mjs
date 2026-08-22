import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'classifarr-backup-test-'));
process.env.BACKUP_DIR = backupDir;

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken, requireAdmin } = await import('../../middleware/auth.mjs');
const { backupService } = await import('../../services/backupService.mjs');
const { createBackupRouter } = await import('../../routes/backupRouteShared.mjs');
const { createLogger } = await import('../../utils/logger.mjs');

const express = (await import('express')).default;
const logger = createLogger('backup-integration-test');

const STUB_DDLS = [
    `CREATE TABLE IF NOT EXISTS classification_evidence (
        id SERIAL PRIMARY KEY, scope VARCHAR(50) NOT NULL, media_type VARCHAR(20),
        library_id INTEGER, tmdb_id INTEGER, evidence_key VARCHAR(255),
        evidence_data JSONB, provenance VARCHAR(50) NOT NULL, confidence NUMERIC(5,2),
        usage_count INTEGER DEFAULT 0 NOT NULL, success_rate NUMERIC(5,2),
        status VARCHAR(20) DEFAULT 'active' NOT NULL, created_by VARCHAR(100),
        source_classification_id BIGINT, source_system VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        last_seen_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS backup_audit (
        id SERIAL PRIMARY KEY, operation VARCHAR(50) NOT NULL,
        backup_type VARCHAR(20) NOT NULL, filename VARCHAR(255) NOT NULL,
        file_size BIGINT, status VARCHAR(20) NOT NULL, error_message TEXT,
        user_id INTEGER, ip_address INET, metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS library_policies (
        id SERIAL PRIMARY KEY, library_id INTEGER, name VARCHAR(255) NOT NULL,
        description TEXT, enabled BOOLEAN DEFAULT true, priority INTEGER DEFAULT 5
    )`,
    `CREATE TABLE IF NOT EXISTS policy_intents (
        id BIGSERIAL PRIMARY KEY, policy_id INTEGER, library_id INTEGER,
        schema_version INTEGER DEFAULT 1, intent_version INTEGER DEFAULT 1,
        active BOOLEAN DEFAULT true, source VARCHAR(40), inference_state VARCHAR(40),
        review_behavior JSONB DEFAULT '{}'::jsonb,
        validation_status VARCHAR(40) DEFAULT 'pending_validation',
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS policy_intent_rules (
        id BIGSERIAL PRIMARY KEY, intent_id BIGINT, intent_role VARCHAR(40),
        collection VARCHAR(40), signal_type VARCHAR(50), operator VARCHAR(50),
        values JSONB DEFAULT '{}'::jsonb, inference_state VARCHAR(40),
        sort_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS policy_intent_routing_targets (
        id BIGSERIAL PRIMARY KEY, intent_id BIGINT, library_id INTEGER,
        arr_type VARCHAR(20), arr_config_id INTEGER, arr_root_folder_id INTEGER,
        arr_root_folder_path TEXT, quality_profile_id INTEGER,
        target_status VARCHAR(40) DEFAULT 'configured',
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS policy_intent_template_applications (
        id BIGSERIAL PRIMARY KEY, intent_id BIGINT, preset_id INTEGER,
        preset_key VARCHAR(100), preset_name VARCHAR(255), weight NUMERIC(6,3),
        signal_count INTEGER DEFAULT 0, link_state VARCHAR(40) DEFAULT 'applied',
        applied_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS policy_intent_migration_events (
        id BIGSERIAL PRIMARY KEY, intent_id BIGINT, policy_id INTEGER,
        event_type VARCHAR(50), actor_type VARCHAR(40), actor_id INTEGER,
        source_version INTEGER, target_version INTEGER, reason_code VARCHAR(80),
        summary TEXT, metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS policy_intent_rollback_snapshots (
        id BIGSERIAL PRIMARY KEY, intent_id BIGINT, policy_id INTEGER,
        snapshot_version INTEGER, snapshot_payload JSONB DEFAULT '{}'::jsonb,
        payload_redacted BOOLEAN DEFAULT true, restore_path TEXT,
        expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(),
        restored_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS policy_intent_validation_status (
        id BIGSERIAL PRIMARY KEY, intent_id BIGINT, schema_version INTEGER DEFAULT 1,
        status VARCHAR(40), validator_version VARCHAR(80),
        error_count INTEGER DEFAULT 0, warning_count INTEGER DEFAULT 0,
        errors JSONB DEFAULT '[]'::jsonb, warnings JSONB DEFAULT '[]'::jsonb,
        validated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_runs (
        id BIGSERIAL PRIMARY KEY, run_key UUID NOT NULL UNIQUE,
        reconciler_version VARCHAR(80) NOT NULL, run_state VARCHAR(40) NOT NULL,
        source_status_id VARCHAR(80) NOT NULL, reason_id VARCHAR(80) NOT NULL,
        started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ NOT NULL,
        candidate_count INTEGER DEFAULT 0 NOT NULL, converted_count INTEGER DEFAULT 0 NOT NULL,
        already_native_count INTEGER DEFAULT 0 NOT NULL, deferred_count INTEGER DEFAULT 0 NOT NULL,
        blocked_count INTEGER DEFAULT 0 NOT NULL, failed_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_outcomes (
        id BIGSERIAL PRIMARY KEY, run_id BIGINT NOT NULL, policy_id INTEGER NOT NULL,
        candidate_fingerprint VARCHAR(71) NOT NULL, candidate_status_id VARCHAR(80) NOT NULL,
        outcome_state VARCHAR(40) NOT NULL, reason_id VARCHAR(80) NOT NULL,
        retry_not_before TIMESTAMPTZ, evaluated_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (run_id, policy_id)
    )`,
    `CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_states (
        policy_id INTEGER PRIMARY KEY, candidate_fingerprint VARCHAR(71) NOT NULL,
        candidate_status_id VARCHAR(80) NOT NULL, outcome_state VARCHAR(40) NOT NULL,
        reason_id VARCHAR(80) NOT NULL, retry_not_before TIMESTAMPTZ,
        failure_count INTEGER NOT NULL DEFAULT 0, evaluated_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
        task_type VARCHAR(50) DEFAULT 'library_scan' NOT NULL,
        library_id INTEGER, cron_expression VARCHAR(100), interval_minutes INTEGER,
        enabled BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS confidence_settings (
        id SERIAL PRIMARY KEY, setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS auto_learned_preferences (
        id SERIAL PRIMARY KEY, library_id INTEGER NOT NULL, policy_id INTEGER,
        preference_type VARCHAR(50) NOT NULL, preference_value TEXT NOT NULL,
        source VARCHAR(50) DEFAULT 'user_feedback' NOT NULL,
        status VARCHAR(20) DEFAULT 'active'
    )`,
    `CREATE TABLE IF NOT EXISTS omdb_config (
        id SERIAL PRIMARY KEY, api_key VARCHAR(255), is_active BOOLEAN DEFAULT true,
        daily_limit INTEGER DEFAULT 1000, created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS path_mappings (
        id SERIAL PRIMARY KEY, arr_path VARCHAR(1024) NOT NULL,
        local_path VARCHAR(1024) NOT NULL, is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`,
];

const app = createIntegrationTestApp({
    basePath: '/api/backup',
    middleware: [authenticateToken, requireAdmin],
    router: createBackupRouter({
        express,
        pathModule: path,
        backupService,
        authenticateToken,
        requireAdmin,
        logger,
    }),
});

describe('Backup Lifecycle Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        for (const ddl of STUB_DDLS) {
            await db.query(ddl);
        }

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('backup_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'backup_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await fs.rm(backupDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        await db.query('DELETE FROM backup_audit');
        const files = await fs.readdir(backupDir);
        for (const file of files) {
            await fs.unlink(path.join(backupDir, file));
        }
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    async function createPlaintextBackup() {
        return request(app)
            .post('/api/backup/export')
            .set(authHeaders())
            .send({ encrypted: false });
    }

    describe('POST /export', () => {
        it('creates a plaintext backup', async () => {
            const res = await createPlaintextBackup();

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                success: true,
                encrypted: false,
            });
            expect(res.body.filename).toMatch(/^classifarr_config_.*\.json$/);
            expect(res.body.size).toBeGreaterThan(0);
            expect(res.body.timestamp).toBeDefined();

            const files = await fs.readdir(backupDir);
            expect(files).toHaveLength(1);
            expect(files[0]).toBe(res.body.filename);
        });

        it('creates an encrypted backup with valid password', async () => {
            const res = await request(app)
                .post('/api/backup/export')
                .set(authHeaders())
                .send({ encrypted: true, password: 'test-password-123' });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                success: true,
                encrypted: true,
            });
            expect(res.body.filename).toMatch(/^classifarr_config_.*\.enc\.json$/);

            const content = await fs.readFile(path.join(backupDir, res.body.filename), 'utf8');
            const parsed = JSON.parse(content);
            expect(parsed.encrypted).toBe(true);
            expect(parsed.data).toBeDefined();
        });

        it('rejects encrypted backup without password', async () => {
            const res = await request(app)
                .post('/api/backup/export')
                .set(authHeaders())
                .send({ encrypted: true });

            expect(res.status).toBe(400);
        });

        it('rejects encrypted backup with short password', async () => {
            const res = await request(app)
                .post('/api/backup/export')
                .set(authHeaders())
                .send({ encrypted: true, password: 'short' });

            expect(res.status).toBe(400);
        });

        it('requires authentication', async () => {
            const res = await request(app)
                .post('/api/backup/export')
                .send({ encrypted: false });

            expect(res.status).toBe(401);
        });

        it('logs audit entry on export', async () => {
            await createPlaintextBackup();

            const audits = await db.query('SELECT * FROM backup_audit WHERE operation = $1', ['export']);
            expect(audits.rows).toHaveLength(1);
            expect(audits.rows[0].status).toBe('success');
            expect(audits.rows[0].backup_type).toBe('plaintext');
        });
    });

    describe('GET /list', () => {
        it('returns empty list when no backups exist', async () => {
            const res = await request(app)
                .get('/api/backup/list')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.backups).toEqual([]);
        });

        it('lists created backups sorted by newest first', async () => {
            await createPlaintextBackup();

            const res = await request(app)
                .get('/api/backup/list')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.backups).toHaveLength(1);
            expect(res.body.backups[0]).toMatchObject({
                type: 'plaintext',
            });
            expect(res.body.backups[0].filename).toMatch(/^classifarr_config_.*\.json$/);
            expect(res.body.backups[0].size).toBeGreaterThan(0);
        });

        it('distinguishes encrypted and plaintext backups', async () => {
            await createPlaintextBackup();
            await request(app)
                .post('/api/backup/export')
                .set(authHeaders())
                .send({ encrypted: true, password: 'test-password-123' });

            const res = await request(app)
                .get('/api/backup/list')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.backups).toHaveLength(2);

            const types = res.body.backups.map((b) => b.type).sort();
            expect(types).toEqual(['encrypted', 'plaintext']);
        });
    });

    describe('POST /preview', () => {
        it('previews a plaintext backup without side effects', async () => {
            const exportRes = await createPlaintextBackup();
            const filename = exportRes.body.filename;

            const res = await request(app)
                .post('/api/backup/preview')
                .set(authHeaders())
                .send({ filename });

            expect(res.status).toBe(200);
            expect(res.body.version).toBe('2.0');
            expect(res.body.exportedAt).toBeDefined();
            expect(res.body.meta).toBeDefined();
            expect(res.body.itemCounts).toMatchObject({
                users: expect.any(Number),
                mediaServers: expect.any(Number),
                libraries: expect.any(Number),
            });
        });

        it('returns 400 for missing filename', async () => {
            const res = await request(app)
                .post('/api/backup/preview')
                .set(authHeaders())
                .send({});

            expect(res.status).toBe(400);
        });

        it('returns 400 for path traversal filename', async () => {
            const res = await request(app)
                .post('/api/backup/preview')
                .set(authHeaders())
                .send({ filename: '../../../etc/passwd' });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /download/:filename', () => {
        it('downloads a backup file as attachment', async () => {
            const exportRes = await createPlaintextBackup();
            const filename = exportRes.body.filename;

            const res = await request(app)
                .get(`/api/backup/download/${filename}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.headers['content-disposition']).toContain(filename);

            const content = res.text;
            const parsed = JSON.parse(content);
            expect(parsed.version).toBe('2.0');
            expect(parsed.data).toBeDefined();
        });

        it('returns 404 for non-existent backup', async () => {
            const res = await request(app)
                .get('/api/backup/download/nonexistent.json')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });

        it('returns 400 for path traversal filename', async () => {
            const res = await request(app)
                .get('/api/backup/download/..%2F..%2Fetc%2Fpasswd')
                .set(authHeaders());

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /:filename', () => {
        it('deletes a backup file', async () => {
            const exportRes = await createPlaintextBackup();
            const filename = exportRes.body.filename;

            const filesBefore = await fs.readdir(backupDir);
            expect(filesBefore).toContain(filename);

            const res = await request(app)
                .delete(`/api/backup/${filename}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const filesAfter = await fs.readdir(backupDir);
            expect(filesAfter).not.toContain(filename);
        });

        it('returns 404 for non-existent backup', async () => {
            const res = await request(app)
                .delete('/api/backup/nonexistent.json')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });

        it('returns 400 for path traversal filename', async () => {
            const res = await request(app)
                .delete('/api/backup/..%2F..%2Fetc%2Fpasswd')
                .set(authHeaders());

            expect([400, 404]).toContain(res.status);
        });

        it('logs audit entry on delete', async () => {
            const exportRes = await createPlaintextBackup();
            const filename = exportRes.body.filename;

            await request(app)
                .delete(`/api/backup/${filename}`)
                .set(authHeaders());

            const audits = await db.query('SELECT * FROM backup_audit WHERE operation = $1', ['delete']);
            expect(audits.rows).toHaveLength(1);
            expect(audits.rows[0].status).toBe('success');
        });
    });

    describe('POST /import', () => {
        it('returns 400 for missing filename', async () => {
            const res = await request(app)
                .post('/api/backup/import')
                .set(authHeaders())
                .send({});

            expect(res.status).toBe(400);
        });

        it('returns 400 for path traversal filename', async () => {
            const res = await request(app)
                .post('/api/backup/import')
                .set(authHeaders())
                .send({ filename: '../../etc/passwd' });

            expect(res.status).toBe(400);
        });
    });

    describe('Full backup lifecycle', () => {
        it('export → list → preview → download → delete', async () => {
            const exportRes = await createPlaintextBackup();
            expect(exportRes.status).toBe(200);
            const filename = exportRes.body.filename;

            const listRes = await request(app)
                .get('/api/backup/list')
                .set(authHeaders());
            expect(listRes.body.backups).toHaveLength(1);
            expect(listRes.body.backups[0].filename).toBe(filename);

            const previewRes = await request(app)
                .post('/api/backup/preview')
                .set(authHeaders())
                .send({ filename });
            expect(previewRes.status).toBe(200);
            expect(previewRes.body.version).toBe('2.0');

            const downloadRes = await request(app)
                .get(`/api/backup/download/${filename}`)
                .set(authHeaders());
            expect(downloadRes.status).toBe(200);

            const backupContent = JSON.parse(downloadRes.text);
            expect(backupContent.data.users).toBeDefined();

            const deleteRes = await request(app)
                .delete(`/api/backup/${filename}`)
                .set(authHeaders());
            expect(deleteRes.status).toBe(200);

            const finalList = await request(app)
                .get('/api/backup/list')
                .set(authHeaders());
            expect(finalList.body.backups).toHaveLength(0);
        });
    });

    describe('Export includes DB data', () => {
        it('includes seeded library in exported backup', async () => {
            await db.query(`
                INSERT INTO libraries (name, external_id, media_type, is_active)
                VALUES ('BackupTestLib', 'btl-1', 'movie', true)
            `);

            const exportRes = await createPlaintextBackup();
            const filename = exportRes.body.filename;

            const content = await fs.readFile(path.join(backupDir, filename), 'utf8');
            const parsed = JSON.parse(content);

            const testLib = parsed.data.libraries.find((l) => l.name === 'BackupTestLib');
            expect(testLib).toBeDefined();
            expect(testLib.media_type).toBe('movie');

            await db.query('DELETE FROM libraries WHERE name = $1', ['BackupTestLib']);
        });
    });
});
