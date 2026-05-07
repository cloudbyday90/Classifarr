import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const db = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));

const apiKeyService = await import('../services/apiKeyService.mjs');
const { createConsoleSpy } = await import('./setup/consoleHelpers.mjs');

describe('API Key Service - database-backed behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createApiKey rejects invalid permissions', async () => {
    await expect(apiKeyService.createApiKey('Bad Key', 'unknown_perm')).rejects.toThrow(
      'Invalid permissions. Must be one of: read_only, read_write, webhook_only, embed_service, admin'
    );
    expect(db.query).not.toHaveBeenCalled();
  });

  test('createEmbeddingServiceApiKey creates a reserved integration key', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 7,
          name: 'Embedding Service API Key',
          key_prefix: 'clf_test',
          permissions: 'embed_service',
          created_at: new Date(),
          expires_at: null,
          is_active: true,
        },
      ],
    });

    const result = await apiKeyService.createEmbeddingServiceApiKey();
    const [, params] = db.query.mock.calls[0];

    expect(params[0]).toBe('Embedding Service API Key');
    expect(params[3]).toBe('embed_service');
    expect(result.permissions).toBe('embed_service');
    expect(result.key).toMatch(/^clf_/);
  });

  test('createApiKey inserts and returns persisted fields with plaintext key', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          name: 'Integration Key',
          key_prefix: 'clf_test',
          permissions: 'read_write',
          created_at: new Date(),
          expires_at: null,
          is_active: true,
        },
      ],
    });

    const result = await apiKeyService.createApiKey('Integration Key', 'read_write');
    const [query, params] = db.query.mock.calls[0];

    expect(query).toContain('INSERT INTO api_keys');
    expect(params[0]).toBe('Integration Key');
    expect(params[1]).toEqual(expect.any(String));
    expect(params[2]).toMatch(/^clf_/);
    expect(params[3]).toBe('read_write');
    expect(result.key).toMatch(/^clf_/);
  });

  test('validateApiKey returns null for invalid format without querying DB', async () => {
    await expect(apiKeyService.validateApiKey('not-a-classifarr-key')).resolves.toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('validateApiKey returns null for non-string inputs without querying DB', async () => {
    await expect(apiKeyService.validateApiKey(['clf_test', 'clf_other'])).resolves.toBeNull();
    await expect(apiKeyService.validateApiKey({ key: 'clf_test' })).resolves.toBeNull();
    await expect(apiKeyService.validateApiKey(12345678)).resolves.toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('validateApiKey returns matching active key and strips key_hash', async () => {
    const generated = apiKeyService.generateApiKey();
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          name: 'Valid Key',
          key_prefix: generated.prefix,
          key_hash: generated.keyHash,
          permissions: 'read_write',
          created_at: new Date(),
          last_used_at: null,
          last_used_ip: null,
          is_active: true,
          expires_at: null,
        },
      ],
    });

    const result = await apiKeyService.validateApiKey(generated.key);

    expect(result).toEqual(
      expect.objectContaining({
        id: 2,
        name: 'Valid Key',
        permissions: 'read_write',
      })
    );
    expect(result.key_hash).toBeUndefined();
    expect(db.query.mock.calls[0][1]).toEqual([generated.prefix]);
  });

  test('validateApiKey returns null for expired keys', async () => {
    const generated = apiKeyService.generateApiKey();
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          name: 'Expired Key',
          key_prefix: generated.prefix,
          key_hash: generated.keyHash,
          permissions: 'read_write',
          created_at: new Date(),
          last_used_at: null,
          last_used_ip: null,
          is_active: true,
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    });

    await expect(apiKeyService.validateApiKey(generated.key)).resolves.toBeNull();
  });

  test('validateApiKey skips undecryptable rows and continues scanning', async () => {
    const warningSpy = createConsoleSpy('warn', { suppress: true });
    const generated = apiKeyService.generateApiKey();
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          key_hash: 'corrupted-value',
          permissions: 'read_write',
          is_active: true,
          expires_at: null,
        },
        {
          id: 11,
          name: 'Second Row Key',
          key_prefix: generated.prefix,
          key_hash: generated.keyHash,
          permissions: 'read_write',
          created_at: new Date(),
          last_used_at: null,
          last_used_ip: null,
          is_active: true,
          expires_at: null,
        },
      ],
    });

    const result = await apiKeyService.validateApiKey(generated.key);

    expect(result).toEqual(expect.objectContaining({ id: 11 }));
    expect(warningSpy.spy).toHaveBeenCalled();
  });

  test('validateApiKey returns null when prefix rows do not match key', async () => {
    const submittedKey = apiKeyService.generateApiKey().key;
    const otherRow = apiKeyService.generateApiKey();
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 4,
          key_hash: otherRow.keyHash,
          permissions: 'read_write',
          is_active: true,
          expires_at: null,
        },
      ],
    });

    await expect(apiKeyService.validateApiKey(submittedKey)).resolves.toBeNull();
  });

  test('updateLastUsed updates timestamp and IP', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1 });
    await apiKeyService.updateLastUsed(5, '127.0.0.1');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE api_keys'),
      ['127.0.0.1', 5]
    );
  });

  test('listApiKeys returns all rows ordered from DB', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    db.query.mockResolvedValueOnce({ rows });
    await expect(apiKeyService.listApiKeys()).resolves.toEqual(rows);
  });

  test('getApiKeyById returns row when found and null when missing', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 6, name: 'Single Key' }] });
    await expect(apiKeyService.getApiKeyById(6)).resolves.toEqual({ id: 6, name: 'Single Key' });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(apiKeyService.getApiKeyById(404)).resolves.toBeNull();
  });

  test('getApiKeyFull decrypts and returns full key', async () => {
    const generated = apiKeyService.generateApiKey();
    db.query.mockResolvedValueOnce({ rows: [{ key_hash: generated.keyHash }] });
    await expect(apiKeyService.getApiKeyFull(1)).resolves.toBe(generated.key);
  });

  test('getApiKeyFull returns null when key record is missing', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(apiKeyService.getApiKeyFull(999)).resolves.toBeNull();
  });

  test('getApiKeyFull returns null on decryption failure', async () => {
    const errorSpy = createConsoleSpy('error', { suppress: true });
    db.query.mockResolvedValueOnce({ rows: [{ key_hash: 'bad-encrypted-value' }] });

    await expect(apiKeyService.getApiKeyFull(1)).resolves.toBeNull();
    expect(errorSpy.spy).toHaveBeenCalled();
  });

  test('updateApiKey rejects invalid permissions', async () => {
    await expect(apiKeyService.updateApiKey(1, { permissions: 'invalid' })).rejects.toThrow(
      'Invalid permissions. Must be one of: read_only, read_write, webhook_only, embed_service, admin'
    );
  });

  test('updateApiKey returns null when no allowed update fields are provided', async () => {
    await expect(apiKeyService.updateApiKey(1, { ignored: 'value' })).resolves.toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('updateApiKey updates only allowed fields and returns row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 9, name: 'Renamed', is_active: false }] });

    const result = await apiKeyService.updateApiKey(9, {
      name: 'Renamed',
      is_active: false,
      ignored: 'value',
    });
    const [query, params] = db.query.mock.calls[0];

    expect(query).toContain('name = $1');
    expect(query).toContain('is_active = $2');
    expect(params).toEqual(['Renamed', false, 9]);
    expect(result).toEqual({ id: 9, name: 'Renamed', is_active: false });
  });

  test('updateApiKey returns null when update affects no rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(apiKeyService.updateApiKey(123, { name: 'Nope' })).resolves.toBeNull();
  });

  test('deleteApiKey returns true when row is deleted and false otherwise', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1 });
    await expect(apiKeyService.deleteApiKey(1)).resolves.toBe(true);

    db.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(apiKeyService.deleteApiKey(1)).resolves.toBe(false);
  });

  test('hasApiKeys parses count string from DB', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    await expect(apiKeyService.hasApiKeys()).resolves.toBe(false);

    db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });
    await expect(apiKeyService.hasApiKeys()).resolves.toBe(true);
  });

  test('ensureDefaultApiKey creates default key when none exist', async () => {
    const logSpy = createConsoleSpy('log', { suppress: true });
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Default API Key',
            key_prefix: 'clf_defa',
            permissions: 'read_write',
            created_at: new Date(),
            expires_at: null,
            is_active: true,
          },
        ],
      });

    await expect(apiKeyService.ensureDefaultApiKey()).resolves.toBeNull();
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO api_keys');
    expect(logSpy.spy).toHaveBeenCalledTimes(2);
  });

  test('ensureDefaultApiKey does not create key when one already exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
    await expect(apiKeyService.ensureDefaultApiKey()).resolves.toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('logAudit inserts with nullable endpoint metadata', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await apiKeyService.logAudit(7, 'used');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO api_key_audit'),
      [7, 'used', null, null, null]
    );
  });

  test('logAudit swallows insert errors and logs them', async () => {
    const errorSpy = createConsoleSpy('error', { suppress: true });
    db.query.mockRejectedValueOnce(new Error('audit insert failed'));

    await expect(
      apiKeyService.logAudit(7, 'used', { endpoint: '/api/webhook', ipAddress: '127.0.0.1' })
    ).resolves.toBeUndefined();
    expect(errorSpy.spy).toHaveBeenCalled();
  });
});
