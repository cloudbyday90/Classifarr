/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createNamedServiceStub } from './helpers/mockFactory.mjs';

const { service: backupService, module: backupServiceModule } = createNamedServiceStub('backupService', [
  'isValidEncryptedBackupPassword',
  'createBackup',
  'logAudit',
]);
const {
  isValidEncryptedBackupPassword,
  createBackup,
  logAudit,
} = backupService;

backupService.ENCRYPTED_BACKUP_PASSWORD_ERROR = 'Password must be a string with at least 8 characters for encrypted backups';
isValidEncryptedBackupPassword.mockImplementation((password) => typeof password === 'string' && password.length >= 8);
logAudit.mockResolvedValue();

jest.unstable_mockModule('../services/backupService.mjs', () => backupServiceModule);

const _backupMockAuthenticateToken = (req, _res, next) => {
  req.user = { id: 1, username: 'admin' };
  next();
};
const _backupMockRequireAdmin = (_req, _res, next) => next();

jest.unstable_mockModule('../middleware/auth.mjs', () => ({
  authenticateToken: _backupMockAuthenticateToken,
  requireAdmin: _backupMockRequireAdmin,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));

const { router: backupRouter } = await import('../routes/backup.mjs');

describe('Backup Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/backup', backupRouter);
  });

  test('rejects non-string encrypted backup passwords before creating backup', async () => {
    const res = await request(app)
      .post('/backup/export')
      .send({ encrypted: true, password: 12345678 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Password must be a string with at least 8 characters for encrypted backups');
    expect(createBackup).not.toHaveBeenCalled();
  });
});
