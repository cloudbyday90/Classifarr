import { RETRY_CREDENTIALS_BLOCKED_SQL } from './enrichmentRetryCredentialGate.mjs';
import { RETRY_EFFECTIVE_DUE_SQL } from './enrichmentRetryDuePolicy.mjs';

export function createEmptyStats() {
    return {
        tavily: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 },
        web_search: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 },
        omdb: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 },
        tmdb: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 },
        total: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, deferred: 0, actionablePending: 0 }
    };
}

export function aggregateStatsRows(rows) {
    const stats = createEmptyStats();

    for (const row of rows) {
        const type = row.enrichment_type || 'tavily';
        const status = row.status || 'pending';
        const count = parseInt(row.count) || 0;

        if (stats[type]) {
            stats[type][status] = count;
            if (status === 'pending') stats[type].deferred = parseInt(row.deferred_count, 10) || 0;
        }
        stats.total[status] = (stats.total[status] || 0) + count;
    }

    return stats;
}

export function applyDeferredCounts(stats, tavilyDeferredCount) {
    stats.tavily.deferred = Math.max(stats.tavily.deferred, tavilyDeferredCount);
    stats.total.deferred = 0;
    for (const type of ['tavily', 'web_search', 'omdb', 'tmdb']) {
        stats[type].actionablePending = Math.max(0, stats[type].pending - stats[type].deferred);
        stats.total.deferred += stats[type].deferred;
    }
    stats.total.actionablePending = Math.max(0, stats.total.pending - stats.total.deferred);
    return stats;
}

export async function getStats({ db, countTavilyMonthlyDeferredRows }) {
    const result = await db.query(`
      SELECT 
        enrichment_type,
        status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'pending' AND (
          (${RETRY_EFFECTIVE_DUE_SQL}) > statement_timestamp() OR cooldown.next_attempt_at > statement_timestamp()
          OR ${RETRY_CREDENTIALS_BLOCKED_SQL}
          OR (enrichment_type = 'tavily' AND erq.reason = 'tavily_monthly_quota_deferred')
        )) AS deferred_count
      FROM enrichment_retry_queue erq
      LEFT JOIN enrichment_retry_cooldowns cooldown ON cooldown.dependency =
        CASE WHEN enrichment_type = 'omdb' THEN 'omdb' ELSE 'web_search' END
        AND enrichment_type IN ('omdb', 'web_search', 'tavily')
      GROUP BY enrichment_type, status
      ORDER BY enrichment_type, status
    `);

    const stats = aggregateStatsRows(result.rows);

    const tavilyDeferredCount = await countTavilyMonthlyDeferredRows();
    applyDeferredCounts(stats, tavilyDeferredCount);

    return stats;
}
