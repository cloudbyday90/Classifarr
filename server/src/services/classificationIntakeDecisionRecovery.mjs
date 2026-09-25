/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { captureCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { READ_INTAKE_DECISION_RECOVERY_SQL, FILL_INTAKE_DECISION_CONTEXTS_SQL } from './classificationIntakeDecisionRecoverySql.mjs';

function queueId(value) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^[1-9][0-9]{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) {
    throw new Error('intake_decision_recovery_invalid_id');
  }
  return text;
}

/** Advisory exact-copy repair, never classification replay or historical inference. */
export class ClassificationIntakeDecisionRecovery {
  constructor({ db }) {
    this.db = db;
    this.afterQueueTaskId = '0';
    this.activeRun = null;
  }

  run() {
    if (!this.activeRun) {
      this.activeRun = this.runBatch().finally(() => { this.activeRun = null; });
    }
    return this.activeRun;
  }

  async runBatch() {
    const { rows } = await this.db.query(READ_INTAKE_DECISION_RECOVERY_SQL, [this.afterQueueTaskId]);
    if (!Array.isArray(rows) || rows.length > 500) throw new Error('intake_decision_recovery_row_budget');
    const candidates = [];
    let lastId = '0';
    for (const row of rows) {
      lastId = queueId(row.queue_task_id);
      const context = captureCorrectionDecisionContext({ id: row.classification_id,
        media_type: row.media_type, tmdb_id: row.tmdb_id, method: row.method,
        metadata: { classification_details: { destination_decision: row.capture } } });
      if (context) candidates.push({ queue_task_id: lastId, classification_id: context.classificationId, decision_context: context });
    }
    const recovered = candidates.length
      ? (await this.db.query(FILL_INTAKE_DECISION_CONTEXTS_SQL, [JSON.stringify(candidates)])).rowCount : 0;
    // Move past invalid/missing originals as well. Failures above retain the cursor.
    this.afterQueueTaskId = rows.length === 500 ? lastId : '0';
    return recovered;
  }
}
