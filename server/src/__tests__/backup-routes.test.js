/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../services/backupService', () => ({
  ENCRYPTED_BACKUP_PASSWORD_ERROR: 'Password must be a string with at least 8 characters for encrypted backups',
  isValidEncryptedBackupPassword: jest.fn(password => typeof password === 'string' && password.length >= 8),
  createBackup: jest.fn(),
  logAudit: jest.fn().mockResolvedValue()
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { id: 1, username: 'admin' };
    next();
  },
  requireAdmin: (_req, _res, next) => next()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const backupService = require('../services/backupService');
const backupRouter = require('../routes/backup');

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
    expect(res.body.error).toBe(backupService.ENCRYPTED_BACKUP_PASSWORD_ERROR);
    expect(backupService.createBackup).not.toHaveBeenCalled();
  });
});
