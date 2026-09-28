/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { registerHooks } from 'node:module';

// --import runs before the entrypoint graph loads. Direct entrypoint execution
// also imports this guard first, and must fail before database code can execute.
if (!process.execArgv.includes(import.meta.url) || !process.send || process.env.NODE_ENV !== 'test' ||
    !/^classifarr_suite_[a-f0-9]{12}$/.test(process.env.POSTGRES_DB ?? '') ||
    process.env.POSTGRES_USER !== 'test' ||
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.FIXTURE_JELLYFIN_ORIGIN ?? '')) {
  throw new Error('isolated_ingestion_fixture_required');
}
const envUrl = new URL('../../../config/env.mjs', import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    return url === envUrl ? { format: 'module', source: 'export {};', shortCircuit: true } : nextLoad(url, context);
  },
});
