/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { SCHEDULED_CRASH_RECOVERY } from './scheduledInstallationContract.mjs';

export const PUBLISHED_SCHEDULED_RECOVERY_SCHEMA = 'classifarr.release.published-scheduled-recovery.v1';

/** The expected routing receipt has already been validated against CI context. */
export function validatePublishedScheduledRecovery(value, { tag, routing, now }) {
  assert.equal(routing.subject.platform, 'linux/arm64');
  const completed = Date.parse(value?.completedAt);
  const current = Date.parse(now);
  assert.ok(Number.isFinite(completed) && Number.isFinite(current));
  assert.equal(new Date(completed).toISOString(), value.completedAt);
  assert.ok(completed >= Date.parse(routing.completedAt));
  assert.ok(current - completed <= 6 * 60 * 60 * 1000 && completed - current <= 5 * 60 * 1000);
  const normalized = {
    schemaVersion: PUBLISHED_SCHEDULED_RECOVERY_SCHEMA, status: 'passed', tag,
    completedAt: value.completedAt, workflow: routing.workflow, subject: routing.subject,
    deploymentProfile: 'unraid', crashRecovery: SCHEDULED_CRASH_RECOVERY, cleanup: 'passed',
  };
  assert.deepEqual(value, normalized);
  return normalized;
}
