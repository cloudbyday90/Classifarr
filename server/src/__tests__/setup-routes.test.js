/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../services/auth', () => ({
  validatePasswordStrength: jest.fn(),
  hashPassword: jest.fn(),
  auditLog: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  getCookieOptions: jest.fn(() => ({ httpOnly: true, secure: false, sameSite: 'strict', path: '/' }))
}));

const db = require('../config/database');
const authService = require('../services/auth');
const setupRouter = require('../routes/setup');

describe('Setup Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/setup', setupRouter);
  });

  describe('GET /setup/status', () => {
    it('should return setupRequired true when no users exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      
      const res = await request(app).get('/setup/status');
      
      expect(res.status).toBe(200);
      expect(res.body.setupRequired).toBe(true);
      expect(res.body.setupComplete).toBe(false);
    });

    it('should return setupRequired false when users exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      
      const res = await request(app).get('/setup/status');
      
      expect(res.status).toBe(200);
      expect(res.body.setupRequired).toBe(false);
      expect(res.body.setupComplete).toBe(true);
    });

    it('should return setupRequired true on database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));
      
      const res = await request(app).get('/setup/status');
      
      expect(res.status).toBe(200);
      expect(res.body.setupRequired).toBe(true);
      expect(res.body.setupComplete).toBe(false);
    });
  });

  describe('POST /setup/create-admin', () => {
    it('should return 400 when users already exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      
      const res = await request(app)
        .post('/setup/create-admin')
        .send({ username: 'admin', password: 'Pass123!', confirmPassword: 'Pass123!' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Setup already completed. Users already exist.');
    });

    it('should return 400 when username is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      
      const res = await request(app)
        .post('/setup/create-admin')
        .send({ password: 'Pass123!', confirmPassword: 'Pass123!' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username and password are required');
    });

    it('should return 400 when password is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      
      const res = await request(app)
        .post('/setup/create-admin')
        .send({ username: 'admin', confirmPassword: 'Pass123!' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username and password are required');
    });

    it('should return 400 when passwords do not match', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      
      const res = await request(app)
        .post('/setup/create-admin')
        .send({ username: 'admin', password: 'Pass123!', confirmPassword: 'Different!' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Passwords do not match');
    });

    it('should return 400 when password is weak', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: false, message: 'Password too weak' });
      
      const res = await request(app)
        .post('/setup/create-admin')
        .send({ username: 'admin', password: 'weak', confirmPassword: 'weak' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password too weak');
    });

    it('should return 400 on duplicate username', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      authService.hashPassword.mockResolvedValueOnce('hashedpassword');
      const error = new Error('Duplicate');
      error.code = '23505';
      db.query.mockRejectedValueOnce(error);
      
      const res = await request(app)
        .post('/setup/create-admin')
        .send({ username: 'admin', password: 'Pass123!', confirmPassword: 'Pass123!' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username already exists');
    });

    it('should create admin successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      authService.hashPassword.mockResolvedValueOnce('hashedpassword');
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, username: 'admin', role: 'admin' }]
      });
      authService.auditLog.mockResolvedValueOnce();
      authService.generateAccessToken.mockResolvedValueOnce('access-token');
      authService.generateRefreshToken.mockResolvedValueOnce('refresh-token');
      
      const res = await request(app)
        .post('/setup/create-admin')
        .send({ username: 'admin', password: 'Pass123!', confirmPassword: 'Pass123!' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('admin');
      expect(res.body.refreshToken).toBe('refresh-token');
    });

    it('should return 500 on unexpected error', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      authService.validatePasswordStrength.mockReturnValueOnce({ valid: true });
      authService.hashPassword.mockResolvedValueOnce('hashedpassword');
      db.query.mockRejectedValueOnce(new Error('Unexpected error'));
      
      const res = await request(app)
        .post('/setup/create-admin')
        .send({ username: 'admin', password: 'Pass123!', confirmPassword: 'Pass123!' });
      
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create admin account');
    });
  });
});
