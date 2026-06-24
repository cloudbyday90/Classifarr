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
        }
        stats.total[status] = (stats.total[status] || 0) + count;
    }

    return stats;
}

export function applyDeferredCounts(stats, tavilyDeferredCount) {
    stats.tavily.deferred = tavilyDeferredCount;
    stats.total.deferred = tavilyDeferredCount;
    stats.tavily.actionablePending = Math.max(0, stats.tavily.pending - tavilyDeferredCount);
    stats.web_search.actionablePending = stats.web_search.pending;
    stats.omdb.actionablePending = stats.omdb.pending;
    stats.tmdb.actionablePending = stats.tmdb.pending;
    stats.total.actionablePending = Math.max(0, stats.total.pending - tavilyDeferredCount);
    return stats;
}

export async function getStats({ db, normalizeTavilyMonthlyDeferredRows, resolveRetriesWithExistingMetadata, failExhaustedPendingRetries, countTavilyMonthlyDeferredRows }) {
    await normalizeTavilyMonthlyDeferredRows();
    await resolveRetriesWithExistingMetadata();
    await failExhaustedPendingRetries();

    const result = await db.query(`
      SELECT 
        enrichment_type,
        status,
        COUNT(*) as count
      FROM enrichment_retry_queue
      GROUP BY enrichment_type, status
      ORDER BY enrichment_type, status
    `);

    const stats = aggregateStatsRows(result.rows);

    const tavilyDeferredCount = await countTavilyMonthlyDeferredRows();
    applyDeferredCounts(stats, tavilyDeferredCount);

    return stats;
}
