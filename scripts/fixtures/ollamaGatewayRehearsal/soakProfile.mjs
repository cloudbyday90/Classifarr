/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const create = (name, durationMs, settleMs, sampleLimit) => Object.freeze({
  name, durationMs, settleMs, sampleLimit,
  foreground: durationMs / 1000, background: durationMs / 10000, offered: durationMs / 1000 + durationMs / 10000,
  runnerMs: name === 'regression' ? 530000 : durationMs + settleMs + 90000, workerMs: durationMs + 30000,
  phases: Object.freeze([
    Object.freeze({ name: 'before', start: 0, end: 60000 }),
    Object.freeze({ name: 'archives', start: 60000, end: durationMs - 60000 }),
    Object.freeze({ name: 'after', start: durationMs - 60000, end: durationMs }),
  ]),
});
const profiles = Object.freeze({ regression: create('regression', 480000, 0, 600), extended: create('extended', 1800000, 60000, 2048) });

/** Fixed fixture profiles only; never caller-defined duration, provider or resource limits. */
export function soakProfile(name = 'regression') {
  if (typeof name !== 'string' || !Object.hasOwn(profiles, name)) throw new Error('soak_profile_invalid');
  return profiles[name];
}

/** A load study without archive progress is not a successful concurrency measurement. */
export function studyWorkerBlocked(profileName, record) {
  return soakProfile(profileName).name === 'extended' && record?.state === 'archive_blocked';
}
