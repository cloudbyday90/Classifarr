/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { WebSearchProviderStorage } from './webSearchProviderStorage.mjs';
import { WebSearchProviderUsageCache } from './webSearchProviderUsageCache.mjs';
import { WebSearchProviderRouter } from './webSearchProviderRouter.mjs';
import { createWebSearchRetryInspector } from './webSearchRetryReadiness.mjs';
import { readRetryReadinessPage } from './retryReadinessRepository.mjs';
import { summarizeRetryReadiness } from './retryReadinessSummary.mjs';

function readOnlyRouter(client) {
  return new WebSearchProviderRouter({
    storage: new WebSearchProviderStorage({ db: client, healthHistory: null }),
    executor: { cacheStore: new WebSearchProviderUsageCache({ db: client }) },
    qualityCalibrationService: null, routeHistory: null,
  });
}

/** Bounded on-demand observation, not a background process or recovery authority. */
export function createRetryReadinessService({ database = db, createRouter = readOnlyRouter, now = Date.now } = {}) {
  let inFlight = null, cached = null;
  return {
    getReport() {
      const observedAt = now();
      const age = cached ? observedAt - Date.parse(cached.observedAt) : null;
      if (age !== null && age >= 0 && age < 30_000) return Promise.resolve(cached);
      if (inFlight) return inFlight;
      inFlight = database.withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        await client.query("SET LOCAL statement_timeout = '2000ms'");
        await client.query("SET LOCAL lock_timeout = '250ms'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
        const pages = [];
        for (const type of ['web_search', 'tavily']) pages.push(await readRetryReadinessPage(client, type));
        const router = createRouter(client);
        return summarizeRetryReadiness(pages, items => createWebSearchRetryInspector(router, items, { explain: true }), observedAt);
      }).then(report => { cached = report; return report; }).finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
