/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ValidationError } from '../utils/appError.mjs';
import { COMPLETE_SOURCE_CAPTURES_CTE, CURRENT_SOURCE_ISSUE_JOIN } from './sourceIdentityIssueScope.mjs';

const PAGE_SIZE = 50;

export function parseSourceIdentityIssueOffset(query = {}) {
    if (Object.keys(query).some(key => key !== 'offset') ||
        (query.offset !== undefined && (typeof query.offset !== 'string' || !/^(0|[1-9]\d{0,8})$/.test(query.offset)))) {
        throw new ValidationError('Invalid source issue page');
    }
    return Number(query.offset ?? 0);
}

const READ_ISSUES = `WITH ${COMPLETE_SOURCE_CAPTURES_CTE}, issues AS MATERIALIZED (
    SELECT o.library_id, o.media_server_id, o.external_id, o.title, o.year,
        o.media_type, o.identity_issue, o.recovery_retry_after, o.last_seen_at,
        l.name AS library_name,
        CASE WHEN o.identity_issue IN ('invalid_provider_ids','invalid_media_type') THEN 'source_review'
            WHEN o.recovery_retry_after > statement_timestamp() THEN 'retry_wait'
            WHEN o.recovery_retry_after IS NOT NULL THEN 'retry_due'
            ELSE 'not_recorded' END AS recovery_state
    ${CURRENT_SOURCE_ISSUE_JOIN}
    JOIN libraries l ON l.id=o.library_id
), totals AS (
    SELECT COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE recovery_state='source_review')::integer AS source_review,
        COUNT(*) FILTER (WHERE recovery_state='retry_wait')::integer AS retry_wait,
        COUNT(*) FILTER (WHERE recovery_state='retry_due')::integer AS retry_due,
        COUNT(*) FILTER (WHERE recovery_state='not_recorded')::integer AS not_recorded
    FROM issues
), page AS (
    SELECT * FROM issues ORDER BY library_id, media_server_id, external_id LIMIT $1 OFFSET $2
)
SELECT statement_timestamp() AS as_of, totals.*,
    (SELECT COUNT(*)::integer FROM complete_captures) AS covered_libraries,
    (SELECT COUNT(*)::integer FROM libraries WHERE is_active) AS active_libraries,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'libraryId',library_id,'libraryName',library_name,'mediaServerId',media_server_id,'externalId',external_id,
        'title',title,'year',year,'mediaType',media_type,'issue',identity_issue,
        'recoveryState',recovery_state,'retryAfter',recovery_retry_after,'lastSeenAt',last_seen_at)
        ORDER BY library_id,media_server_id,external_id) FROM page),'[]'::jsonb) AS items
FROM totals`;

const count = value => {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid source issue count');
    return value;
};
const text = value => typeof value === 'string'
    ? value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim().slice(0, 500) : null;

/** Single read-only snapshot: counts and page use the same evidence population. */
export async function readSourceIdentityIssues(db, offset = 0) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 999999999) throw new ValidationError('Invalid source issue page');
    const { rows } = await db.query(READ_ISSUES, [PAGE_SIZE, offset]);
    const row = rows[0];
    const total = count(row.total);
    const recovery = Object.fromEntries(['source_review', 'retry_wait', 'retry_due', 'not_recorded']
        .map(key => [key, count(row[key])]));
    if (Object.values(recovery).reduce((sum, value) => sum + value, 0) !== total) {
        throw new TypeError('Inconsistent source issue counts');
    }
    return {
        version: 'library.source_identity_issues.v1', asOf: new Date(row.as_of).toISOString(),
        total, offset, pageSize: PAGE_SIZE,
        coveredLibraryCount: count(row.covered_libraries), activeLibraryCount: count(row.active_libraries),
        recovery,
        items: row.items.map(item => ({
            key: createHash('sha256').update(JSON.stringify([item.libraryId, item.mediaServerId, item.externalId])).digest('hex'),
            libraryId: item.libraryId, libraryName: text(item.libraryName), title: text(item.title),
            year: item.year, mediaType: item.mediaType, issue: item.issue,
            recoveryState: item.recoveryState, retryAfter: item.retryAfter, lastSeenAt: item.lastSeenAt,
        })),
    };
}
