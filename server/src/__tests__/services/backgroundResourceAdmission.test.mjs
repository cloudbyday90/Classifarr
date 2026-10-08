/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';

const MIB = 1024 * 1024;
const memory = available => ({ available: available * MIB, constrained: 2048 * MIB, total: 16384 * MIB });

test('opt-in observer reports the exact decision budget, including hysteresis and reservations', () => {
  let available = 1023, reads = 0;
  const events = [];
  const admission = createBackgroundResourceAdmission({ readMemory: () => { reads++; return memory(available); },
    onDecision: event => events.push(event) });
  expect(admission.tryAcquire('discovery').allowed).toBe(false);
  available = 1088;
  const permit = admission.tryAcquire('discovery');
  expect(permit.allowed).toBe(true);
  expect(events[0]).toEqual({ kind: 'discovery', allowed: false, reason: 'memory_pressure',
    availableBytes: 1023 * MIB, reserveBytes: 256 * MIB, reservedBytes: 0, workBytes: 768 * MIB,
    hysteresisBytes: 0, requiredBytes: 1024 * MIB });
  expect(events[1]).toMatchObject({ allowed: true, reservedBytes: 0, hysteresisBytes: 64 * MIB, requiredBytes: 1088 * MIB });
  const queue = admission.tryAcquire('queue');
  expect(events[2]).toMatchObject({ allowed: true, reservedBytes: 768 * MIB, requiredBytes: 1088 * MIB });
  expect(reads).toBe(3); expect(Object.isFrozen(events[0])).toBe(true);
  queue.release(); permit.release(); permit.release();
  admission.tryAcquire('discovery').release();
  expect(events.at(-1)).toMatchObject({ reservedBytes: 0, hysteresisBytes: 0 });
});

test('observer exceptions cannot change admission, busy/unknown results or release', () => {
  let value = memory(2048);
  const admission = createBackgroundResourceAdmission({ readMemory: () => value,
    onDecision: () => { throw new Error('private observer failure'); } });
  const first = admission.tryAcquire('discovery'); expect(first.allowed).toBe(true);
  expect(admission.tryAcquire('discovery')).toEqual({ allowed: false, reason: 'busy' });
  first.release(); value = null;
  expect(admission.tryAcquire('discovery')).toEqual({ allowed: false, reason: 'memory_unknown' });
  value = memory(2048); const next = admission.tryAcquire('discovery'); expect(next.allowed).toBe(true); next.release();
});

test('competing work shares one budget; ingestion/backfill take priority over new discovery', () => {
  const admission = createBackgroundResourceAdmission({ readMemory: () => memory(512) });
  const ingestion = admission.tryAcquire('ingestion');
  const queue = admission.tryAcquire('queue');
  expect(ingestion.allowed).toBe(true);
  expect(queue.allowed).toBe(true);
  expect(admission.tryAcquire('ingestion')).toEqual({ allowed: false, reason: 'memory_pressure' });
  expect(admission.tryAcquire('discovery')).toEqual({ allowed: false, reason: 'busy' });
  ingestion.release(); ingestion.release(); queue.release();
  const recovered = admission.tryAcquire('ingestion');
  expect(recovered.allowed).toBe(true);
  recovered.release();
});

test('hysteresis avoids threshold oscillation without letting a heavy refusal block smaller work', () => {
  let available = 1023;
  const admission = createBackgroundResourceAdmission({ readMemory: () => memory(available) });
  expect(admission.tryAcquire('discovery').reason).toBe('memory_pressure');
  available = 1024;
  expect(admission.tryAcquire('discovery').allowed).toBe(false);
  const queue = admission.tryAcquire('queue');
  expect(queue.allowed).toBe(true); queue.release();
  available = 1088;
  const discovery = admission.tryAcquire('discovery');
  expect(discovery.allowed).toBe(true);
  // Existing discovery is not aborted by a new request, and its reservation is counted.
  expect(admission.tryAcquire('ingestion').reason).toBe('memory_pressure');
  const small = admission.tryAcquire('queue');
  expect(small.allowed).toBe(true); small.release(); discovery.release();
});

test.each(['ingestion', 'queue', 'discovery'])('caps %s independently and releases idempotently', kind => {
  const admission = createBackgroundResourceAdmission({ readMemory: () => ({ available: 16e9, constrained: 0, total: 16e9 }) });
  const limit = { ingestion: 2, queue: 25, discovery: 1 }[kind];
  const permits = Array.from({ length: limit }, () => admission.tryAcquire(kind));
  expect(permits.every(permit => permit.allowed)).toBe(true);
  expect(admission.tryAcquire(kind)).toEqual({ allowed: false, reason: 'busy' });
  for (const permit of permits) { permit.release(); permit.release(); }
  const next = admission.tryAcquire(kind);
  expect(next.allowed).toBe(true); next.release();
});

test.each([null, {}, memory(NaN), memory(-1), memory(Infinity), { ...memory(2048), constrained: -1 }, { ...memory(2048), total: 0 }])(
  'unknown telemetry fails closed then recovers: %j', initial => {
    let value = initial;
    const admission = createBackgroundResourceAdmission({ readMemory: () => value });
    expect(admission.tryAcquire('queue')).toEqual({ allowed: false, reason: 'memory_unknown' });
    value = memory(512);
    const permit = admission.tryAcquire('queue');
    expect(permit.allowed).toBe(true); permit.release();
  });

test('reader exceptions and unsupported work classes reveal no host details', () => {
  const admission = createBackgroundResourceAdmission({ readMemory: () => { throw new Error('PRIVATE'); } });
  expect(admission.tryAcquire('queue')).toEqual({ allowed: false, reason: 'memory_unknown' });
  for (const kind of ['__proto__', 'constructor', 'PRIVATE', null]) {
    expect(() => admission.tryAcquire(kind)).toThrow('Unknown background work class');
  }
});

test('300 mixed recovery cycles drain reservations without a growing waiter list or new timers', () => {
  let available = 1536;
  const admission = createBackgroundResourceAdmission({ readMemory: () => memory(available) });
  for (let iteration = 0; iteration < 300; iteration += 1) {
    const ingestion = admission.tryAcquire('ingestion'), queue = admission.tryAcquire('queue');
    expect(ingestion.allowed && queue.allowed).toBe(true);
    expect(admission.tryAcquire('discovery').reason).toBe('busy');
    available = 128;
    expect(admission.tryAcquire('queue').reason).toBe('memory_pressure');
    ingestion.release(); queue.release();
    available = 1536;
    const discovery = admission.tryAcquire('discovery');
    expect(discovery.allowed).toBe(true); discovery.release();
  }
});

test('per-attempt observation counts current work without mutating global observations or reservations', () => {
  const admission = createBackgroundResourceAdmission({ readMemory: () => memory(400) });
  const ingestion = admission.tryAcquire('ingestion'), decisions = [];
  expect(admission.tryAcquire('queue', { onDecision: value => decisions.push(value) }).allowed).toBe(false);
  expect(decisions[0]).toMatchObject({ phase: 'shared_admission', constrainedBytes: 2048 * MIB,
    active: { ingestion: 1, queue: 0, discovery: 0 }, reservedBytes: 128 * MIB, requiredBytes: 448 * MIB });
  ingestion.release();
  expect(decisions[0].active.ingestion).toBe(1);
  const queue = admission.tryAcquire('queue', { onDecision: () => { throw new Error('PRIVATE'); } });
  expect(queue.allowed).toBe(true); queue.release();
});
