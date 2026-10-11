/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import express from 'express';
import request from 'supertest';

function responseApp(handler) {
  const app = express();
  app.get('/', handler);
  return app;
}

describe('installed Express response compatibility', () => {
  test('chunked send has one framing mechanism and retains its ETag', async () => {
    const app = responseApp((_req, res) => res.set('Transfer-Encoding', 'chunked').send('fixture'));
    const response = await request(app).get('/').expect(200);
    expect(response.text).toBe('fixture');
    expect(response.headers['transfer-encoding']).toBe('chunked');
    expect(response.headers['content-length']).toBeUndefined();
    expect(response.headers.etag).toMatch(/^W\/"/);

    const unchanged = await request(app).get('/').set('If-None-Match', response.headers.etag).expect(304);
    expect(unchanged.text).toBe('');
    expect(unchanged.headers.etag).toBe(response.headers.etag);
    expect(unchanged.headers['transfer-encoding']).toBeUndefined();
    expect(unchanged.headers['content-length']).toBeUndefined();
  });

  test('ordinary GET and HEAD retain byte length and validator without a HEAD body', async () => {
    const app = responseApp((_req, res) => res.send('caf\u00e9'));
    const response = await request(app).get('/').expect(200);
    const head = await request(app).head('/').expect(200);
    expect(response.headers['content-length']).toBe('5');
    expect(head.headers['content-length']).toBe('5');
    expect(head.headers.etag).toBe(response.headers.etag);
    expect(head.text).toBeUndefined();
  });

  test('keeps existing MIME parameters when adding UTF-8', async () => {
    const app = responseApp((_req, res) => res.set('Content-Type', 'text/plain; profile=fixture').send('fixture'));
    const response = await request(app).get('/').expect(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.headers['content-type']).toContain('profile=fixture');
    expect(response.headers['content-type']).toContain('charset=utf-8');
  });

  test('ASCII download names retain attachment semantics with either valid quoting style', async () => {
    const app = responseApp((_req, res) => res.attachment('backup.json').send('{}'));
    const response = await request(app).get('/').expect(200);
    expect(response.headers['content-disposition']).toMatch(/^attachment; filename=(?:backup\.json|"backup\.json")$/);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toEqual({});
  });

  test('Unicode download names keep the encoded UTF-8 filename', async () => {
    const app = responseApp((_req, res) => res.attachment('\u5e93.json').send('{}'));
    const response = await request(app).get('/').expect(200);
    expect(response.headers['content-disposition']).toMatch(/^attachment;/);
    expect(response.headers['content-disposition']).toContain("filename*=UTF-8''%E5%BA%93.json");
  });

  test('204 strips body, MIME and framing headers even for chunked send', async () => {
    const app = responseApp((_req, res) => res.status(204).set('Transfer-Encoding', 'chunked').send('fixture'));
    const response = await request(app).get('/').expect(204);
    expect(response.text).toBe('');
    expect(response.headers['content-type']).toBeUndefined();
    expect(response.headers['transfer-encoding']).toBeUndefined();
    expect(response.headers['content-length']).toBeUndefined();
  });
});
