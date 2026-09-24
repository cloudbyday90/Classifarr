/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';

// Migrations own DDL. Fail closed when a worker starts against an old schema.
export async function ensureTables() {
  await db.query(`SELECT batch.next_attempt_at, item.execution_version
    FROM reclassification_batches batch
    LEFT JOIN reclassification_batch_items item ON item.batch_id = batch.id LIMIT 0`);
}
