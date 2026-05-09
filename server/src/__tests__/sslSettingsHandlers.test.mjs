/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createSslSettingsHandlers } from '../routes/helpers/sslSettingsHandlers.mjs';

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe('sslSettingsHandlers', () => {
  const db = {
    query: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a not-yet-valid certificate error', async () => {
    const handlers = createSslSettingsHandlers({
      db,
      accessFile: jest.fn().mockResolvedValue(undefined),
      readUtf8File: jest.fn().mockResolvedValue('pem'),
      createSecureContext: jest.fn(),
      createX509Certificate: jest.fn(() => ({
        validFrom: '2999-01-01T00:00:00.000Z',
        validTo: '2999-02-01T00:00:00.000Z',
        subject: 'CN=test',
        issuer: 'CN=issuer'
      })),
      getNow: () => new Date('2026-03-28T00:00:00.000Z')
    });
    const res = createResponse();

    await handlers.testCertificates({
      body: {
        cert_path: '/certs/live.crt',
        key_path: '/certs/live.key'
      }
    }, res);

    expect(res.json).toHaveBeenCalledWith({
      cert_exists: true,
      key_exists: true,
      ca_exists: true,
      valid: false,
      error: 'Certificate is not yet valid'
    });
  });

  it('returns an expired certificate error', async () => {
    const handlers = createSslSettingsHandlers({
      db,
      accessFile: jest.fn().mockResolvedValue(undefined),
      readUtf8File: jest.fn().mockResolvedValue('pem'),
      createSecureContext: jest.fn(),
      createX509Certificate: jest.fn(() => ({
        validFrom: '2000-01-01T00:00:00.000Z',
        validTo: '2000-02-01T00:00:00.000Z',
        subject: 'CN=test',
        issuer: 'CN=issuer'
      })),
      getNow: () => new Date('2026-03-28T00:00:00.000Z')
    });
    const res = createResponse();

    await handlers.testCertificates({
      body: {
        cert_path: '/certs/live.crt',
        key_path: '/certs/live.key'
      }
    }, res);

    expect(res.json).toHaveBeenCalledWith({
      cert_exists: true,
      key_exists: true,
      ca_exists: true,
      valid: false,
      error: 'Certificate has expired'
    });
  });

  it('returns a key-path-required error after confirming the certificate path', async () => {
    const accessFile = jest.fn().mockResolvedValue(undefined);
    const handlers = createSslSettingsHandlers({
      db,
      accessFile
    });
    const res = createResponse();

    await handlers.testCertificates({
      body: {
        cert_path: '/certs/live.crt'
      }
    }, res);

    expect(accessFile).toHaveBeenCalledWith('/certs/live.crt');
    expect(res.json).toHaveBeenCalledWith({
      cert_exists: true,
      key_exists: false,
      ca_exists: true,
      valid: false,
      error: 'Private key path is required'
    });
  });

  it('returns a CA-file-not-found error when the optional CA path is present but inaccessible', async () => {
    const accessFile = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('missing ca'));
    const handlers = createSslSettingsHandlers({
      db,
      accessFile
    });
    const res = createResponse();

    await handlers.testCertificates({
      body: {
        cert_path: '/certs/live.crt',
        key_path: '/certs/live.key',
        ca_path: '/certs/ca.pem'
      }
    }, res);

    expect(res.json).toHaveBeenCalledWith({
      cert_exists: true,
      key_exists: true,
      ca_exists: false,
      valid: false,
      error: 'CA certificate file not found'
    });
  });

  it('returns success metadata and a renewal warning for soon-to-expire certificates', async () => {
    const handlers = createSslSettingsHandlers({
      db,
      accessFile: jest.fn().mockResolvedValue(undefined),
      readUtf8File: jest.fn().mockResolvedValue('pem'),
      createSecureContext: jest.fn(),
      createX509Certificate: jest.fn(() => ({
        validFrom: '2026-03-01T00:00:00.000Z',
        validTo: '2026-04-07T00:00:00.000Z',
        subject: 'CN=test',
        issuer: 'CN=issuer'
      })),
      getNow: () => new Date('2026-03-28T00:00:00.000Z')
    });
    const res = createResponse();

    await handlers.testCertificates({
      body: {
        cert_path: '/certs/live.crt',
        key_path: '/certs/live.key'
      }
    }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      cert_exists: true,
      key_exists: true,
      ca_exists: true,
      valid: true,
      subject: 'CN=test',
      issuer: 'CN=issuer',
      daysUntilExpiry: 10,
      message: 'SSL certificates are valid (expires in 10 days - renewal recommended)'
    }));
  });

  it('surfaces invalid certificate or key errors from the certificate validation step', async () => {
    const handlers = createSslSettingsHandlers({
      db,
      accessFile: jest.fn().mockResolvedValue(undefined),
      readUtf8File: jest.fn().mockResolvedValue('pem'),
      createSecureContext: jest.fn(() => {
        throw new Error('bad pem');
      })
    });
    const res = createResponse();

    await handlers.testCertificates({
      body: {
        cert_path: '/certs/live.crt',
        key_path: '/certs/live.key'
      }
    }, res);

    expect(res.json).toHaveBeenCalledWith({
      cert_exists: true,
      key_exists: true,
      ca_exists: true,
      valid: false,
      error: 'Invalid certificate or key: bad pem'
    });
  });
});
