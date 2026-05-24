import { resolveExecutor } from '../utils/dbUtils.mjs';

export async function findExactMatch(db, { tmdbId, mediaType }) {
  if (!tmdbId) return null;
  const result = await db.query(
    `SELECT *
       FROM classification_evidence
      WHERE scope      = 'item_exact'
        AND tmdb_id    = $1
        AND media_type = $2
        AND status     = 'active'
      ORDER BY confidence DESC, usage_count DESC
      LIMIT 1`,
    [tmdbId, mediaType]
  );
  return result.rows[0] ?? null;
}

export async function findRelatedEvidence(db, { libraryIds = [], mediaType = null, scope = null, minConfidence = 0 } = {}) {
  const conditions = [`status = 'active'`, `scope != 'item_exact'`];
  const params = [];

  if (libraryIds.length > 0) {
    params.push(libraryIds);
    conditions.push(`library_id = ANY($${params.length})`);
  }

  if (mediaType) {
    params.push(mediaType);
    conditions.push(`media_type = $${params.length}`);
  }

  if (scope) {
    params.push(scope);
    conditions.push(`scope = $${params.length}`);
  }

  if (minConfidence > 0) {
    params.push(minConfidence);
    conditions.push(`confidence >= $${params.length}`);
  }

  const result = await db.query(
    `SELECT *
       FROM classification_evidence
      WHERE ${conditions.join(' AND ')}
      ORDER BY confidence DESC, usage_count DESC`,
    params
  );
  return result.rows;
}

export async function listAll(db, { client = null } = {}) {
  const executor = resolveExecutor(client, db);
  const result = await executor.query(
    `SELECT * FROM classification_evidence ORDER BY id ASC`
  );
  return result.rows;
}

export async function findById(db, id) {
  const result = await db.query(
    `SELECT * FROM classification_evidence WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findPaginated(db, { scope = null, provenance = null, status = null, libraryId = null, mediaType = null, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (scope) {
    params.push(scope);
    conditions.push(`scope = $${params.length}`);
  }
  if (provenance) {
    params.push(provenance);
    conditions.push(`provenance = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (libraryId != null) {
    params.push(libraryId);
    conditions.push(`library_id = $${params.length}`);
  }
  if (mediaType) {
    params.push(mediaType);
    conditions.push(`media_type = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM classification_evidence ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit);
  params.push(offset);
  const rowResult = await db.query(
    `SELECT * FROM classification_evidence
       ${where}
       ORDER BY id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows: rowResult.rows, total };
}

export async function getSummary(db) {
  const [scopeResult, provenanceResult, statusResult, totalResult] = await Promise.all([
    db.query(
      `SELECT scope, COUNT(*) AS count
         FROM classification_evidence
         GROUP BY scope
         ORDER BY count DESC`
    ),
    db.query(
      `SELECT provenance, COUNT(*) AS count
         FROM classification_evidence
         GROUP BY provenance
         ORDER BY count DESC`
    ),
    db.query(
      `SELECT status, COUNT(*) AS count
         FROM classification_evidence
         GROUP BY status
         ORDER BY count DESC`
    ),
    db.query(`SELECT COUNT(*) AS count FROM classification_evidence`)
  ]);

  const byScope = Object.fromEntries(scopeResult.rows.map(r => [r.scope, parseInt(r.count, 10)]));
  const byProvenance = Object.fromEntries(provenanceResult.rows.map(r => [r.provenance, parseInt(r.count, 10)]));
  const byStatus = Object.fromEntries(statusResult.rows.map(r => [r.status, parseInt(r.count, 10)]));
  const total = parseInt(totalResult.rows[0].count, 10);

  return { byScope, byProvenance, byStatus, total };
}

export async function updateStatus(db, { id, status }) {
  const result = await db.query(
    `UPDATE classification_evidence
        SET status     = $2,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, status]
  );
  return result.rows[0] ?? null;
}
