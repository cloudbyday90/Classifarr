/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_PROBE_DELAY_MS } from './policyNativeProfileRefreshCircuitVocabulary.mjs';
import { LIBRARY_PROFILE_RECOVERY_GRACE_MS, libraryProfileRecoveryReasonSql } from './libraryProfileRecoveryAssessment.mjs';

export const LIBRARY_UPGRADE_READINESS_VERSION = 'library.upgrade_readiness.v1';

const READINESS_SQL = `WITH library_state AS MATERIALIZED (
    SELECT l.id, l.media_type, l.is_active,
        s.revision, s.refreshed_revision, s.changed_at,
        COALESCE(s.revision > s.refreshed_revision, false) AS dirty,
        p.inventory_revision AS profile_revision,
        (p.library_id IS NOT NULL) AS has_profile,
        EXISTS (SELECT 1 FROM media_server_items item WHERE item.library_id=l.id) AS has_inventory,
        job.processing_state, job.available_at, job.lease_expires_at, job.updated_at AS job_updated_at,
        job.updated_at + ($1::bigint * INTERVAL '1 millisecond') AS probe_at
    FROM libraries l
    LEFT JOIN library_profile_inventory_state s ON s.library_id=l.id
    LEFT JOIN library_profiles p ON p.library_id=l.id
    LEFT JOIN LATERAL (
        SELECT processing_state, available_at, lease_expires_at, updated_at
        FROM policy_profile_refresh_outbox
        WHERE library_id=l.id AND request_type='inventory_change'
        ORDER BY id DESC LIMIT 1
    ) job ON TRUE
), classified AS (
    SELECT *, CASE
        WHEN NOT has_inventory AND NOT has_profile AND COALESCE(revision > refreshed_revision, false)=false
            THEN 'no_inventory'
        WHEN revision > refreshed_revision AND NOT is_active THEN 'paused'
        WHEN revision > refreshed_revision AND processing_state='processing'
            AND lease_expires_at > statement_timestamp() THEN 'processing'
        WHEN revision > refreshed_revision AND processing_state='pending'
            AND available_at > statement_timestamp() THEN 'retry_wait'
        WHEN revision > refreshed_revision AND processing_state='pending' THEN 'queued'
        WHEN revision > refreshed_revision AND processing_state='failed'
            AND probe_at > statement_timestamp() THEN 'cooldown'
        WHEN revision > refreshed_revision THEN 'waiting'
        WHEN has_inventory AND has_profile AND revision IS NOT NULL AND profile_revision=revision THEN 'current'
        ELSE 'unverified'
    END AS profile_status,
    ${libraryProfileRecoveryReasonSql('library_state', 2)} AS recovery_reason_id
    FROM library_state
), totals AS (
    SELECT COUNT(*)::integer AS library_count,
        COUNT(*) FILTER (WHERE is_active)::integer AS active_count,
        COUNT(*) FILTER (WHERE media_type='movie')::integer AS movie_count,
        COUNT(*) FILTER (WHERE media_type='tv')::integer AS tv_count,
        COUNT(*) FILTER (WHERE media_type NOT IN ('movie','tv') OR media_type IS NULL)::integer AS other_count,
        COUNT(*) FILTER (WHERE has_inventory AND NOT has_profile)::integer AS missing_profile_count,
        COUNT(*) FILTER (WHERE profile_status='current')::integer AS current_count,
        COUNT(*) FILTER (WHERE profile_status='queued')::integer AS queued_count,
        COUNT(*) FILTER (WHERE profile_status='processing')::integer AS processing_count,
        COUNT(*) FILTER (WHERE profile_status='retry_wait')::integer AS retry_wait_count,
        COUNT(*) FILTER (WHERE profile_status='cooldown')::integer AS cooldown_count,
        COUNT(*) FILTER (WHERE profile_status='waiting')::integer AS waiting_count,
        COUNT(*) FILTER (WHERE profile_status='paused')::integer AS paused_count,
        COUNT(*) FILTER (WHERE profile_status='unverified')::integer AS unverified_count,
        COUNT(*) FILTER (WHERE profile_status='no_inventory')::integer AS no_inventory_count,
        COUNT(*) FILTER (WHERE recovery_reason_id='planner_overdue')::integer AS planner_overdue_count,
        COUNT(*) FILTER (WHERE recovery_reason_id='worker_overdue')::integer AS worker_overdue_count,
        COUNT(*) FILTER (WHERE recovery_reason_id='lease_recovery_overdue')::integer AS lease_recovery_overdue_count
    FROM classified
), complete_captures AS MATERIALIZED (
    SELECT c.library_id, c.media_server_id, c.generation
    FROM media_source_capture_state c JOIN libraries l ON l.id=c.library_id
    WHERE l.is_active AND c.media_server_id=l.media_server_id
        AND c.phase='complete' AND c.mode='full'
        AND c.omitted_count=0 AND c.uncapturable_count=0
        AND c.started_at >= statement_timestamp()-INTERVAL '30 days'
), source_totals AS (
    SELECT (SELECT COUNT(*)::integer FROM complete_captures) AS covered_count,
        COUNT(*)::integer AS issue_count,
        COUNT(*) FILTER (WHERE o.identity_issue='conflicting_provider_ids')::integer AS conflict_count,
        COUNT(*) FILTER (WHERE o.identity_issue='invalid_provider_ids')::integer AS invalid_provider_count,
        COUNT(*) FILTER (WHERE o.identity_issue='invalid_media_type')::integer AS invalid_type_count
    FROM complete_captures c JOIN media_source_observations o
        ON o.library_id=c.library_id AND o.media_server_id=c.media_server_id
        AND o.generation=c.generation
        AND o.last_seen_at >= statement_timestamp()-INTERVAL '30 days'
)
SELECT statement_timestamp() AS observed_at, totals.*, source_totals.*,
    EXISTS (SELECT 1 FROM post_upgrade_tasks
        WHERE task_id='queue_library_profile_revision_verification_v1') AS enrollment_recorded
FROM totals CROSS JOIN source_totals`;

function count(value) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new TypeError('Invalid upgrade readiness count');
    return parsed;
}

/** One read-only aggregate across every library; never exposes names, titles, or provider payloads. */
export async function readLibraryUpgradeReadiness(db) {
    const { rows } = await db.query(READINESS_SQL, [POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_PROBE_DELAY_MS,
        LIBRARY_PROFILE_RECOVERY_GRACE_MS]);
    const row = rows[0];
    if (!row || !Number.isFinite(new Date(row.observed_at).getTime())) {
        throw new TypeError('Invalid upgrade readiness snapshot');
    }
    const report = {
        version: LIBRARY_UPGRADE_READINESS_VERSION,
        asOf: new Date(row.observed_at).toISOString(),
        libraryCount: count(row.library_count),
        activeLibraryCount: count(row.active_count),
        mediaTypes: { movie: count(row.movie_count), tv: count(row.tv_count), other: count(row.other_count) },
        profile: {
            current: count(row.current_count), queued: count(row.queued_count),
            processing: count(row.processing_count), retryWait: count(row.retry_wait_count),
            cooldown: count(row.cooldown_count), waiting: count(row.waiting_count),
            paused: count(row.paused_count), unverified: count(row.unverified_count),
            noInventory: count(row.no_inventory_count), missing: count(row.missing_profile_count),
        },
        upgradeEnrollmentRecorded: row.enrollment_recorded === true,
        recovery: {
            plannerOverdue: count(row.planner_overdue_count),
            workerOverdue: count(row.worker_overdue_count),
            leaseRecoveryOverdue: count(row.lease_recovery_overdue_count),
            graceMinutes: LIBRARY_PROFILE_RECOVERY_GRACE_MS / 60_000,
        },
        sourceIdentity: {
            completeCaptureLibraryCount: count(row.covered_count),
            unresolvedItemCount: count(row.issue_count),
            conflictingProviderItemCount: count(row.conflict_count),
            invalidProviderItemCount: count(row.invalid_provider_count),
            invalidMediaTypeItemCount: count(row.invalid_type_count),
            scope: 'active_complete_full_captures_last_30_days',
        },
    };
    const profile = report.profile;
    const classifiedCount = profile.current + profile.queued + profile.processing + profile.retryWait +
        profile.cooldown + profile.waiting + profile.paused + profile.unverified + profile.noInventory;
    if (classifiedCount !== report.libraryCount ||
        report.mediaTypes.movie + report.mediaTypes.tv + report.mediaTypes.other !== report.libraryCount ||
        profile.missing > report.libraryCount ||
        report.activeLibraryCount > report.libraryCount ||
        report.sourceIdentity.unresolvedItemCount !==
            report.sourceIdentity.conflictingProviderItemCount + report.sourceIdentity.invalidProviderItemCount +
            report.sourceIdentity.invalidMediaTypeItemCount ||
        report.sourceIdentity.completeCaptureLibraryCount > report.activeLibraryCount) {
        throw new TypeError('Inconsistent upgrade readiness snapshot');
    }
    if (report.recovery.plannerOverdue + report.recovery.workerOverdue +
        report.recovery.leaseRecoveryOverdue > report.activeLibraryCount) {
        throw new TypeError('Inconsistent upgrade recovery assessment');
    }
    return report;
}
