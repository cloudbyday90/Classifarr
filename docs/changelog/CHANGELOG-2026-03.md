# Changelog Archive — March 2026

> Versions [0.44.0-beta] through [0.45.1-beta]

---

## [0.44.0-beta] — 2026-03-13

### Security

- **`flatted` < 3.4.0 — high severity DoS** ([GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f)) — unbounded recursion in `flatted.parse()` could be triggered by a crafted circular-reference payload, causing a stack overflow. Transitive dependency via `eslint → file-entry-cache → flat-cache`. Updated `flat-cache` which pulled `flatted` from 3.3.3 → 3.4.1. (`server/`)

### Dependencies

- **Server:** `pg` 8.19.0 → 8.20.0 (+ `pg-pool`, `pg-protocol`, `pg-connection-string` sub-packages); `express-rate-limit` 8.2.1 → 8.3.1; `axios` 1.13.5 → 1.13.6; `eslint` 10.0.2 → 10.0.3; `jest` 30.2.0 → 30.3.0. All patch/minor — zero test regressions (3 476/3 476 passing).
- **Client:** `vue` 3.5.29 → 3.5.30; `axios` 1.13.5 → 1.13.6; `postcss` 8.5.6 → 8.5.8; `@vitejs/plugin-vue` 6.0.4 → 6.0.5; `vitest` + `@vitest/coverage-v8` 4.0.18 → 4.1.0. All patch/minor — zero test regressions (1 257/1 257 passing). `vite` 7.3.1 → 8.0.0 (major — Rolldown bundler replaces esbuild + Rollup; zero config-breaking changes for this project; `build.target` pinned to `baseline-widely-available`; vendor chunk splitting via `build.rolldownOptions.output.manualChunks` function — Vue ecosystem separated into cacheable `vue-vendor` chunk).

### Fixed

- **Genre learning from policy clarifications was non-functional** — `checkLearnedPatterns()` silently ignored its `metadata` argument (parameter was named `_metadata`, the leading `_` caused it to never be used), so every genre check returned `null` regardless of learned data. Renamed to `metadata` and added proper SQL filtering by `metadata.genres` (using PostgreSQL `ANY($1::text[])`) and `metadata.media_type`, with an early return when genres array is empty. (`services/classification.js`)

- **`resolvePolicyQuestion()` only wrote item-level `exact_match` patterns, never genre-level ones** — After a user confirms a library choice, clarification now also writes one `genre_pattern` row per genre in the item's metadata. Each insert uses `ON CONFLICT` upsert (increments `usage_count`, caps `confidence` at 95) so repeated confirmations reinforce the pattern rather than duplicating rows. (`services/clarificationService.js`)

### Tests

- **`checkLearnedPatterns`** — Added 5 unit tests: returns `null` when metadata has no genres; returns `null` when genres array is empty (no DB call); returns `null` when no matching DB rows; returns library match when a `genre_pattern` row exists with `success_rate ≥ 70`; SQL params are `[genres, media_type]`. (`classification.test.js`)
- **`resolvePolicyQuestion` genre_pattern writing** — Added 3 unit tests: writes one `genre_pattern` INSERT per genre (2 genres → 2 INSERTs); stores genre in lowercase; skips genre INSERTs when `metadata.genres` is absent. (`clarification.test.js`)
- **Code health test suite** (`codeHealth.test.js`) — New static-analysis test file with 10 check categories (1 319 tests): syntax validity via `vm.Script` (catches truncated files); test file closure; stub method detection; mock chain completeness; `console.log` in service files; hardcoded credentials; `eval()`/`new Function()`; `process.exit()` in service files; string-interpolated SQL queries. Path handling normalised to forward slashes so all filters work correctly on Windows. Legitimate PostgreSQL `SET LOCAL` / DDL interpolation sites annotated with `// sql-interpolation: <reason>` suppression comments.

- **Remember Me sessions still kicked to login on access-token expiry** — The Vue Router `beforeEach` guard used a raw `fetch('/api/auth/me')` call that bypasses the Axios interceptor. When the 48-hour access token expired the guard received 401 and redirected to `/login` without ever attempting to use the valid 30-day refresh token. The guard now calls `api.getMe()` through the shared Axios client so the existing 401 interceptor silently refreshes the access token and retries — the user stays logged in for the full remember-me window. (`client/src/router/index.js`)

- **AI clarification option dropped when LLM wraps library name in quotes** — `mapOptionsToLibraries()` normalised option text by stripping list-prefix artefacts and noise words, but did not remove surrounding quote characters that LLMs sometimes produce (e.g. `"Documentaries"` instead of `Documentaries`). The quote-strip step is now applied first (before prefix stripping), and the second-pass partial match now also uses the cleaned string instead of the raw lowercased value, fixing the regression where `optLower.includes(libLower)` was tested against an unstripped, quote-wrapped value. (`aiResponseParser.js`)

- **task_queue slow INSERT on high-volume instances** — `_backgroundDrainIfBloated()` (startup drain) and `runTaskQueueCleanup()` (nightly scheduler at 3:15 AM) both now apply a count-based cap (`TASK_QUEUE_MAX_TOTAL_ROWS`, default 50 000) in addition to the existing age-based retention drain. Previously, if all completed/failed rows were within the 7-day retention window both cleanup paths exited immediately, allowing the table to accumulate 250 000+ rows and cause slow index-maintenance on INSERT (~600 ms spikes). The startup drain also consolidates its two count round-trips into one query. (`queueService.js`, `scheduler.js`)

- **task_queue INSERT-autovacuum lag** — Added `autovacuum_vacuum_insert_scale_factor = 0.02` and `autovacuum_vacuum_insert_threshold = 500` storage parameters to `task_queue`. PostgreSQL 13+ tracks INSERT activity separately and will not refresh `reltuples` (the query planner's row-count estimate) until the insert threshold fires. The default `0.20` insert scale factor allowed the planner to under-estimate table size by 50 000+ rows on a high-volume instance, causing poor index-plan selection. New threshold fires after ~5 000 inserts on a 250 K-row table instead of 50 000. (`database/migrations/20260313_120000_task_queue_insert_autovacuum.sql`)

### Tests

- **`mapOptionsToLibraries` — quote stripping** — Added 4 tests: matches library when option is wrapped in double quotes; single quotes; prefix + quotes combined; drops quoted option when stripped name still has no match. (`aiResponseParser.test.js`)
- **`_backgroundDrainIfBloated`** — Added 5 unit tests covering: early-return when neither threshold is exceeded; age-based delete + VACUUM; count-based trim of oldest rows; combined age+count trigger label; non-fatal VACUUM failure path. (`queueService.test.js`)
- **`runTaskQueueCleanup`** — Added 5 unit tests covering: no-op when both age and row-count are healthy; age-based drain with VACUUM; count-based cap trim of oldest rows with cap-exceeded warning; combined age+count path with single VACUUM; non-fatal VACUUM failure. (`scheduler.test.js`)
- **Client code health test suite** (`client/src/__tests__/codeHealth.test.js`) — New static-analysis test file with 14 check categories (850 tests): JSON validity with dynamic project-wide file discovery (catches new files automatically); `package.json` schema (required fields, valid semver version, `engines.node` specified, no wildcard `*` dep versions); `package-lock.json` lockfileVersion >= 3 (npm 7+ reproducible installs); PWA manifest W3C required fields (`name`, `short_name`, `start_url`, `display`, `icons`); monorepo version consistency (client and server `package.json` versions match); Vue SFC required blocks; no mixed Options API + `<script setup>`; no `console.log()` in production code; `v-html` XSS safety review; `v-for` `:key` enforcement; no `eval()`/`new Function()`; no hardcoded credentials; TODO stub count tracking; test file closure. Also fixed `PROJECT_ROOT` constant (was 4 `..` levels, pointing above the repo root — now corrected to 3) and re-encoded `ci-jobs.json` from UTF-16 LE to UTF-8 (file was previously unreadable by any JSON tooling).

### Schema

- **`database/schema/current.sql` regenerated** — Snapshot now includes all migrations through `20260313_120000_task_queue_insert_autovacuum.sql`: RAG graph relationship columns (`director_name`, `primary_studio_name`, `genre_names`, `cast_ids`, `cast_names`) and GIN/B-tree indexes on `classification_history`; RAG graph config columns on `ai_provider_config`; `task_queue` retention index (`idx_task_queue_cleanup`) and updated storage parameters; `remember_me` column on `refresh_tokens`; `failed_login_count` / `locked_until` columns and `idx_users_locked_until` index on `users`.

---

> [!NOTE]
> Older changelog entries have been moved to [CHANGELOG_backup.md](CHANGELOG_backup.md) to keep this file concise.
