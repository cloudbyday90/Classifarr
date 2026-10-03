/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { releaseQueueClaim } from './queueTaskAcknowledgementService.mjs';
import { QUEUE_TASK_FAILURE_REASON_IDS } from './queueTaskFailureReason.mjs';

/** Best effort within the existing process deadline. No retries or new authority. */
export async function releaseShutdownClaims(db, claims) {
  const released = [];
  let failed = 0;
  // Snapshot before awaiting: a finishing task must not alter this iteration.
  for (const task of [...claims]) {
    try {
      if (await releaseQueueClaim(db, task, QUEUE_TASK_FAILURE_REASON_IDS.GRACEFUL_SHUTDOWN_RECOVERED)) {
        released.push(task.id);
      }
    } catch {
      // One rejected write does not decide the fate of every other claim.
      // A lost connection/uncertain result still relies on normal visibility recovery.
      failed += 1;
    }
  }
  return { released, failed };
}
