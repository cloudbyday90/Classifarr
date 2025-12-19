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

const request = require('supertest');
const express = require('express');
const db = require('../config/database');

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

describe('Health Endpoint', () => {
  let app;

  beforeEach(() => {
    // Create a minimal Express app with just the health endpoint
    app = express();
    
    app.get('/health', async (req, res) => {
      try {
        await db.query('SELECT 1');
        res.json({ 
          status: 'healthy',
          database: 'connected',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ 
          status: 'unhealthy',
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('GET /health should return 200 and status ok when database is connected', async () => {
    // Mock successful database query
    db.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.database).toBe('connected');
    expect(response.body.timestamp).toBeDefined();
    expect(db.query).toHaveBeenCalledWith('SELECT 1');
  });

  test('GET /health should return 500 when database is disconnected', async () => {
    // Mock database query failure
    db.query.mockRejectedValue(new Error('Database connection failed'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(500);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.database).toBe('disconnected');
    expect(response.body.error).toBe('Database connection failed');
    expect(response.body.timestamp).toBeDefined();
  });

  test('GET /health should include ISO timestamp', async () => {
    db.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const response = await request(app).get('/health');

    expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('GET /health should handle timeout errors', async () => {
    db.query.mockRejectedValue(new Error('Connection timeout'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(500);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.error).toBe('Connection timeout');
  });
});
