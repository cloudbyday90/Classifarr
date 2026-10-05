/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { migrationCommand, migrationSql } from './identityMigrationDatabase.mjs';
import { boundedJson } from './httpRoutingTransport.mjs';

const originalKey = '/app/data/secrets/api_key_encryption_key';
const customKey = '/app/data/secrets/selected-key';
const settingsPath = '/app/data/config/selected-settings.json';
const syntheticApiKey = 'clf_selected_configuration_fixture';
const snapshot = () => Promise.all([readFile(originalKey), readFile(customKey), readFile(settingsPath)]);

/** Called only inside the guarded, disposable legacy database setup. */
export async function seedSelectedConfigurationCipher() {
  const key = (await readFile(originalKey, 'utf8')).trim();
  const iv = randomBytes(16), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const encrypted = cipher.update(syntheticApiKey, 'utf8', 'hex') + cipher.final('hex');
  const stored = `${encrypted}$${iv.toString('hex')}$${cipher.getAuthTag().toString('hex')}`;
  await migrationSql(`INSERT INTO api_keys(name,key_hash,key_prefix,permissions)
    VALUES('selected-configuration-fixture','${stored}','clf_sele','read_only')`, 'classifarr');
}

export async function prepareSelectedConfigurationProfile(mode) {
  assert(['file', 'environment'].includes(mode));
  await migrationCommand('classifarr', 'node', ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFile, writeFile, mkdir } from 'node:fs/promises';
    const settings = JSON.stringify({ force_secure_cookies:true,csrf_protection:true,
      cors_origin:'https://selected.example',omdb_request_timeout_ms:30000,
      omdb_retry_timeout_multiplier:2,omdb_max_request_timeout_ms:60000,
      omdb_max_retries:3,omdb_ssl_warn_throttle_ms:900000 });
    for (const [path, value] of [['${customKey}', await readFile('${originalKey}','utf8')], ['${settingsPath}',settings]]) {
      try { await writeFile(path,value,{flag:'wx',mode:0o600}); }
      catch(error) { if(error.code!=='EEXIST') throw error; assert.equal(await readFile(path,'utf8'),value); }
    }
    await mkdir('/app/data/logs/selected',{recursive:true,mode:0o700});
    await mkdir('/app/data/backups/selected',{recursive:true,mode:0o700});
  `]);
  const before = await snapshot();
  return {
    configuration: { API_KEY_ENCRYPTION_KEY_FILE: mode === 'file' ? customKey : '/app/data/secrets/absent-selected-key',
      ...(mode === 'environment' ? { API_KEY_ENCRYPTION_KEY: before[0].toString('utf8').trim() } : {}),
      RUNTIME_SETTINGS_FILE: settingsPath, LOG_DIR: '/app/data/logs/selected', BACKUP_DIR: '/app/data/backups/selected',
      LOG_LEVEL: 'error', FILE_LOGGING_ENABLED: 'true', FORCE_SECURE_COOKIES: 'false',
      CORS_ORIGIN: 'https://ignored-environment.example', TZ: 'America/New_York' },
    async prepareFileFallback() {
      // Schema reconciliation seeds DB overrides, which intentionally outrank
      // JSON. Remove only these known synthetic defaults after maintenance so
      // this disposable case exercises JSON-over-environment fallback.
      await migrationSql(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM settings
          WHERE (key='force_secure_cookies' AND value IS DISTINCT FROM 'false')
            OR (key='cors_origin' AND value IS DISTINCT FROM ''))
        THEN RAISE EXCEPTION 'unexpected_fixture_security_override'; END IF;
      END $$;
      DELETE FROM settings WHERE key IN ('force_secure_cookies','cors_origin');`);
    },
    async verifyPreserved() {
      const after = await snapshot();
      for (let index = 0; index < before.length; index++) assert(before[index].equals(after[index]), 'configuration_bytes_changed');
      await assert.rejects(readFile('/app/data/secrets/absent-selected-key'), error => error.code === 'ENOENT');
    },
  };
}

export async function verifySelectedConfigurationHttp(session, { custom = false, cookies = [] } = {}) {
  const id = (await migrationSql("SELECT id FROM api_keys WHERE name='selected-configuration-fixture'")).stdout.trim();
  assert(/^[1-9]\d*$/.test(id));
  const response = await fetch(`http://127.0.0.1:21324/api/keys/${id}/reveal`,
    { headers: session, redirect: 'error', signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  assert.equal((await boundedJson(response.body)).key, syntheticApiKey, 'legacy_ciphertext_not_preserved');
  if (custom) {
    assert(cookies.some(cookie => cookie.startsWith('access_token=') && /; Secure(;|$)/.test(cookie)), 'runtime_json_cookie_setting_ignored');
    const cors = await fetch('http://127.0.0.1:21324/api/auth/me', {
      headers: { ...session, origin: 'https://selected.example' }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    assert.equal(cors.status, 200);
    assert.equal(cors.headers.get('access-control-allow-origin'), 'https://selected.example');
    await boundedJson(cors.body);
  }
}
