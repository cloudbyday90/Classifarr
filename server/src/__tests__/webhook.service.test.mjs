import { jest } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';
import { createConsoleSpy } from './setup/consoleHelpers.mjs';

process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const db = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));

const { webhookService } = await import('../services/webhook.mjs');
const { encryptValue, formatEncryptedValue } = await import('../utils/encryption.mjs');

function encryptSecret(secret) {
  const { encrypted, iv, authTag } = encryptValue(secret);
  return formatEncryptedValue(encrypted, iv, authTag);
}

describe('WebhookService - service methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('private helpers identify encrypted values and mask secrets', () => {
    expect(webhookService.isEncrypted('a$b$c')).toBe(true);
    expect(webhookService.isEncrypted('plain-value')).toBe(false);

    const masked = webhookService.maskConfig({ secret_key: 'whsec_abcdefghijklmnopqrstuvwxyz' });
    expect(masked.secret_key).not.toBe('whsec_abcdefghijklmnopqrstuvwxyz');

    const maskedList = webhookService.maskConfigs([{ secret_key: 'whsec_abcdefghijklmnopqrstuvwxyz' }]);
    expect(Array.isArray(maskedList)).toBe(true);
    expect(maskedList[0].secret_key).toBeDefined();
  });

  test('getConfig returns defaults when no enabled row is found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await webhookService.getConfig();

    expect(result).toEqual(
      expect.objectContaining({
        enabled: true,
        process_pending: true,
        process_approved: true,
        process_auto_approved: true,
        process_declined: false,
      })
    );
  });

  test('getConfig masks stored secret when config exists', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, enabled: true, secret_key: 'whsec_abcdefghijklmnopqrstuvwxyz' }],
    });

    const result = await webhookService.getConfig();
    expect(result.secret_key).not.toBe('whsec_abcdefghijklmnopqrstuvwxyz');
  });

  test('getConfig can return unmasked raw config when requested', async () => {
    const encryptedSecret = encryptSecret('whsec_raw_secret_123456');
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, enabled: true, secret_key: encryptedSecret }],
    });

    const result = await webhookService.getConfig({ mask: false });
    expect(result.secret_key).toBe(encryptedSecret);
  });

  test('getFullSecret handles empty, plaintext, encrypted, and decrypt-failure cases without auto-rotating by default', async () => {
    const warnSpy = createConsoleSpy('warn', { suppress: true });
    const secret = 'whsec_abcdefghijklmnopqrstuvwxyz';
    const encryptedSecret = encryptSecret(secret);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(webhookService.getFullSecret()).resolves.toBeNull();

    db.query.mockResolvedValueOnce({ rows: [{ secret_key: secret }] });
    await expect(webhookService.getFullSecret()).resolves.toBe(secret);

    db.query.mockResolvedValueOnce({ rows: [{ secret_key: encryptedSecret }] });
    await expect(webhookService.getFullSecret()).resolves.toBe(secret);

    db.query.mockResolvedValueOnce({ rows: [{ id: 9, secret_key: 'bad$encrypted$value' }] });
    await expect(webhookService.getFullSecret()).resolves.toBeNull();
    expect(warnSpy.spy).toHaveBeenCalled();
  });

  test('updateConfig updates existing row with encrypted secret and returns masked config', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 7, webhook_type: 'overseerr', enabled: true, secret_key: encryptSecret('whsec_oldsecret') }],
    });

    const result = await webhookService.updateConfig({
      secret_key: 'whsec_newsecret123456789',
      enabled: true,
      include_specials: true,
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('UPDATE webhook_config');
    expect(db.query.mock.calls[0][1][0]).toContain('$');
    expect(result.secret_key).not.toContain('whsec_newsecret123456789');
  });

  test('updateConfig clears existing secret when empty string is submitted', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 7, webhook_type: 'overseerr', enabled: true, secret_key: '' }],
    });

    const result = await webhookService.updateConfig({
      secret_key: '',
      enabled: true,
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('UPDATE webhook_config');
    expect(db.query.mock.calls[0][1][0]).toBe('');
    expect(result.secret_key).toBe('');
  });

  test('updateConfig inserts default record when update affects no rows', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 8, webhook_type: 'overseerr', secret_key: 'encrypted' }] });

    const result = await webhookService.updateConfig({ enabled: true });

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO webhook_config');
    expect(result.secret_key).toMatch(/^whsec_/);
  });

  test('updateConfigById clears existing secret when empty string is submitted', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 7, webhook_type: 'overseerr', enabled: true, secret_key: '' }],
    });

    const result = await webhookService.updateConfigById(7, {
      secret_key: '',
      enabled: true,
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('UPDATE webhook_config SET');
    expect(db.query.mock.calls[0][1][4]).toBe('');
    expect(result.secret_key).toBe('');
  });

  test('generateSecretKey creates webhook-prefixed secret', () => {
    expect(webhookService.generateSecretKey()).toMatch(/^whsec_/);
  });

  test('validateAuth supports bearer token, encrypted secret, and reject paths', async () => {
    const warnSpy = createConsoleSpy('warn', { suppress: true });
    const secret = 'whsec_validation_secret_123456';
    const encrypted = encryptSecret(secret);

    await expect(webhookService.validateAuth(null, { secret_key: encrypted })).resolves.toBe(false);
    await expect(webhookService.validateAuth(['a', 'b'], { secret_key: encrypted })).resolves.toBe(false);
    await expect(webhookService.validateAuth({ key: secret }, { secret_key: encrypted })).resolves.toBe(false);
    await expect(webhookService.validateAuth(`Bearer ${secret}`, { secret_key: encrypted })).resolves.toBe(true);
    await expect(webhookService.validateAuth('short', { secret_key: secret })).resolves.toBe(false);
    await expect(webhookService.validateAuth(secret, { secret_key: 'invalid$payload$value' })).resolves.toBe(false);
    expect(warnSpy.spy).toHaveBeenCalled();
  });

  test('sanitizePayload and parsePayload tolerate null or non-object webhook bodies', () => {
    expect(webhookService.sanitizePayload(null)).toEqual({ payload: {}, specialsExcluded: 0 });
    expect(webhookService.sanitizePayload('not-json')).toEqual({ payload: {}, specialsExcluded: 0 });

    expect(() => webhookService.parsePayload(null)).not.toThrow();
    expect(webhookService.parsePayload(null)).toEqual(expect.objectContaining({
      media_type: 'tv'
    }));
  });

  test('logReceived writes webhook log row and returns id', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 55 }] });

    const request = {
      body: { event: 'media.pending' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn().mockReturnValue('UnitTestAgent'),
    };
    const parsed = {
      notification_type: 'MEDIA_PENDING',
      event_name: 'media.pending',
      title: 'Example',
      media_type: 'movie',
      tmdb_id: 1,
      tvdb_id: null,
      request_id: 9,
      requested_by_username: 'tester',
      requested_by_email: 'tester@example.com',
      is_4k: false,
    };

    await expect(webhookService.logReceived(request, parsed)).resolves.toBe(55);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO webhook_log'),
      expect.any(Array)
    );
  });

  test('updateLogStatus computes processing time and writes status update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ received_at: new Date(Date.now() - 1000).toISOString() }] })
      .mockResolvedValueOnce({ rows: [] });

    await webhookService.updateLogStatus(55, 'completed', {
      classification_id: 12,
      library: 'Movies',
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('UPDATE webhook_log');
    expect(db.query.mock.calls[1][1][0]).toBe('completed');
  });

  test('trackRequest inserts media request and returns id', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const parsed = {
      request_id: 44,
      tmdb_id: 22,
      tvdb_id: null,
      media_type: 'movie',
      title: 'Tracked Title',
      year: 2024,
      poster_path: '/poster.jpg',
      requested_by_username: 'tester',
      requested_by_email: 'tester@example.com',
      requested_by_avatar: '/avatar.png',
      is_4k: false,
      requested_seasons: null,
      requested_at: new Date().toISOString(),
    };

    await expect(
      webhookService.trackRequest(parsed, { classification_id: 5, library: 'Movies' })
    ).resolves.toBe(99);
  });

  test('updateRequestStatus no-ops without request_id and updates approved status when present', async () => {
    const warnSpy = createConsoleSpy('warn', { suppress: true });

    await webhookService.updateRequestStatus({}, 'approved');
    expect(db.query).not.toHaveBeenCalled();
    expect(warnSpy.spy).toHaveBeenCalled();

    db.query.mockResolvedValueOnce({ rows: [] });
    await webhookService.updateRequestStatus({ request_id: 77 }, 'approved');
    expect(db.query.mock.calls[0][0]).toContain('approved_at = NOW()');
  });

  test('getStats aggregates total/completed/failed/last24h and rounds avg time', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })
      .mockResolvedValueOnce({ rows: [{ count: '7' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ avg: '123.6' }] });

    await expect(webhookService.getStats()).resolves.toEqual({
      total: 10,
      completed: 7,
      failed: 3,
      last24h: 5,
      avgProcessingTime: 124,
    });
  });

  test('getLogs supports status/media filters and paginated response metadata', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ count: '12' }] });

    const result = await webhookService.getLogs({
      page: 2,
      limit: 5,
      status: 'completed',
      media_type: 'movie',
    });

    expect(result.logs).toHaveLength(2);
    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(3);
    expect(db.query.mock.calls[0][0]).toContain('processing_status = $1');
    expect(db.query.mock.calls[0][0]).toContain('media_type = $2');
  });

  test('configuration CRUD methods execute expected queries', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Primary' }] });
    await expect(webhookService.getAllConfigs()).resolves.toEqual([{ id: 1, name: 'Primary' }]);

    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, secret_key: 'whsec_abcdefghijklmnopqrstuvwxyz', webhook_type: 'overseerr' }],
    });
    const byId = await webhookService.getConfigById(1);
    expect(byId.secret_key).not.toBe('whsec_abcdefghijklmnopqrstuvwxyz');

    db.query.mockResolvedValueOnce({ rows: [{ id: 2, name: 'Created', secret_key: 'encrypted' }] });
    const created = await webhookService.createConfig({ name: 'Created' });
    expect(created.secret_key).toMatch(/^whsec_/);

    db.query.mockResolvedValueOnce({ rows: [{ id: 2, secret_key: 'whsec_abcdefghijklmnopqrstuvwxyz' }] });
    const updated = await webhookService.updateConfigById(2, { name: 'Updated' });
    expect(updated.secret_key).not.toBe('whsec_abcdefghijklmnopqrstuvwxyz');

    db.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ is_primary: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(webhookService.deleteConfig(2)).resolves.toBe(true);

    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 3, secret_key: 'whsec_abcdefghijklmnopqrstuvwxyz' }] });
    const primary = await webhookService.setPrimaryConfig(3);
    expect(primary.secret_key).not.toBe('whsec_abcdefghijklmnopqrstuvwxyz');
  });

  test('ensureSecretKey creates new key for missing config and returns null when key already exists', async () => {
    const logSpy = createConsoleSpy('log', { suppress: true });

    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const created = await webhookService.ensureSecretKey();
    expect(created).toMatch(/^whsec_/);
    expect(logSpy.spy).toHaveBeenCalled();

    db.query.mockResolvedValueOnce({ rows: [{ id: 1, secret_key: encryptSecret('whsec_existing') }] });
    await expect(webhookService.ensureSecretKey()).resolves.toBeNull();
  });

  test('ensureSecretKey preserves undecryptable encrypted secret and does not rotate it automatically', async () => {
    const warnSpy = createConsoleSpy('warn', { suppress: true });

    db.query.mockResolvedValueOnce({ rows: [{ id: 11, secret_key: 'bad$encrypted$value' }] });

    const rotated = await webhookService.ensureSecretKey();
    expect(rotated).toBeNull();
    expect(warnSpy.spy).toHaveBeenCalled();
    expect(
      db.query.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('UPDATE webhook_config')),
    ).toBe(false);
  });
});
