/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'node:events';
import { gatewayHistoryQuery,gatewayHistoryPath,readGatewayHistoryPath,gatewayHistoryResponse } from '../ollamaGateway/historyContract.mjs';
import { completeGatewayRequest } from '../ollamaGateway/completionRepository.mjs';
import { readOllamaWorkHistory } from '../services/ollamaWorkHistory.mjs';
import { createGatewayHistoryHandler,registerGatewayHistoryRoutes } from '../routes/settingsRouteGatewayHistory.mjs';

jest.unstable_mockModule('../services/auth.mjs',() => ({ verifyToken: jest.fn(async token => {
  if (!['admin','user'].includes(token)) throw new Error('PRIVATE'); return { role: token };
}) }));
const { authenticateToken,requireAdmin } = await import('../middleware/auth.mjs');
const app = express(); const router = express.Router();
registerGatewayHistoryRoutes(router,{ authenticateToken,requireAdmin }); app.use('/api/settings',router);
const row = () => ({ requestId: '0199ea26-7d80-7000-8000-000000000001',admittedAt: '2026-10-15T22:00:00.000Z',gatewayAttempt: '1',
  operation: '/api/generate',model: 'test:latest',source: null,outcome: { state: 'response_completed',httpStatus: 200,recordedAt: '2026-10-15T22:00:01.000Z' } });
const report = () => ({ version: 1,installation: 'local',items: [row()],nextBefore: null });

test.each([{}, { taskId: '42' }, { before: '9223372036854775807',taskId: '2' }])('history query roundtrips %#',value => {
  expect(readGatewayHistoryPath(gatewayHistoryPath(value))).toEqual(value);
});
test.each([null,[],{ taskId: 1 },{ taskId: '0' },{ before: '-1' },{ taskId: '1.5' },{ taskId: '9223372036854775808' },
  { taskId: ['1','2'] },{ installation: 'foreign' },{ limit: '100' }])('rejects invalid filter %#',value => {
  expect(() => gatewayHistoryQuery(value)).toThrow('gateway_history_query_invalid');
});
test.each(['/gateway/history?taskId=1&taskId=2','/gateway/history?taskId=1?ignored=2','/gateway/history#x','/gateway/history?'+ 'a'.repeat(129),'/other'])('rejects invalid path %s',path => {
  expect(() => readGatewayHistoryPath(path)).toThrow('gateway_history_query_invalid');
});
test('response projection excludes private metadata and preserves explicit unknowns',() => {
  const input = report(); input.secret = 'PRIVATE'; input.items[0].prompt = 'PRIVATE';
  expect(gatewayHistoryResponse(input)).toEqual(report());
  input.items[0] = { ...row(),operation: null,model: null,source: { version: 1,kind: 'queue_task',taskId: '42',taskType: 'classification',attempt: 0 },
    outcome: { state: 'outcome_not_recorded',httpStatus: null,recordedAt: null } };
  expect(gatewayHistoryResponse(input).items[0].source.taskId).toBe('42');
});
test.each([null,{}, { ...report(),version: 2 },{ ...report(),installation: 'PRIVATE URL' },{ ...report(),items: Array(26).fill(row()) },
  { ...report(),nextBefore: '0' },{ ...report(),nextBefore: '1' },{ ...report(),items: [row(),row()] },
  ...['requestId','admittedAt','gatewayAttempt','operation','model','source','outcome'].map(key => ({ ...report(),items: [{ ...row(),[key]: 'invalid value' }] })),
  ...['state','httpStatus','recordedAt'].map(key => ({ ...report(),items: [{ ...row(),outcome: { ...row().outcome,[key]: 'invalid' } }] }))])('rejects malformed remote response %#',value => {
  expect(() => gatewayHistoryResponse(value)).toThrow('gateway_history_response_invalid');
});
test('valid next page cursor uses the final admission attempt',() => {
  const value = { ...report(),items: Array.from({ length: 25 },(_,index) => ({ ...row(),gatewayAttempt: String(30-index) })),nextBefore: '6' };
  expect(gatewayHistoryResponse(value).nextBefore).toBe('6');
});

test.each([
  { state: 'active_or_uncertain',httpStatus: null,recordedAt: row().outcome.recordedAt },
  { state: 'outcome_not_recorded',httpStatus: 200,recordedAt: null },
  { state: 'response_completed',httpStatus: 503,recordedAt: row().outcome.recordedAt },
  { state: 'provider_rejected',httpStatus: 200,recordedAt: row().outcome.recordedAt },
  { state: 'not_dispatched',httpStatus: null,recordedAt: null },
])('rejects contradictory outcome fields %#',outcome => {
  expect(() => gatewayHistoryResponse({ ...report(),items: [{ ...row(),outcome }] })).toThrow('gateway_history_response_invalid');
});
test.each([undefined,{ state: 'not_dispatched',httpStatus: null },{ state: 'provider_rejected',httpStatus: 429 }])('completion uses one fenced atomic statement %#',async outcome => {
  const query = jest.fn(async () => ({ rowCount: 1 }));
  await completeGatewayRequest(query,{ requestId: 'id',owner: 'owner',providerHash: 'hash',busy: false,outcome });
  expect(query).toHaveBeenCalledTimes(1); expect(query.mock.calls[0][0]).toContain('WITH completed AS');
});
test.each([{ state: 'success',httpStatus: 200 },{ state: 'provider_rejected',httpStatus: 500 },{ state: 'not_dispatched',httpStatus: 200 }])('invalid completion cannot write %#',async outcome => {
  const query = jest.fn(); await expect(completeGatewayRequest(query,{ outcome })).rejects.toThrow('gateway_completion_invalid'); expect(query).not.toHaveBeenCalled();
});
test('already-aborted history does not resolve or call a provider',async () => {
  await expect(readOllamaWorkHistory({},AbortSignal.abort())).rejects.toThrow();
});
test.each([[null,401],['invalid',403],['user',403],['admin',200]])('settings history authorization %s -> %s',async (token,status) => {
  const req = request(app).get('/api/settings/ollama/gateway-history'); if (token) req.set('Authorization',`Bearer ${token}`);
  const response = await req; expect(response.status).toBe(status);
  if (status === 200) { expect(response.body).toEqual({ state: 'not_configured' }); expect(response.headers['cache-control']).toBe('no-store'); }
});
test('settings endpoint rejects duplicate/foreign query keys and supports no mutations',async () => {
  for (const query of ['taskId=1&taskId=2','installation=foreign']) {
    expect((await request(app).get(`/api/settings/ollama/gateway-history?${query}`).set('Authorization','Bearer admin')).status).toBe(400);
  }
  expect((await request(app).post('/api/settings/ollama/gateway-history').set('Authorization','Bearer admin')).status).toBe(404);
});
test('handler sanitizes failures and removes disconnect listeners',async () => {
  const req = Object.assign(new EventEmitter(),{ query: {} }),res = Object.assign(new EventEmitter(),{ set: jest.fn(),status: jest.fn().mockReturnThis(),json: jest.fn() });
  await createGatewayHistoryHandler({ read: async () => { throw new Error('PRIVATE connection'); } })(req,res);
  expect(res.status).toHaveBeenCalledWith(503); expect(res.json).toHaveBeenCalledWith({ error: 'gateway_history_unavailable' });
  expect(req.listenerCount('aborted')).toBe(0); expect(res.listenerCount('close')).toBe(0);
});
test('disconnect aborts the wait and suppresses response writes',async () => {
  const req = Object.assign(new EventEmitter(),{ query: {} }),res = Object.assign(new EventEmitter(),{ set: jest.fn(),status: jest.fn(),json: jest.fn() });
  const handler = createGatewayHistoryHandler({ read: async (_query,signal) => { res.emit('close'); expect(signal.aborted).toBe(true); throw new Error('cancelled'); } });
  await handler(req,res); expect(res.json).not.toHaveBeenCalled();
});
