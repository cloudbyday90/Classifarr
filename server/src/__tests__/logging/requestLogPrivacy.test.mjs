/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import morgan from 'morgan';
import request from 'supertest';
import { requestLogQuery, requestLogUrl } from '../../utils/logging/requestLogPrivacy.mjs';
import { accessLogFormat } from '../../utils/logging/accessLogFormat.mjs';

describe('request log privacy', () => {
  test.each([
    ['/api/items?key=secret', '/api/items'],
    ['/api/items?%6b%65%79=secret&filter=movie&filter=tv', '/api/items'],
    ['/api/items?KEY=&key[]=secret&nested[key]=secret', '/api/items'],
    ['/api/items?unknown=secret%ZZ#secret', '/api/items'],
    ['https://user:secret@example.test:8443/api/items?token=secret#secret', 'https://example.test:8443/api/items'],
    ['https://example.test/items', 'https://example.test/items'],
    ['/api/items', '/api/items'],
    ['/api/%22items', '/api/%22items'],
    ['https://[broken/?key=secret', '[REDACTED]'],
    ['//user:secret@example.test/items', '[REDACTED]'],
    ['garbage?key=secret', '[REDACTED]'],
    ['javascript:secret', '[REDACTED]'],
    ['/api\\items?key=secret', '[REDACTED]'],
    ['/api/\nsecret', '[REDACTED]'],
    ['', undefined], [null, undefined], [undefined, undefined], [42, '[REDACTED]'],
  ])('projects %j without a raw fallback', (value, expected) => {
    expect(requestLogUrl(value)).toBe(expected);
  });

  test('does not traverse query values or change parser objects', () => {
    const circular = {};
    circular.self = circular;
    const query = Object.freeze({ key: circular, redirect: '/?key=secret', page: '2' });
    expect(requestLogQuery(query)).toEqual({ key: '[REDACTED]', redirect: '[REDACTED]', page: '[REDACTED]' });
    expect(query.key).toBe(circular);
    expect(requestLogQuery({})).toEqual({});
    expect(requestLogQuery(null)).toBeUndefined();
    expect(requestLogQuery('secret')).toBeUndefined();
    expect(requestLogQuery(['secret'])).toBeUndefined();
  });

  test.each([200, 401, 404, 500])('redacts rejected and successful requests with referrer alias: %i', async (status) => {
    const lines = [];
    const app = express();
    app.use(morgan(accessLogFormat, { stream: { write: (line) => lines.push(line) } }));
    app.use((req, res) => {
      expect(req.query.key).toBe('synthetic_secret');
      expect(req.headers.referrer).toContain('synthetic_secret');
      res.sendStatus(status);
    });
    await request(app).get('/api/items?key=synthetic_secret')
      .set('Referrer', 'https://example.test/items?key=synthetic_secret');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(`"GET /api/items HTTP/1.1" ${status}`);
    expect(lines[0]).toContain('https://example.test/items');
    expect(lines[0]).not.toContain('synthetic_secret');
  });

  test('does not change global Morgan tokens', () => {
    expect(morgan.url({ originalUrl: '/api/items?key=synthetic_secret' })).toContain('synthetic_secret');
    expect(morgan.referrer({ headers: { referer: 'https://example.test/?key=synthetic_secret' } })).toContain('synthetic_secret');
  });
});
