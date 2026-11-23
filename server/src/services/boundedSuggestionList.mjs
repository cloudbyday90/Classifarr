/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const PAGE_SIZE = 20;
const MAX_PAGE_BYTES = 64 * 1024;

export async function readSuggestionPage(db, { status, policyId, beforeId }) {
    const { rows } = await db.query(`
        SELECT s.id, s.policy_id, left(p.name, 160) AS policy_name, left(l.name, 160) AS library_name,
            s.suggestion_type, s.status, s.confidence, s.impact_estimate,
            s.created_at, s.applied_at, s.superseded_at
        FROM policy_tuning_suggestions s
        JOIN library_policies p ON p.id = s.policy_id
        JOIN libraries l ON l.id = p.library_id
        WHERE s.id > 0
          AND ($1::text IS NULL OR s.status = $1)
          AND ($2::integer IS NULL OR s.policy_id = $2)
          AND ($3::integer IS NULL OR s.id < $3)
        ORDER BY s.id DESC
        LIMIT $4
    `, [status, policyId, beforeId, PAGE_SIZE + 1]);

    const items = rows.slice(0, PAGE_SIZE).map(row => ({
        ...row,
        created_at: row.created_at instanceof Date ? row.created_at.toJSON() : null,
        applied_at: row.applied_at instanceof Date ? row.applied_at.toJSON() : null,
        superseded_at: row.superseded_at instanceof Date ? row.superseded_at.toJSON() : null,
    }));
    const nextBeforeId = rows.length > PAGE_SIZE ? items.at(-1).id : null;
    const body = JSON.stringify({ items, nextBeforeId });
    if (Buffer.byteLength(body) > MAX_PAGE_BYTES) throw new Error('Suggestion page exceeded its response limit');
    return body;
}
