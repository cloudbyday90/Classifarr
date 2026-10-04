/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import { hasEmbeddedSchemaHandoff } from '../config/embeddedSchemaHandoff.mjs';
import { startEmbeddedApplication } from '../bootstrap/embeddedChildProcess.mjs';
import { assertCompatibleWorkerEnvironment } from '../bootstrap/embeddedCompatibleWorkerBoundary.mjs';
import { compatibleMaintenanceEnvironment } from '../bootstrap/embeddedCompatibleMaintenanceEnvironment.mjs';

test('handoff is absent for direct host startup and exact for supervised normal startup', () => {
  expect(hasEmbeddedSchemaHandoff({})).toBe(false);
  expect(hasEmbeddedSchemaHandoff({ CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF: 'supervised-v1' })).toBe(true);
});
test.each(['', 'true', true, 'supervised-v2', null])('rejects handoff %j', value => {
  expect(() => hasEmbeddedSchemaHandoff({ CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF: value })).toThrow('handoff_invalid');
});
test.each([{ CLASSIFARR_RUNTIME_MODE: 'restore' }, { CLASSIFARR_SCHEMA_MAINTENANCE: 'external' }])('handoff cannot bypass mode %j', mode => {
  expect(() => hasEmbeddedSchemaHandoff({ ...mode, CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF: 'supervised-v1' })).toThrow('handoff_invalid');
});
test('launcher adds a fresh routing hint without mutating the source environment', () => {
  const environment = Object.freeze({ TEST: 'value' });
  const spawnFn = jest.fn(() => new EventEmitter());
  startEmbeddedApplication({ environment, spawnFn, schemaMaintenance: true });
  expect(spawnFn.mock.calls[0][2].env).toEqual({ TEST: 'value', CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF: 'supervised-v1' });
});
test('saved hint cannot reach launch or a maintenance child', () => {
  const spawnFn = jest.fn();
  const environment = { ...compatibleMaintenanceEnvironment(), CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF: 'supervised-v1' };
  expect(() => startEmbeddedApplication({ environment, spawnFn })).toThrow();
  expect(spawnFn).not.toHaveBeenCalled();
  expect(() => assertCompatibleWorkerEnvironment(environment, { uid: 99, gid: 100, platform: 'linux', cwd: '/app' })).toThrow();
});
