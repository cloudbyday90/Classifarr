/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CATALOG_REFRESH_MS, catalogRecoveryPlan } from './libraryCatalogRecoveryPolicy.mjs';
import { SourceContentDeferredError } from './sourceContentFailure.mjs';

/** Uses only the checked-out ingestion owner connection; never a replacement pool. */
export function createSourceContentCircuitRepository(db, source) {
  const params = [source.media_server_id, source.catalog_revision];
  const ticket = row => ({ epoch: row.epoch, attempts: row.attempts, probe: row.state === 'probing' });
  const defer = row => new SourceContentDeferredError(row.state === 'review' ? 'source_content_review' : 'source_content_cooldown', row.next_attempt_at);
  const current = row => {
    if (!row || String(row.current_revision) !== String(source.catalog_revision)) throw new SourceContentDeferredError('source_content_changed');
    return row;
  };
  const read = async () => current((await db.query(`SELECT c.*,ms.catalog_revision AS current_revision,
      c.next_attempt_at<=clock_timestamp() AS due FROM media_server ms
      LEFT JOIN media_source_content_circuits c ON c.media_server_id=ms.id
      WHERE ms.id=$1 AND ms.is_active AND ms.catalog_revision=$2`, params)).rows[0]);
  const withRow = callback => db.withTransaction(async tx => {
    const { rows } = await tx.query('SELECT id FROM media_server WHERE id=$1 AND catalog_revision=$2 AND is_active FOR SHARE', params);
    if (!rows.length) throw new SourceContentDeferredError('source_content_changed');
    await tx.query(`INSERT INTO media_source_content_circuits AS previous(media_server_id,source_revision)
      VALUES ($1,$2) ON CONFLICT(media_server_id) DO UPDATE SET source_revision=$2,
        epoch=previous.epoch+1,state='closed',attempts=0,reason=NULL,next_attempt_at=NULL,updated_at=clock_timestamp()
      WHERE previous.source_revision<>$2`, params);
    const row = (await tx.query(`SELECT *,next_attempt_at<=clock_timestamp() AS due
      FROM media_source_content_circuits WHERE media_server_id=$1 FOR UPDATE`, [params[0]])).rows[0];
    return callback(tx, row);
  });
  return {
    async check() {
      const row = await read();
      if (row.source_revision == null || String(row.source_revision) !== String(source.catalog_revision) || row.state === 'closed') return;
      if (row.state === 'review' || !row.due) throw defer(row);
    },
    async admit(acquireProbe) {
      const existing = await read();
      if (String(existing.source_revision) === String(source.catalog_revision) && existing.state === 'closed') return { ...ticket(existing), probe: false };
      return withRow(async (tx, row) => {
        if (row.state === 'closed') return ticket(row);
        if (row.state === 'review' || !row.due) throw defer(row);
        if (!await acquireProbe()) throw new SourceContentDeferredError('source_content_probe_busy', row.next_attempt_at);
        const { rows: [claimed] } = await tx.query(`UPDATE media_source_content_circuits SET state='probing',
          epoch=epoch+1,attempts=LEAST(attempts+1,5),reason='probe_interrupted',
          next_attempt_at=clock_timestamp()+$2*INTERVAL '1 millisecond',updated_at=clock_timestamp()
          WHERE media_server_id=$1 RETURNING *`, [params[0], CATALOG_REFRESH_MS]);
        return ticket(claimed);
      });
    },
    async fail(admission, failure) {
      return withRow(async (tx, row) => {
        if (row.state === 'review') return defer(row);
        const plan = catalogRecoveryPlan({ ...failure, attempts: Math.max(1, row.attempts) });
        // Late failures may extend a wait, never shorten a newer server delay.
        const { rows: [updated] } = await tx.query(`UPDATE media_source_content_circuits SET
          state=$2,attempts=GREATEST(attempts,1),reason=$3,epoch=epoch+1,updated_at=clock_timestamp(),
          next_attempt_at=CASE WHEN $4::double precision IS NULL THEN NULL
            WHEN epoch=$5 THEN clock_timestamp()+$4*INTERVAL '1 millisecond'
            ELSE GREATEST(next_attempt_at,clock_timestamp()+$4*INTERVAL '1 millisecond') END
          WHERE media_server_id=$1 RETURNING *`,
        [params[0], plan.state === 'needs_review' ? 'review' : 'open', failure.reason, plan.delayMs, admission.epoch]);
        return defer(updated);
      });
    },
    async settleProbe(admission, valid) {
      if (!admission.probe) return;
      const delay = valid ? null : catalogRecoveryPlan({ reason: 'unreachable', httpStatus: null, attempts: admission.attempts }).delayMs;
      const result = await db.query(`UPDATE media_source_content_circuits c SET state=$4,
        attempts=CASE WHEN $5 THEN 0 ELSE attempts END,reason=CASE WHEN $5 THEN NULL ELSE 'probe_inconclusive' END,
        epoch=epoch+1,next_attempt_at=clock_timestamp()+$6*INTERVAL '1 millisecond',updated_at=clock_timestamp()
        FROM media_server ms WHERE c.media_server_id=$1 AND c.source_revision=$2 AND c.epoch=$3
          AND c.state='probing' AND ms.id=c.media_server_id AND ms.is_active AND ms.catalog_revision=$2`,
      [...params, admission.epoch, valid ? 'closed' : 'open', valid, delay]);
      if (valid && result.rowCount !== 1) throw defer(await read());
    },
  };
}
