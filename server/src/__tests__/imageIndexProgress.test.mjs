/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, test, expect } from '@jest/globals';
import { buildImageIndexProgress } from '../services/imageIndexProgress.mjs';

const observedAt = '2026-10-01T12:00:00.000Z';
const base = { demand: 'needed', gate: 'ready', indexes: [{ status: 'missing' }], readiness: 'ready', observedAt };
const state = { task_id: '7', attempts: 1, next_attempt_at: new Date('2026-10-01T13:00:00Z') };
const task = { id: '7', status: 'pending', source: 'image_index_reconciliation' };
describe('image index progress projection', () => {
  test.each([
    [{ demand: 'disabled' }, 'not_needed', 'disabled'],
    [{ demand: 'not_configured' }, 'needs_review', 'not_configured'],
    [{ gate: null }, 'waiting', 'restore_verification_required'],
    [{ indexes: null }, 'needs_review', 'definition_mismatch'],
    [{ phase: 'validating' }, 'running', 'validating'],
    [{ indexes: [{ status: 'verified' }] }, 'verified', 'healthy'],
    [{ state, task: { ...task, status: 'processing', live_claim: true } }, 'waiting', 'worker_claimed'],
    [{ state }, 'needs_review', 'repair_unverified'],
    [{ state, task: { ...task, status: 'failed' } }, 'needs_review', 'repair_unverified'],
    [{ state, task: { ...task, id: '8' } }, 'needs_review', 'repair_unverified'],
    [{ state: { ...state, attempts: 3 }, task }, 'needs_review', 'attempt_limit'],
    [{ task }, 'needs_review', 'attempt_limit'],
    [{ task, state: { ...state, task_id: null } }, 'needs_review', 'attempt_limit'],
    [{ readiness: 'unavailable' }, 'unavailable', 'observation_failed'],
    [{ readiness: 'ingesting' }, 'waiting', 'ingesting'],
    [{ task: { ...task, source: 'manual', status: 'processing' } }, 'waiting', 'claim_recovery'],
    [{ state, task }, 'waiting', 'cooldown'],
    [{ task: { ...task, source: 'manual', next_retry_at: state.next_attempt_at } }, 'waiting', 'queue_delay'],
    [{ task: { ...task, source: 'manual' } }, 'waiting', 'queued'],
    [{}, 'waiting', 'awaiting_check'],
  ])('%j yields %s/%s', (input, status, reason) => {
    expect(buildImageIndexProgress({ ...base, ...input })).toMatchObject({ status, reason, observedAt });
  });
  test('exports only durable automatic counters and time, not queue metadata', () => {
    expect(buildImageIndexProgress({ ...base, state, task })).toEqual({ status: 'waiting', reason: 'cooldown',
      observedAt, indexes: base.indexes, automatic: { started: 1, limit: 3, nextEligibleAt: '2026-10-01T13:00:00.000Z' } });
    expect(buildImageIndexProgress({ ...base, state: { ...state, next_attempt_at: null }, task }).reason).toBe('queued');
    expect(buildImageIndexProgress({ ...base, state: { ...state, next_attempt_at: new Date(observedAt) }, task }).reason).toBe('queued');
  });
  test('a final active attempt can still finish; live DDL outranks a terminal queue record', () => {
    expect(buildImageIndexProgress({ ...base, state: { ...state, attempts: 3 },
      task: { ...task, status: 'processing', live_claim: true } }).reason).toBe('worker_claimed');
    expect(buildImageIndexProgress({ ...base, state, task: { ...task, status: 'failed' }, phase: 'building' }).status).toBe('running');
  });
});
