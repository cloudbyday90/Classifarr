# Classifarr Release Notes

## v0.44.0-a.beta
**Title: Crash-free Discord, sessions that stick, and AI questions that always show up**

### 🎉 What You'll Notice
- **Discord buttons no longer leave "This interaction failed"** — slow Radarr/Sonarr responses occasionally pushed past Discord's 3-second deadline, crashing the bot process. All buttons now acknowledge instantly and complete in the background.
- **Logged-in sessions stay logged in** — expired access tokens were silently returning a hard-rejection code instead of triggering a silent refresh, so even a valid 30-day "Remember Me" session could drop unexpectedly after 15 minutes of inactivity.
- **AI clarification questions always appear** — the CLARIFY format now uses numbered options (same as all other AI response types), closing the loophole where hallucinated library names silently vanished.
- **Metadata enrichment no longer spins indefinitely** — a missing field caused every item without OMDb data to be re-queued on every cycle; fixed.

### 📊 Quick Visual
```text
v0.44.0-a.beta Patch Snapshot
Discord bot stability      [██████████] crash vectors closed
Session persistence        [██████████] 401 fix — silent refresh now triggers
AI question delivery       [██████████] numeric indices, no hallucination drops
Metadata enrichment loop   [██████████] infinite re-queue eliminated
```

### ✨ Highlights
- **Discord interaction crash fully resolved** — all five bot interaction handlers (verification, correction, clarification, library selection, question response) now defer immediately; duplicate button clicks are safely idempotent.
- **"Remember Me" sessions reliably persist** — the root issue was a wrong HTTP status code (403 instead of 401) on normal token expiry. The client's silent-refresh interceptor only acts on 401, so it was never firing. Fixed at the server — sessions now refresh transparently as they should.
- **AI CLARIFY uses numeric indices** — consistent with how CONFIDENT and CONFIRM have always worked. The LLM can no longer hallucinate library names that slip through undetected.

### 🔧 Reliability Improvements
- Bot process no longer crashes on "interaction already replied" or "unknown interaction" Discord errors from slow API calls or double-clicks.
- All bot catch blocks are now individually guarded so a failure reporting an error cannot itself cause an unhandled rejection.
- `metadata_enrichment` task now correctly stamps `source` on both `content_analysis` writes, preventing the infinite re-queue loop that could keep the worker permanently busy.
- **Security patch:** `undici` updated to 7.24.1 to resolve 6 high-severity CVEs (WebSocket overflow, HTTP smuggling, memory exhaustion, CRLF injection). Transitive dependency; no user action needed.

### 👥 Who This Helps
- **Discord users:** buttons work even when Arr routing takes more than 3 seconds; double-clicks on verification/clarification buttons no longer crash the bot.
- **All users:** no surprise logouts after short idle periods, even without "Remember Me".
- **Users with "Remember Me" / long sessions:** access-token refresh finally triggers as intended — 30-day sessions hold for 30 days.
- **High-volume instances:** `metadata_enrichment` loop fix prevents the worker from being monopolised by endlessly re-queued items.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.44.0-beta
**Title: AI learns from you — smarter clarifications, faster builds, zero security holes**

### 🎉 What You'll Notice
- **AI clarification questions actually work now** — genre learning from past decisions was silently broken; now every confirmed library choice genuinely teaches the system, so it asks fewer questions over time.
- **Classification questions no longer disappear** — AI-generated options that use quotes, numbered lists, or invented genre names are correctly mapped to your real library names instead of silently dropped.
- **Transient errors (rate limits, brief outages) are retried automatically** — AI 429s and OMDb/TMDB HTTP errors are no longer treated as permanent failures; classification just retries on its own.
- **Large libraries stay fast** — uncapped task queues could let the `task_queue` table balloon to 250 000+ rows, causing slow classification on high-volume instances. A row-count cap is now enforced nightly and on startup.
- **Security hardened** — a dependency-level DoS vulnerability patched; `test-output.txt` debug artifact removed from the repository.

### 📊 Quick Visual
```text
v0.44.0-beta Snapshot
AI Clarification Reliability  [██████████] fixed (was silently broken)
Transient Error Retry         [██████████] HTTP 429/5xx now retried
Genre Learning                [██████████] fixed (metadata param bug)
Task Queue Growth (large lib) [████████░░] capped at 50 000 rows
Build Speed (Vite 8 Rolldown) [█████████░] ~909ms production build
```

### ✨ Highlights
- **Genre learning fixed** — the AI now genuinely gets smarter after each clarification you answer; the bug causing it to always return `null` regardless of your past decisions is resolved.
- **AI clarification pipeline overhauled** — options with list prefixes, surrounding quotes, duplicate entries, and invented genre names are all handled correctly; `verify` mode no longer silently drops clarification prompts.
- **Vite 8 (Rolldown)** — the front-end build now uses Rust-based Rolldown instead of esbuild + Rollup, with a cacheable vendor chunk split for faster repeat page loads after deploys.
- **DoS patch** — `flatted` CVE (high severity) resolved via transitive dependency update.

### 🔧 Reliability Improvements
- AI and OMDb/TMDB transient HTTP errors (429, 500, 502, 503, 504) are now retried instead of failing permanently.
- `task_queue` row-count cap prevents slow INSERT performance on high-volume instances (was unbounded; now capped at 50 000 rows with nightly and startup cleanup).
- PostgreSQL autovacuum tuning for `task_queue` ensures the query planner keeps accurate row estimates on heavily-written tables.
- Integration tests now double-check the complete `npm test` run by default — no need to separately invoke `npm run test:integration`.

### 👥 Who This Helps
- **All users:** AI classification is more reliable and gets smarter faster; fewer manual re-classifications needed.
- **Users with "Remember Me":** sessions now survive properly — no unexpected logouts mid-session.
- **High-volume instances (1 000+ items/day):** task queue size is now bounded, preventing INSERT slowdowns at scale.
- **Operators/admins:** security patch applied; debug artifact removed from git history going forward.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details including migration notes, test matrices, and service-level changes.

---

## v0.43.9-beta
**Title: Remember Me fixed for real — plus AI classification resilience & clean logs**

### 🎉 What You'll Notice
- **Remember Me actually sticks now** — two independent bugs were causing authenticated sessions to silently expire; both are fully resolved.
- **AI classification questions are more reliable** — clarification prompts no longer silently disappear when the AI uses numbered/bulleted options, invents genre names, or disagrees in verify mode.
- **Fewer classification failures from transient AI/OMDb errors** — rate limits and temporary HTTP errors are now correctly retried instead of treated as permanent failures.
- Error and application logs are automatically cleared on first startup after upgrading — fresh log baseline, no manual cleanup needed.

### 📊 Quick Visual
```text
Reliability Improvements
  Remember Me across restarts   [████████████] No longer wiped on container update
  Full 30-day session window    [████████████] Was cut short at ~7 days (now fixed)
  AI clarification delivery     [████████████] Questions no longer silently dropped
  Rate-limit retry (AI + OMDb)  [████████████] Transient errors queued for retry
  Log fresh start on upgrade    [████████████] Auto-cleared — clean slate every release
```

### ✨ Highlights
- **Remember Me across restarts** — upgrading or restarting your container no longer silently signs out users who checked "Remember Me". Regular (non-remember-me) sessions are still cleared on restart as before.
- **Full 30-day session window** — sessions were expiring after ~7 days despite "Remember Me" being checked. A mismatch between the CSRF cookie lifetime (7 days) and the refresh token lifetime (30 days) caused silent authentication failures. Both are now aligned.
- **AI classification questions are more reliable** — clarification prompts no longer silently disappear when the AI returns numbered/bulleted option lists, uses variant names for the same library, or disagrees in verify mode. Questions now always reach you so you can confirm the right library.
- **AI is instructed to use exact library names** — the prompt now explicitly forbids the AI from inventing genre labels ("Documentary", "Biography") as options; it must use names copied from your actual library list.

### 🔧 Reliability Improvements
- Error and application logs are automatically wiped on the first boot after this upgrade, giving a clean starting point for monitoring.
- The CSRF token refresh path (`/auth/refresh`) is now correctly exempted from CSRF checks — the underlying httpOnly cookie already prevents cross-site abuse on that endpoint.
- AI provider rate-limit errors (HTTP 429) are now correctly detected as temporary and queued for retry, rather than treated as permanent classification failures.
- OMDb / enrichment lookups now correctly retry on HTTP 429, 408, 502–504, and Cloudflare edge errors (52x/530) regardless of how the HTTP client surfaces the error.
- Queue worker stalls under database lock contention produce diagnostic log entries every 30 seconds, making slow-DB scenarios visible without requiring a restart.

### 👥 Who This Helps
- **End users:** "Remember Me" works as expected; fewer items get stuck unclassified due to AI rate limits or network blips; classification questions reliably appear when the AI is uncertain.
- **Operators/admins:** Clean log state after upgrade; structured log output from Discord, health checks, and API key routes makes filtering easier.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.43.8-beta
**Title: Security hardening — account protection & session integrity**

### 🎉 What You'll Notice
- Your account is now protected against brute-force login attacks — too many wrong passwords temporarily locks it for 15 minutes, with a clear countdown message.
- If someone steals and replays an old session token, Classifarr detects it and immediately signs out **all** active sessions for your account to limit damage.
- Changing your password now signs out every other browser or device automatically — your current session stays active.
- Login response times are consistent regardless of whether your username exists, making it harder for attackers to probe for valid accounts.

### 📊 Quick Visual
```text
Auth Security Improvements
  Brute-force protection   [████████████] Account lockout after 10 attempts
  Replay attack defence    [████████████] Stolen token → all sessions wiped
  Password change hygiene  [████████████] Other sessions revoked instantly
  Timing attack mitigation [████████████] Constant-time response always
```

### ✨ Highlights
- **Account lockout** — 10 failed login attempts triggers a 15-minute temporary lock. Self-expiring, no admin action required.
- **Token replay detection** — reusing a consumed refresh token is treated as a compromise signal: all sessions for the account are immediately invalidated.
- **Sliding Remember Me expiry** — active "Remember Me" sessions now extend their 30-day window each time you use the app, so you're not logged out mid-project.
- **Password change signs out other devices** — your current session is preserved; all others are revoked.

### 🔧 Reliability Improvements
- Login response time is now constant whether or not the username exists, removing a subtle information leak.
- A new database migration adds the lockout tracking columns automatically on upgrade — no manual steps required.
- **Clear & Resync All is now safer under load** — the operation now waits for any in-progress classification tasks to finish before clearing the database, eliminating a race condition that could produce harmless but confusing warning log entries when tasks were active at the moment the button was pressed.

### 👥 Who This Helps
- **End users:** Clearer, actionable error messages when locked out; seamless Remember Me sessions that don't expire during active use.
- **Operators/admins:** Automated account protection with no configuration required; lockouts self-expire so no admin intervention is needed.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details including migration names, test counts, and implementation specifics.

---

## v0.43.7a-beta
**Title: Patch — automatic relationship backfill & Clear-All-Resync fix**

> [!NOTE]
> **Upgrading from v0.43.7-beta?** The manual backfill step is no longer needed.
> Classifarr now runs it automatically on startup.

### 🎉 What You'll Notice
- **Clear & Resync All works again** — the button was broken with a database error since v0.43.7-beta; now fixed.
- **No manual backfill step required** — after upgrading, graph relationship data fills in automatically in the background while you use the app normally.
- The Graph tab UI now accurately reflects that backfill is automatic.

### 📊 Quick Visual
```text
Startup Backfill (new in v0.43.7a)
  Pass 1 — cast/studio/genre   ████████████ fast, no API calls
  Pass 2 — director (TMDB)     ████████░░░░ rate-limited, runs if TMDB key set
  Already up to date?          ░░░░░░░░░░░░ exits instantly, no work done
```

### ✨ Highlights
- Relationship columns for existing history rows now populate automatically on first boot after upgrade — no docker exec command needed.
- Clear & Resync All button fully operational again.

### 🔧 Reliability Improvements
- Fixed: `LOCK TABLE can only be used in transaction blocks` error during Clear & Resync, caused by the cleanup routine not opening a proper database transaction in production.
- Startup backfill is idempotent — restarting mid-run or running again is safe.

### 👥 Who This Helps
- **All users:** Clear & Resync All works correctly again.
- **New installs on v0.43.7-beta:** No action needed — graph signals will populate automatically.
- **Existing installs skipping v0.43.7-beta:** Upgrade directly; backfill happens on boot.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.43.7-beta
**Title: Graph Retrieval — smarter library matching for sequels, spin-offs, and franchises**

> [!IMPORTANT]
> **Existing installs:** After upgrading, run the backfill script once to populate relationship data for past classifications:
> ```
> docker exec classifarr node server/src/scripts/backfillGraphRelationships.js
> ```
> Graph retrieval is **off by default** — you must enable it in Settings → RAG & Embeddings → Graph 🕸️. The backfill is optional but recommended before enabling.

### 🎉 What You'll Notice
- A new **Graph** tab in RAG & Embeddings settings lets you enable structured relationship matching alongside the existing AI search.
- Sequels, franchise films, and spin-offs are now more reliably matched to earlier entries in your library — even when they look (or are described) very differently.
- The match explanation now shows which signals contributed — semantic similarity, text search, and/or structural relationships.

### 📊 Quick Visual
```text
v0.43.7-beta — Graph Retrieval
────────────────────────────────────────────────
Retrieval signals  Before   Now
──────────────────────────────
Vector (semantic)    ✓       ✓
Full-text            ✓       ✓
Graph (relational)   —       ✓  (opt-in)
────────────────────────────────────────────────
Franchise recall improvement (new film in    
established series)       Low → High
────────────────────────────────────────────────
```

### ✨ Highlights
- **Graph retrieval is a third match path** — beyond semantic embeddings and keyword search, Classifarr can now find past classifications that share a franchise/collection, director, studio, cast overlap, or genre with the item being processed.
- **Postgres-native — no new services** — No external graph database is required. The relationship data already existed in your classification history; it's just now indexed for fast relational lookups.
- **Conservative defaults** — Graph weight is 0.20 (out of a total fusion budget of ~2.2), meaning it nudges rankings without overriding strong semantic matches. Collection and director are on by default; studio, cast, and genre are opt-in.
- **Fill-rate panel** — The Graph settings tab shows what percentage of your past classifications already have relationship data populated, so you know whether to run the backfill.

### 🔧 Reliability Improvements
- Fixed a rare "timeout exceeded when trying to connect" error that could occur under heavy classification load — the database connection pool default was raised from 10 to 15 to give headroom for the additional graph query per task.

### 👥 Who This Helps
- **Users classifying franchise media** (MCU, Star Wars, long-running TV series, documentary series) — items that share a director or collection but embed differently from their predecessors now have a structural signal path.
- **Operators/admins:** All graph settings are managed in the UI; no config files required. Pool size is tunable via `POSTGRES_POOL_MAX` if you run a high-concurrency setup.

### 📚 Want Technical Details?
See `CHANGELOG.md` for the full technical breakdown: migration details, API endpoints, test matrix, and formula derivations.

---

## v0.43.6a-beta
**Title: Query planner fix — automatic VACUUM ANALYZE after queue cleanup**

### 🎉 What You'll Notice
- Classifarr now automatically runs a database statistics refresh after purging old queue records — meaning queries stay fast right after upgrade, not just after the next scheduled maintenance window.
- No action required. This is a silent reliability fix that applies to all upgrade paths.

### 📊 Quick Visual
```text
v0.43.6a-beta Post-Cleanup Health
─────────────────────────────────────────
Query planner stats   [██████████] Refreshed immediately after purge
Disk space reuse      [██████████] Dead pages marked reusable
Upgrade experience    [██████████] Fast from first restart
─────────────────────────────────────────
```

### ✨ Highlights
- **Query planner statistics refreshed automatically** — After v0.43.6-beta purges the stale queue backlog, PostgreSQL's query planner still "remembers" the old large table size until a background maintenance pass runs. This patch adds `VACUUM ANALYZE` immediately after both the startup drain and the daily cleanup — so the planner uses accurate statistics from the moment the rows are gone.

### 🔧 Reliability Improvements
- `VACUUM ANALYZE task_queue` now runs automatically after the startup background drain (for upgrading users with existing backlogs).
- `VACUUM ANALYZE task_queue` now runs after every daily scheduled cleanup when rows were deleted — keeping planner stats current long-term.
- Both calls are wrapped in error handling — a VACUUM failure is logged as a warning and never causes a crash or restart.

### 👥 Who This Helps
- **All users upgrading from any version with a bloated `task_queue`** — The v0.43.6-beta migration deleted the rows but left the query planner with stale statistics. This patch closes that gap for every upgrading install, not just the instance where it was first diagnosed.
- **Operators/admins:** No manual `VACUUM` commands needed after upgrade.

### 📚 Want Technical Details?
See `CHANGELOG.md` for the specific methods changed and the PostgreSQL documentation reference.

---

## v0.43.6-beta
**Title: No more silent crashes — memory management, self-healing queues, and health visibility**

> [!IMPORTANT]
> **Existing installs:** This release includes a database migration that purges accumulated stale queue rows on first boot (in batches — safe for large installs). No manual action is required. Container restart is all that's needed.

### 🎉 What You'll Notice
- Classifarr no longer crashes silently under sustained load — the root cause of OOM kills has been fixed at every layer.
- Old completed queue tasks are now automatically cleaned up daily, keeping the database small and queries fast.
- A new memory health endpoint lets external monitoring tools (Uptime Kuma, Grafana, etc.) track memory pressure in real time.
- If the container is running without a memory limit, Classifarr now warns you at startup — in plain language — and explains how to fix it.

### 📊 Quick Visual
```text
v0.43.6-beta Memory & Reliability Summary
─────────────────────────────────────────────────
OOM crash risk      [██████████] Eliminated at 4 layers
Queue bloat         [██████████] Auto-purged on deploy + daily
Heap auto-config    [██████████] Derived from container limits
Memory visibility   [██████████] Real-time /health/memory probe
Operator alerting   [██████████] Startup WARN if no cap set
─────────────────────────────────────────────────
```

### ✨ Highlights
- **Silent OOM crash eliminated** — Classifarr was accumulating hundreds of thousands of completed queue records with no cleanup policy. On long-running instances this bloated the database to 400 MB+, slowed every 5-minute background scan, and eventually pushed the Node.js process past its memory limit — killing it with no error log. The fix runs at the database, queue worker, scheduler, and container configuration levels so the problem cannot recur.
- **Automatic queue cleanup** — Completed, failed, and cancelled queue tasks are now purged daily (kept for 7 days by default, configurable via `TASK_QUEUE_RETENTION_DAYS`). On first boot after upgrade, a one-time migration clears any existing backlog.
- **Container-aware heap cap** — The container entrypoint now reads the Docker/Kubernetes memory limit and automatically sets the Node.js heap cap to 75% of it. No manual configuration needed — works for Unraid templates, bare `docker run`, and Kubernetes alike.

### 🔧 Reliability Improvements
- **Database migration** cleanly purges stale queue rows in safe batches and adds an efficient index so future cleanups run in milliseconds instead of seconds.
- **Startup drain** — if a large backlog is detected on boot, it is drained in the background while the server starts normally (no delay to users).
- **Startup memory warning** — if no heap cap is configured, a `[WARN]` is logged immediately at startup with the current heap limit, free RAM, and remediation steps.
- **`GET /api/system/health/memory`** — new no-authentication probe endpoint returns Node.js heap usage %, OS RAM %, and a `ok / warning / critical` status. Returns HTTP 503 when critical so monitoring tools can alert automatically.
- The existing health services response now also includes live memory stats under the `memory` field.

### 👥 Who This Helps
- **Self-hosters on Unraid / low-RAM hardware:** This release directly targets the silent OOM crash that affected long-running instances. No more unexpected container restarts.
- **Operators/admins:** Memory pressure is now visible via API and external monitoring tools can be pointed at `/api/system/health/memory` for proactive alerting before a crash occurs.
- **New installs:** The fix is baked in from day one — no configuration changes needed.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details including migration SQL, scheduler internals, and cgroup detection logic.

---

## v0.43.5a-beta
**Title: Keeping the foundation secure — dependency hardening patch**

### 🎉 What You'll Notice
- Rate limiting now correctly handles IPv4 addresses mapped to IPv6 — a security corner case that could have allowed limit bypasses on some network setups.
- All core dependencies are up to date with the latest bug fixes and compatibility improvements.

### 📊 Quick Visual
```text
v0.43.5a-beta Security Patch
─────────────────────────────────────────────────
Security fixes   [██████████] 2 vulnerabilities resolved
Dep freshness    [██████████] All major deps up to date
Build pipeline   [██████████] CI actions on Node 24 runtime
─────────────────────────────────────────────────
```

### ✨ Highlights
- **Rate limit bypass patched** — `express-rate-limit` was updated to fix a security issue (GHSA-46wh-pxpv-q5gq) where IPv4 addresses expressed in IPv6 notation could bypass configured rate limits. Upgraded to 8.3.0 which resolves this.
- **Dev dependency vulnerability resolved** — A transitive test-only dependency (`immutable`) was pinned to eliminate a high-severity advisory (GHSA-wf6x-7x77-mvgw). No production code is affected.

### 🔧 Reliability Improvements
- `axios` updated to 1.13.6 across all packages — improves error propagation and React Native / Browserify compatibility (no user-visible impact for server deployments).
- `pg` updated to 8.20.0 — adds `onConnect` callback support for pool initialization; existing connection behaviour is unchanged.
- CI build pipeline updated to use Node 24 runtime for all Docker GitHub Actions.

### 👥 Who This Helps
- **Operators/admins:** Rate limiting now works correctly for all clients regardless of IPv4/IPv6 address representation — no configuration change needed.
- **Self-hosters:** No action required; the fix applies automatically on container restart.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.43.5-beta
**Title: First beta — a complete, hardened foundation months in the making**

> [!IMPORTANT]
> **Existing installs:** This release runs database migrations that widen several columns from INTEGER to BIGINT and recreates foreign keys. On large installations the migration may take a few seconds per table. A container restart after the first upgrade is recommended to activate `pg_stat_statements` query profiling (the extension is pre-loaded on new installs automatically).

### 🎉 What You'll Notice
- Classifarr graduates from alpha to **beta** — every originally-planned core feature is in place and working.
- The system handles high-volume queues more reliably: in-flight tasks survive crashes and rolling restarts faster than before, duplicate tasks are automatically prevented, and advisory locks prevent split-brain races between processes.
- Scheduled maintenance now runs in the background: old logs, expired tokens, and audit records are cleaned up automatically — no operator action needed.
- AI-powered semantic search returns more relevant results with less latency thanks to HNSW index warm-up on startup and tuned search parameters.
- The database is built to scale: primary keys, IDs, and counters have been upgraded to 64-bit (BIGINT) across all tables — overflow is no longer a theoretical concern for long-running instances.

### 📊 Quick Visual
```text
v0.43.5-beta Foundation Summary
─────────────────────────────────────────────────
Database foundation  [██████████] Production-ready
Queue reliability    [██████████] Crash/restart safe
Auto-maintenance     [██████████] Fully automated
RAG/AI search        [█████████░] Tuned + warmed
Test coverage        [████████░░] 1903 unit / 574 integration
─────────────────────────────────────────────────
Months of iteration → First Beta
```

### ✨ Highlights
- **64-bit upgrade complete** — All ID columns across every table are now BIGINT. High-volume instances will never hit an integer overflow, even after years of continuous operation.
- **Queue visibility timeouts** — Inspired by Amazon SQS: when a worker claims a task it sets a lease timer. If the worker crashes before finishing, the task becomes visible again automatically — no restart required to recover stuck items.
- **Task deduplication** — A partial unique index prevents the same deferred job (e.g. rating normalization) from being queued twice when the scheduler fires while a previous run is still in progress.
- **Advisory locks for all backfill and scheduler jobs** — On multi-replica or rolling-restart deployments, concurrent processes now coordinate so no two workers process the same job simultaneously.
- **Automatic log and token housekeeping** — Three new nightly jobs keep the database lean: log retention (configurable window), expired auth token pruning, and API key audit log rotation. All run without any operator input.
- **Database query profiling built in** — `pg_stat_statements` is now enabled by default, giving you a live view of slow queries in any PostgreSQL monitoring tool.
- **HNSW index pre-warming** — On each container start, both vector search indexes are loaded into shared memory before the first request arrives, eliminating cold-start latency on the first AI/RAG classification.

### 🔧 Reliability Improvements
- Pool connections now have explicit timeouts (connection, idle, statement) — runaway queries no longer tie up pool slots indefinitely.
- All transaction management across the codebase has been unified into `withTransaction()` — no more raw `BEGIN`/`ROLLBACK` calls that could silently leave pool connections in a dirty state.
- Graceful shutdown correctly resets in-flight tasks and closes the HTTP server before exit — rolling updates produce no stale `processing` rows and no startup noise.
- Slow queries are logged automatically at the `WARN` level with elapsed time — you get visibility into database performance without needing an external monitoring stack.
- Check constraints on `classification_history` (confidence range, completed rows must have a library) are now validated at the database level, not just application level.

### 👥 Who This Helps
- **End users:** Faster AI search responses, no more duplicate classification tasks, and more accurate auto-routing for ambiguous media.
- **Operators/admins:** The database stays lean with zero manual maintenance. Query profiling and slow-query logging make performance issues immediately visible. Existing installs upgrade automatically with safe, low-lock migrations.
- **Self-hosters running Unraid/Synology/homelab:** Visibility-timeout crash recovery means your queue recovers on its own after a power cycle or host restart — you don't need to babysit it.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details including every migration, index change, test addition, and service-level fix.

---

## v0.43.3a-alpha
**Title: Cleaner restarts — no more stale queue task warnings**

### 🎉 What You'll Notice
- When Classifarr restarts (update, `docker stop`, or Unraid/Synology container restart), you will no longer see a `WARN Reset stale processing tasks on startup` log message listing task IDs. Queue tasks that were running at shutdown are now cleanly reset before the process exits.

### ✨ Highlights
- Added graceful SIGTERM/SIGINT shutdown handling. On a clean stop, the server now: stops the queue worker, resets any in-flight tasks back to `pending`, closes the HTTP listener, then exits. Tasks resume normally on next startup without any startup noise.
- Crash/OOM kills are unaffected — the existing startup reset still catches those. This fix only eliminates the warning on intentional restarts.

### 🔧 Technical Details
- `QueueService.gracefulShutdown()` — stops worker loop and flushes `status = 'processing'` → `pending` in one DB UPDATE before exit.
- `server/src/index.js` — `process.on('SIGTERM'/'SIGINT')` handlers added; HTTP server closed gracefully; 10-second force-exit watchdog prevents a hung shutdown from blocking container stop.

---

## v0.43.3-alpha
**Title: Fresh installs are faster and cleaner — no more startup noise**

### 🎉 What You'll Notice
- A brand-new Classifarr instance starts up faster: the database is initialized from a single snapshot instead of replaying 107 migrations one by one.
- The setup account page no longer shows a "CSRF validation failed" error when your browser still has a cookie from a previous installation.
- No more unexpected log cleanup messages or error-level warnings on first boot — the system now correctly identifies a fresh install and skips upgrade-only housekeeping.
- Hard-to-find titles — especially those with aliases, alternate names, or non-English originals — are now matched more accurately in second-pass retrieval.

### 📊 Quick Visual
```text
Fresh Install Health (before → after)
CSRF error on setup page       [✗] → [✓] Fixed
PostUpgrade tasks firing (×5)  [✗] → [✓] Skipped (fresh install)
IdleBackfill ERROR on boot     [✗] → [✓] INFO (RAG not yet configured)
Startup time (107 migrations)  [✗] → [✓] Snapshot fast-path
Test suite flaky failures       [✗] → [✓] Deterministic (1803/1803)
```

### ✨ Highlights
- Fresh installs now load from a pre-built database snapshot — all tables, seed data, and migration history in one file. The sequential 107-migration path is preserved as a fallback.
- Three startup errors that only occurred on new instances have been eliminated: the CSRF setup blocker, repeated log-clear warnings, and an idle backfill error logged before any AI provider is configured.
- Second-pass title search now incorporates alias names, genres, plot keywords, and cast — so items with non-English originals or franchise subtitles are far more likely to match on the first try.

### 🔧 Reliability Improvements
- Fixed a long-standing intermittent test failure in the queue service caused by shared mock state bleeding between test files. The full test suite now passes deterministically across repeated runs.
- Post-upgrade tasks (like log cleanup) now correctly recognize a fresh install and mark themselves complete without running — they exist to migrate data from older versions, not to act on empty databases.
- The idle backfill service no longer logs an ERROR when no AI provider has been configured yet. It now exits quietly with an INFO message until you've set one up.

### 👥 Who This Helps
- **New users / operators**: The setup experience is now smooth out of the box — no CSRF error, no confusing log-clear warnings, no spurious ERROR logs before configuration.
- **Everyone**: Hard-to-find titles with aliases or non-English names have improved retrieval in the second-pass similarity search.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.43.2a-alpha
**Title: Movies and shows already in your library no longer surface as errors**

### 🎉 What You'll Notice
- Requesting a movie or show you already have in Radarr or Sonarr no longer produces an error in routing.
- Duplicate requests are quietly resolved as "already in library" — no noise in Error Logs or Needs Attention.
- Both Radarr and Sonarr now handle this gracefully with the same two-layer defense.

### 📊 Quick Visual
```text
Routing Reliability
Radarr already-exists handled  [██████████] Clean
Sonarr already-exists handled  [██████████] Clean
Duplicate request noise         [██████████] Eliminated
```

### 🔧 Reliability Improvements
- Radarr no longer throws a 400 error when requesting a movie that already exists in your library — it detects the duplicate and marks routing as successful.
- Sonarr receives the same fix — series that are already tracked no longer generate spurious routing errors.
- Routing now pre-checks if the item is already present before attempting to add it, with a secondary 400-response catch as a race-condition safety net.

### 👥 Who This Helps
- **End users**: Re-requesting a title that's already in your library resolves silently instead of producing an error.
- **Operators/admins**: Fewer false-positive errors in Command Center and Error Logs for items already present in Radarr or Sonarr.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.43.2-alpha
**Title: Foreign-language films route smarter, fewer items stuck in review**

### 🎉 What You'll Notice
- Foreign-language films (Chinese, Korean, French, etc.) are far less likely to get stuck in "Needs Attention" or route to the wrong library.
- Items waiting for policy confirmation now benefit from a full intelligence pass before asking you anything, so many resolve automatically.
- When you do get a clarification question, it now lists all conflicting libraries — not just the first one.
- Language names in clarification questions are now correctly labeled for 47 languages (up from 13).

### 📊 Quick Visual
```text
Foreign-Language Routing Improvements
Language signal in RAG queries  [██████████] Complete
Conflict question completeness  [██████████] All conflicts shown
Language label coverage         [█████████░] 47 languages (was 13)
prompt_confirm → RAG loop       [██████████] Now active
Silent wrong-library guard      [██████████] Blocked at gate
```

### ✨ Highlights
- Chinese, Korean, French, and 41 other non-English languages now inject a language keyword into RAG retrieval queries so the similarity search actually knows what language it's looking for.
- Items sitting at "needs confirmation" now run a second-pass retrieval and scoring pass before surfacing to you, matching the same treatment that "needs selection" items already received.
- A new safety guard prevents a high-confidence second pass from silently auto-routing an item that still has a language policy conflict — it surfaces as a question instead.

### 🔧 Reliability Improvements
- Fixed a bug where a language policy conflict could bleed through and assign a 0-score library entry instead of hard-blocking it.
- Fixed studio scoring returning a misleading "50% neutral" when no studio data was available and a `require_any` rule was configured — now correctly returns 0.
- Fixed clarification questions only naming the first conflicting library when multiple policies conflicted.
- New operator-tunable config (`policy_recheck_confidence_gain_multiplier`, default: 2×) controls how large a confidence jump is needed for a second-pass to auto-adopt without an action upgrade.

### 👥 Who This Helps
- **End users**: Foreign-language movie/show requests are more likely to route automatically or present a clear, accurate clarification question.
- **Operators/admins**: Fewer "stuck" items in Needs Attention for non-English content. New tuning knob for fine-grained second-pass adoption control.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## [v0.43.1b-alpha] - 2026-02-26

**Title: Cleaner notifications and quieter logs for daily operations**

> [!IMPORTANT]
> This release runs a one-time post-upgrade log cleanup for `v0.43.1b-alpha` (existing app/error logs are cleared once after upgrade).

### 🎉 What You'll Notice

- You can now fully delete notification items, including stale "needs attention" entries.
- You can clear all notifications in one click from both the notifications page and header panel.
- Non-error RAG second-pass stage signals no longer clutter the Error Logs page.

### 📊 Quick Visual

```text
Operations Snapshot
Notification Cleanup  [██████████] 100%
Error Log Signal      [█████████░] 90%
Admin Control         [██████████] 100%
```

### ✨ Highlights

- Added per-notification delete and bulk `Clear All` notification actions.
- Added backend routes for delete-by-id and clear-all notification operations.
- Kept existing dismiss/read workflows intact for compatibility.

### 🔧 Reliability Improvements

- RAG informational stage events (like strategy-selected gate decisions) now stay console-visible without persisting as Error Log rows.
- Added release-targeted post-upgrade task for `v0.43.1b-alpha` to clear historical log tables/files once.

### 👥 Who This Helps

- **End users:** Easier cleanup of old notification cards and stuck attention prompts.
- **Operators/admins:** Cleaner Error Logs signal and fewer non-actionable entries during troubleshooting.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.43.1a-alpha] - 2026-02-26

**Title: Restored Error Logs loading on upgraded installs**

### 🎉 What You'll Notice

- The Error Logs page loads normally again instead of showing `Internal Server Error`.
- Retry Audit Trail filtering works on both newer and older upgraded databases.
- Exporting filtered logs from Settings works again in affected environments.

### 📊 Quick Visual

```text
Hotfix Snapshot
Logs Page Availability   [██████████] 100%
Retry Audit Filtering    [██████████] 100%
Upgrade Compatibility    [██████████] 100%
```

### ✨ Highlights

- Fixed a release regression where log queries expected newer `error_log` columns not guaranteed on all upgrade paths.
- Added backward-compatible query handling so logs features work even when those columns are absent.

### 🔧 Reliability Improvements

- Prevents log-page hard failures caused by schema drift between historical installs and current code.
- Preserves retry-audit visibility without requiring manual SQL intervention.

### 👥 Who This Helps

- **End users:** Restores normal Settings → Error Logs behavior.
- **Operators/admins:** No emergency database patching needed to view or export logs.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.43.1-alpha] - 2026-02-26

**Title: Faster recovery for “Needs Attention” items with safer retry handling**

### 🎉 What You'll Notice

- You can now retry stuck or low-confidence items directly from Command Center without manual database cleanup.
- Needs Attention now supports both single-item retry and one-click `Retry Classification All`.
- Retry runs are safer and easier to trace, with better diagnostics in Logs.

### 📊 Quick Visual

```text
Operations Snapshot
Retry Control          [██████████] 100%
Queue Safety           [█████████░] 90%
Troubleshooting Clarity[█████████░] 90%
```

### ✨ Highlights

- Added a full retry flow that clears stale classification/enrichment state and re-runs items as fresh classifications.
- Added follow-up metadata enrichment queueing after retry for linked media items.
- Added retry-focused log filtering so admins can quickly inspect retry outcomes and reason codes.

### 🔧 Reliability Improvements

- Fixed incomplete AI stream parsing edge cases that could trigger false transient retries.
- Improved timeout attribution so operation timeout logs now identify the correct stage.
- Improved AI-response parser recovery when models return narrative text instead of strict JSON.

### 👥 Who This Helps

- **End users:** Faster recovery from “Needs Attention” without waiting for manual intervention.
- **Operators/admins:** Better control, safer queue behavior, and clearer retry diagnostics.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.43.0b-alpha] - 2026-02-26

**Title: Local HTTP access is stable again after upgrades**

### 🎉 What You'll Notice

- Classifarr loads normally over local `http://` again (including common Unraid LAN setups).
- Browser asset requests are no longer auto-upgraded to `https://` unless you explicitly opt in.
- Security-header behavior is now clearer for local HTTP vs public HTTPS deployments.

### 📊 Quick Visual

```text
Access Reliability Snapshot
Local HTTP Loading       [██████████] 100%
HTTPS Opt-in Controls    [██████████] 100%
Upgrade Friction         [██░░░░░░░░] 20%
```

### ✨ Highlights

- Disabled CSP `upgrade-insecure-requests` by default to prevent forced HTTPS rewrites on local HTTP installs.
- Disabled app-level HSTS by default for local compatibility.
- Added `ENFORCE_HTTPS_HEADERS` so operators can opt in to strict HTTPS headers when running behind HTTPS.

### 🔧 Reliability Improvements

- Prevents blank-page failures caused by mixed HTTP access with forced HTTPS browser policy headers.
- Keeps secure defaults available for HTTPS deployments through a single explicit toggle.

### 👥 Who This Helps

- **End users:** Local access keeps working after upgrades without emergency compose edits.
- **Operators/admins:** HTTPS hardening remains available when intentionally enabled.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.43.0a-alpha] - 2026-02-26

**Title: Easier local upgrades with safer cookie compatibility**

### 🎉 What You'll Notice

- Local HTTP deployments (including typical Unraid LAN setups) no longer get locked out when secure-cookie mode was previously enabled.
- `FORCE_SECURE_COOKIES` remains available for HTTPS deployments, but is now safer for mixed upgrade scenarios.
- Runtime security defaults are automatically seeded for upgraded installs.

### 📊 Quick Visual

```text
Upgrade Safety Snapshot
Local HTTP Access    [██████████] 100%
HTTPS Enforcement    [██████████] 100%
Manual Recovery Need [██░░░░░░░░] 20%
```

### ✨ Highlights

- Added request-aware cookie handling that only enforces secure cookies when the request is HTTPS.
- Added a migration to seed missing runtime security settings without overriding existing user values.

### 🔧 Reliability Improvements

- Prevents login/session lockouts on local HTTP when stale secure-cookie settings exist from previous versions.
- Keeps CSRF behavior intact while aligning cookie security with the actual request protocol.

### 👥 Who This Helps

- **End users:** Upgrades are less likely to break access on local/LAN deployments.
- **Operators/admins:** No emergency DB shell fixes required for common secure-cookie misconfiguration cases.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.43.0-alpha] - 2026-02-26

**Title: Safer automation with clearer day-to-day control**

> [!IMPORTANT]
> After upgrading, restart the container (`docker compose down && docker compose up -d --build`) and sign in again. If you access Classifarr from another host, set `CORS_ORIGIN` to your app URL.

### 🎉 What You'll Notice

- Webhook Authorization Header management is built directly into Webhooks settings with unmask, regenerate, copy, and auto-remask behavior.
- API/session security is stronger with cookie + CSRF protections across write actions.
- Queue and enrichment handling is more stable under OMDb timeouts and stale retry rows.

### 📊 Quick Visual

```text
Impact Snapshot
Security      [██████████] 100%
Reliability   [█████████░] 90%
Operations    [█████████░] 90%
```

### ✨ Highlights

- Policy Builder is now the active workflow and legacy Smart Rule Form paths are removed.
- Runtime settings can auto-generate in Docker at `/app/data/config/runtime.json`.
- API key and webhook secret handling now use stronger encryption and safer reveal/update behavior.

### 🔧 Reliability Improvements

- OMDb timeout/retry behavior is tunable and transient timeout noise is reduced.
- Enrichment retry processing now recovers stale rows and prevents inflated pending counts.
- Logs/settings mutating actions now consistently use authenticated CSRF-protected client calls.

### 👥 Who This Helps

- **End users:** Fewer stuck queue states and clearer webhook setup.
- **Operators/admins:** Better security defaults, cleaner logs, and better recovery behavior.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.8a-alpha] - 2026-02-23

**Title: Fixed Embedding Model Warm-up Endpoint**

### 🎉 What You'll Notice

- The "Warm Models" button now correctly warms embedding models using the proper `/api/embed` endpoint.
- Manually warming any model automatically detects if it's an embedding model and uses the correct Ollama API.

### 📊 Quick Visual

```text
Model Warm-up Compatibility
AI Models (generate)      [██████████] 100%
Embedding Models (embed)  [██████████] 100%
Auto-Detection            [██████████] 100%
```

### ✨ Highlights

- Embedding models now use `/api/embed` instead of `/api/generate`.
- Manual warm endpoint auto-detects model type and falls back appropriately.

### 🔧 Reliability Improvements

- `warmAllModels()` uses dedicated `warmEmbeddingModel()` for embedding models.
- `warmModel()` automatically falls back to `/api/embed` when model doesn't support generate.

### 👥 Who This Helps

- **End users:** One-click warm-up now works for all model types.
- **Operators/admins:** No more 400 errors when warming embedding models.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.8-alpha] - 2026-02-23

**Title: Fixed AI Model Warm-up with Unified Settings**

### 🎉 What You'll Notice

- The "Warm Models" button now correctly warms both your AI classification model and embedding model.
- Works with both the legacy Ollama config and the unified AI provider settings.

### 📊 Quick Visual

```text
Fix Coverage
AI Model Resolution    [██████████] 100%
Embedding Resolution   [██████████] 100%
Config Compatibility   [██████████] 100%
```

### ✨ Highlights

- Fixed `getConfig()` to return the model field from either config table.
- Model warm-up now correctly reads from `ai_provider_config.ollama_model`.

### 🔧 Reliability Improvements

- AI classification model is no longer skipped during warm-all operation.
- Consistent model resolution across all warm-up and preflight operations.

### 👥 Who This Helps

- **End users:** One-click warm-up now loads both models reliably.
- **Operators/admins:** No more manual model pre-loading required.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.7e-alpha] - 2026-02-23

**Title: Bug Fix for Model Warm-up and Improved Test Coverage**

### 🎉 What You'll Notice

- Model warm-up now correctly detects your configured embedding model.
- Test coverage increased to help catch regressions earlier.

### 📊 Quick Visual

```text
Quality Snapshot
Bug Fix Coverage       [██████████] 100%
Embedding Detection    [██████████] 100%
Test Coverage          [████████░░] 80%
```

### ✨ Highlights

- Fixed warm-all to check both `embedding_model` and `embedding_ollama_model` fields.
- Added comprehensive unit tests for Ollama service methods.

### 🔧 Reliability Improvements

- Model warm-up endpoint now correctly resolves embedding model from either config field.
- Preflight scheduled check also uses correct field resolution.

### 👥 Who This Helps

- **End users:** Warm-up button now works correctly with any embedding model configuration.
- **Operators/admins:** Better test coverage means more reliable releases.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.7d-alpha] - 2026-02-23

**Title: Smarter Ollama Connection Handling and Model Warm-up**

### 🎉 What You'll Notice

- Classification requests fail faster when Ollama is unreachable, with automatic retry queuing.
- New "Warm Models" option pre-loads your AI and embedding models into memory.
- Daily health checks proactively verify Ollama connectivity and model availability.
- HTTP 500 errors from Ollama are now treated as temporary issues, not permanent failures.

### 📊 Quick Visual

```text
Ollama Resilience Snapshot
Connection Preflight    [█████████░] 90%
Auto-Retry on 5xx       [██████████] 100%
Model Warm-up Control   [██████████] 100%
Proactive Health Check  [█████████░] 90%
```

### ✨ Highlights

- Added preflight connection checks before classification to catch Ollama issues early.
- New API endpoints let you manually warm models and check connection status.
- Scheduled daily preflight verifies both AI classification and embedding models.

### 🔧 Reliability Improvements

- HTTP 500/502/503/504 errors from Ollama now queue for retry instead of failing permanently.
- Added specific retry reason codes for different failure types (timeout, server error, stream incomplete).
- Preflight cache increased to 60 seconds to reduce redundant checks during rapid classification.

### 👥 Who This Helps

- **End users:** Classifications recover automatically from temporary Ollama hiccups.
- **Operators/admins:** New warm-up controls prevent cold-start delays; health visibility into Ollama status.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.7c-alpha] - 2026-02-23

**Title: Quieter Recovery During OMDb SSL Outages and Cleaner LAN Access**

### 🎉 What You'll Notice

- OMDb certificate failures no longer flood warning logs over and over.
- Metadata enrichment now pauses OMDb safely and auto-resumes after certificate recovery.
- Optional LAN HTTP mode reduces browser console noise from COOP/OAC warnings.

### 📊 Quick Visual

```text
Operational Snapshot
Log Noise Reduction      [#########-] 90%
Auto-Recovery Behavior   [#########-] 90%
LAN Browser Cleanliness  [########--] 80%
```

### ✨ Highlights

- OMDb SSL certificate failures are now treated as temporary outages with controlled retry and recovery checks.
- SSL failures stay in the OMDb retry path instead of being rerouted as alternate-source fallback behavior.

### 🔧 Reliability Improvements

- Added throttling for repeated SSL warning logs to prevent operational spam.
- Added configurable controls for SSL block windows and recovery probe intervals.
- Added `SECURITY_HEADERS_STRICT` so HTTP LAN deployments can disable strict COOP/OAC headers when needed.

### 👥 Who This Helps

- **End users:** fewer noisy interruptions while requests continue to recover cleanly in the background.
- **Operators/admins:** clearer logs, safer retry behavior, and better LAN console experience during local HTTP access.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.7b-alpha] - 2026-02-23

**Title: Security Scan Hotfix for Cleaner Release Validation**

### 🎉 What You'll Notice

- Release security scanning is now stable again for this version line.
- Client dev dependency resolution no longer pulls vulnerable `minimatch` 9.x.
- No feature behavior changes to classification or routing flows.

### 📊 Quick Visual

```text
Release Safety Snapshot
OSV Tag Scan Reliability [██████████] 100%
Dependency Risk Reduction[██████████] 100%
User-Facing Change Scope [████████░░] 80%
```

### ✨ Highlights

- Added client dependency override to enforce `minimatch >=10.2.1`.
- Regenerated lockfile so transitive dev dependencies resolve to safe versions.

### 🔧 Reliability Improvements

- Prevents repeat tag-release OSV failures caused by vulnerable transitive dev packages.
- Keeps release pipeline green without broad dependency churn.

### 👥 Who This Helps

- **End users:** faster, cleaner release rollouts with fewer pipeline interruptions.
- **Operators/admins:** fewer false starts when validating tag-based release health gates.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.7a-alpha] - 2026-02-23

**Title: Discord Choices Now Route to the Library You Pick**

### 🎉 What You'll Notice

- Discord clarification buttons now map overlapping names correctly when you choose a library like `Movies`.
- Selecting `Movies` no longer gets redirected to `Anime Movies` due to partial name matching.
- Clarification outcomes are more predictable for similarly named libraries.

### 📊 Quick Visual

```text
Routing Accuracy Snapshot
Exact Name Mapping      [██████████] 100%
Discord Choice Fidelity [██████████] 100%
Ambiguous Name Safety   [█████████░] 90%
```

### ✨ Highlights

- Clarification option mapping now prioritizes exact library name matches before partial/substring fallbacks.
- Added regression coverage for overlapping names (`Anime Movies` vs `Movies`) to lock the behavior.

### 🔧 Reliability Improvements

- Reduced risk of silent misroutes in pending clarification flows.
- Better guardrails for future library naming overlap as catalogs evolve.

### 👥 Who This Helps

- **End users:** Discord button choices now align with the destination library you intended.
- **Operators/admins:** less manual cleanup from misrouted clarification actions.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.7-alpha] - 2026-02-20

**Title: Cleaner Alerts and Smarter Metadata Recovery**

### 🎉 What You'll Notice

- **Fewer false alarm errors** when OMDb simply has no usable data for a title.
- **Automatic fallback to Tavily** after OMDb retry exhaustion, instead of getting stuck as a hard OMDb failure.
- **Processing cards show real titles more consistently** instead of falling back to `Unknown`.
- **One-time log reset on upgrade** gives operators a clean error baseline for this rollout.

### 📊 Quick Visual

```text
Impact Snapshot
Error Noise Reduction      [█████████░] 90%
Fallback Recovery Path     [██████████] 100%
Operator Visibility        [█████████░] 90%
```

### ✨ Highlights

- OMDb exhausted retries now transition to Tavily fallback handling in a cleaner, more actionable way.
- Expected no-data OMDb misses are treated as recoverable metadata gaps, not hard platform failures.
- Command Center active processing display is more reliable when task payload shape varies.

### 🔧 Reliability Improvements

- Added a release-scoped one-time post-upgrade log reset task (`clear_logs_0427`) for fresh rollout triage.
- Added regression coverage for OMDb exhausted-to-Tavily handoff and severity behavior.

### 👥 Who This Helps

- **End users:** fewer confusing failure signals while metadata enrichment keeps progressing through fallback paths.
- **Operators/admins:** clearer distinction between expected source-data misses and true operational errors.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.6-alpha] - 2026-02-19

**Title: Stronger Runtime Safety and More Predictable Recovery**

### 🎉 What You'll Notice

- **Second-pass classification no longer crashes** from runtime constructor wiring issues.
- **Clear & Re-sync is safer under load**, with stronger dependency handling and clearer failure feedback.
- **RAG logs are easier to read**, highlighting actionable failures while reducing expected-noise events.
- **Startup now validates critical runtime wiring** before worker scheduling begins.

### 📊 Quick Visual

```text
Stability Snapshot
Second-Pass Runtime Safety [██████████] 100%
CARSA Recovery Resilience  [█████████░] 90%
RAG Log Signal Quality     [█████████░] 90%
Startup Safety Checks      [██████████] 100%
```

### ✨ Highlights

- Added protection so second-pass timeout handling uses the correct runtime controller wiring path.
- Clear-and-resync now performs deterministic dependency cleanup and returns structured error codes/details for faster diagnosis.
- Runtime startup validation now catches critical module/export mismatches before queue and scheduler startup.

### 🔧 Reliability Improvements

- Added transactional cleanup flow for CARSA with rollback behavior on partial failure.
- Preserved policy feedback history while clearing stale library references during full reset.
- Improved stage-event metadata consistency for raw error fields (`message`, `name`, `code`).

### 👥 Who This Helps

- **End users:** fewer stuck classifications and cleaner, more understandable behavior during maintenance.
- **Operators/admins:** faster root-cause diagnosis from structured errors and improved runtime preflight checks.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.5e-alpha] - 2026-02-19

**Title: Safer Re-Sync Recovery and More Readable Settings History**

### 🎉 What You'll Notice

- **Clear & Re-sync is more resilient** and no longer gets blocked by sync-status references.
- **Queue worker recovers automatically** if a clear/resync run fails mid-process.
- **Confidence settings history is now readable**, with clearer labels, values, and change reasons.
- **Header dropdown overlays are cleaner** and no longer render under the top bar.

### 📊 Quick Visual

```text
Operational Snapshot
Re-sync Reliability    [██████████] 100%
Worker Recovery Safety [██████████] 100%
Settings Clarity       [█████████░] 90%
UI Layering Consistency[█████████░] 90%
```

### ✨ Highlights

- The clear-and-resync flow now clears dependent sync-status rows before removing libraries, preventing FK-related failures.
- If clear-and-resync encounters an error, the queue worker is automatically restarted when it was running before the operation.
- Confidence configuration history now displays human-friendly setting names and better value formatting.

### 🔧 Reliability Improvements

- Added regression coverage for clear-and-resync worker restart behavior after failure.
- Strengthened dependency-safe table clear order in queue reset logic.
- Improved settings history rendering across mixed field shapes to reduce “Unknown” noise.

### 👥 Who This Helps

- **End users:** Fewer stalled operations and clearer settings change visibility.
- **Operators/admins:** Faster diagnosis and safer recovery during maintenance actions.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.5d-alpha] - 2026-02-19

**Title: Smarter Second-Pass Decisions and Cleaner Tavily Recovery**

### 🎉 What You'll Notice

- **Fewer unnecessary second-pass retries** when AI confidence is already strong and low-risk.
- **Cleaner retry behavior for Tavily** while monthly quota is exhausted.
- **Better diagnostics for true second-pass failures** when they happen.

### 📊 Quick Visual

```text
Reliability Snapshot
Second-Pass Gating     [██████████] 100%
Tavily Queue Stability [█████████░] 90%
Failure Diagnostics    [█████████░] 90%
```

### ✨ Highlights

- Added a confidence-aware gate so policy `prompt_select` can skip second pass when there are no prompt-risk signals.
- Tavily retry rows now stay deferred/pending for monthly quota reset scenarios instead of drifting into noisy terminal states.
- Second-pass failure mapping now preserves raw error context and refines generic reason codes for faster root-cause analysis.

### 🔧 Reliability Improvements

- Added a new config toggle for confidence-aware policy recheck skipping (default enabled).
- Added migration support so existing installs safely receive the new config column.
- Suppressed non-actionable second-pass no-op logging for the new skip-by-design path.

### 👥 Who This Helps

- **End users:** Less confusing noise when classification already has enough confidence.
- **Operators/admins:** Clearer logs that emphasize real failures over expected no-op paths.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.5c-alpha] - 2026-02-18

**Title: Smarter Tavily Retries and Cleaner Second-Pass Logs**

### 🎉 What You'll Notice

- **Tavily retries now run independently** even when OMDb is quota-limited.
- **Monthly quota Tavily items stay safely pending** until the next quota reset.
- **Second-pass “no action needed” events are quieter** and no longer clutter Error Logs.

### 📊 Quick Visual

```text
Operational Snapshot
Tavily Retry Continuity [██████████] 100%
Deferred Queue Safety   [██████████] 100%
Log Noise Reduction     [█████████░] 90%
```

### ✨ Highlights

- The enrichment scheduler now keeps Tavily processing active even when OMDb is paused for daily quota.
- Tavily monthly-quota rows are normalized into deferred pending state instead of ending as failed/skipped dead ends.
- Non-actionable second-pass outcomes (like “no material improvement”) are suppressed from persisted Error Logs.

### 🔧 Reliability Improvements

- Added a migration to restore legacy Tavily quota-related rows back to pending deferred state.
- Added explicit “retry exhausted” error logging when enrichment cannot be completed after allowed attempts.
- Expanded regression tests for Tavily deferred behavior and second-pass log suppression.

### 👥 Who This Helps

- **End users:** Fewer confusing stalled retries and cleaner operational behavior around monthly quota resets.
- **Operators/admins:** Less noise in logs and clearer signal when something actually needs intervention.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.5b-alpha] - 2026-02-18

**Title: Smarter Tavily Retry Handling with Less Alert Noise**

### 🎉 What You'll Notice

- **Tavily monthly quota retries now defer cleanly** instead of consuming attempts and exhausting.
- **Fewer noisy warnings** from enrichment retry self-heal events.
- **Retry state is more stable** and no longer reopens exhausted rows as pending.

### 📊 Quick Visual

```text
Retry Behavior Snapshot
Monthly Quota Handling  [██████████] 100%
Queue State Stability   [█████████░] 90%
Warning Noise Reduction [█████████░] 90%
```

### ✨ Highlights

- Tavily `432` (monthly quota) responses now defer retry items until monthly reset instead of incrementing attempts.
- Deferred Tavily items are automatically reactivated when a new month begins.
- Exhausted retry rows are no longer unintentionally resurrected to `pending`.

### 🔧 Reliability Improvements

- Added a one-time migration to convert legacy exhausted Tavily `432` pending rows into deferred rows.
- Enrichment retry auto-heal entries now log at `INFO` instead of `WARN` to reduce false alarm volume.
- Added regression tests for Tavily monthly quota defer behavior and deferred activation paths.

### 👥 Who This Helps

- **End users:** More predictable enrichment behavior during Tavily monthly quota exhaustion.
- **Operators/admins:** Cleaner logs and fewer repetitive queue-health warnings.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.5a-alpha] - 2026-02-18

**Title: Safer Discord Decisions and Self-Healing Queue Reliability**

### 🎉 What You'll Notice

- **Retry queues no longer silently stall** on exhausted pending enrichment rows
- **Discord correction actions now attempt routing**, instead of only saving a library correction
- **Clearer routing feedback** when Sonarr/Radarr routing is skipped or fails

### 📊 Quick Visual

```text
Reliability Snapshot
Retry Queue Healing   [██████████] 100%
Routing Visibility    [█████████░] 90%
Queue UI Consistency  [█████████░] 90%
```

### ✨ Highlights

- Dead enrichment retries are now auto-healed from `pending` to `failed` when max attempts are exhausted.
- Routing now returns explicit outcomes (`routed`, `reason`, `error`) so skipped adds are visible.
- Discord correction flow now resolves clarification state and performs routing on correction.

### 🔧 Reliability Improvements

- Command Center “Up Next” count and rows now use the same classification-only source.
- Pending classification resolution now only marks `routed` when route execution actually succeeds.
- Added regression tests for retry auto-heal, route outcome propagation, and Command Center queue display consistency.

### 👥 Who This Helps

- **End users:** Fewer confusing “it looked done but never arrived in Sonarr/Radarr” outcomes.
- **Operators/admins:** Faster diagnosis with explicit routing reason codes and non-silent queue behavior.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.5-alpha] - 2026-02-18

**Title: Stronger AI Resilience and Clearer Operations**

### 🎉 What You'll Notice

- **Fewer “stuck” classifications** when AI output is malformed or partial
- **More accurate Command Center phase visibility** including explicit skipped steps
- **Better log visibility** with Info-level filtering and totals that match what you actually see

### 📊 Quick Visual

```text
Operational Snapshot
AI Response Handling  [█████████░] 90%
RAG Retry Resilience  [████████░░] 80%
Log Visibility        [█████████░] 90%
```

### ✨ Highlights

- **AI response repair pass** now attempts a safe normalization when the model returns malformed output, reducing fallback-only outcomes.
- **Second-pass RAG retries** are more resilient, with clearer stage outcomes and reason codes for diagnostics.
- **Command Center phase tracking** now shows skipped phases (including Signal Combination) instead of silently appearing missing.

### 🔧 Reliability Improvements

- Added a migration to backfill the missing `idx_embeddings_hnsw` index when supported by the environment.
- Improved log pipeline behavior to avoid duplicate DB persistence in RAG stage event paths.
- Added stronger test and CI guardrails, including coverage ratchet checks and expanded route coverage suites.

### 👥 Who This Helps

- **End users:** Fewer confusing AI classification failures and clearer phase progress.
- **Operators/admins:** Better observability for RAG stages, logs, and system behavior under transient failures.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.4-alpha] - 2026-02-18

**Title: Quieter Logs, Smoother Enrichment**

### 🎉 What You'll Notice

- **OMDb enrichment is more reliable** — transient network hiccups no longer block all subsequent enrichment requests
- **Cleaner logs** — no more "OMDb circuit breaker is OPEN" messages flooding your logs
- **No more stale blocks** — enrichment resumes immediately after a network issue clears, without waiting for a 30-second cooldown

### 📊 Quick Visual

```text
Before:                              After:
┌─────────────────────────┐          ┌─────────────────────────┐
│ 3 network errors        │          │ 3 network errors        │
│ → Circuit OPEN          │    →     │ → Retry with backoff    │
│ → All enrichment blocked│          │ → Resume immediately    │
│ → 30s cooldown          │          │ → No cooldown needed    │
└─────────────────────────┘          └─────────────────────────┘
```

### ✨ Highlights

- **Circuit breaker removed** — the OMDb circuit breaker was too aggressive for an optional enrichment service, blocking valid requests after just 3 transient failures
- **Existing protections are sufficient** — 15-second timeouts, 2 retries with exponential backoff, daily quota checks, and the enrichment retry queue handle failures gracefully without a circuit breaker

### 🔧 Reliability Improvements

- Enrichment no longer gets stuck in a blocked state after temporary network issues
- The admin "Reset Circuit Breaker" button has been removed (no longer needed)
- Health check no longer shows a `circuit_open` status for OMDb

### 👥 Who This Helps

- **All users:** OMDb metadata enrichment is more resilient to brief network interruptions
- **Operators/admins:** Fewer false-alarm log entries and no more manual circuit breaker resets

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.3c-alpha] - 2026-02-17

**Title: Schema Sync Fix for Method Constraint**

### 🎉 What You'll Notice

- **No more constraint violations** — the `policy_recheck` method is now properly included in the schema reference file
- **Migrations work correctly** — fresh database installations will have the complete constraint

### 📊 Quick Visual

```text
Issue Timeline:
┌─────────────────────────────────────────────────────────┐
│ v0.42.3b: Migration added policy_recheck                │
│           BUT current.sql schema file was missed        │
│ v0.42.3c: Schema file now includes policy_recheck       │
└─────────────────────────────────────────────────────────┘
```

### ✨ Highlights

- **Schema File Update** — Added `policy_recheck` to `database/schema/current.sql` constraint definition
- **New Consolidated Migration** — `20260217_192610_fix_classification_method_constraint.sql` ensures all 22 methods are included

### 🔧 Reliability Improvements

- Schema reference file now matches migration files
- All 22 classification methods are documented in one place

### 👥 Who This Helps

- **All users:** Fresh installations get correct constraints from the start
- **Developers:** Schema file is now the single source of truth for constraint methods

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.3b-alpha] - 2026-02-17

**Title: Policy Recheck Method Constraint Fix**

### 🎉 What You'll Notice

- **Policy recheck classifications complete successfully** — no more constraint violation errors for `policy_recheck` method
- **Better test coverage** — automated tests now catch missing constraint methods before deployment

### 📊 Quick Visual

```text
Issue Flow:
┌─────────────────────────────────────────────────────────┐
│ v0.42.3a added 3 methods, missed policy_recheck        │
│ v0.42.3b adds policy_recheck + regression tests        │
└─────────────────────────────────────────────────────────┘

Regression Protection:
┌─────────────────────────────────────────────────────────┐
│ Code scans all method: values in services/              │
│     ↓                                                   │
│ Compares against VALID_METHODS list                     │
│     ↓                                                   │
│ Integration test validates DB constraint matches        │
└─────────────────────────────────────────────────────────┘
```

### ✨ Highlights

- **Database Constraint Update** — Added missing `policy_recheck` method to the `classification_history_method_check` constraint

### 🔧 Reliability Improvements

- New migration `20260217_233000_add_policy_recheck_method.sql`
- New unit test `classification-methods-constraint.test.js` — scans service code for `method:` values and validates against allowed list
- New integration test `integration/classification-methods-constraint.test.js` — validates DB constraint matches code and can insert with each method

### 👥 Who This Helps

- **All users:** Classifications using policy recheck flow no longer fail with database errors
- **Developers:** Future constraint violations are caught by automated tests

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.3a-alpha] - 2026-02-17

**Title: Classification Method Constraint Fix**

### 🎉 What You'll Notice

- **Classifications complete successfully** — no more constraint violation errors for certain classification methods
- **RAG-improved results work** — methods like `rag_improved`, `policy_engine`, and `authoritative_source_library` are now valid

### 📊 Quick Visual

```text
Before:                          After:
┌────────────────────────┐       ┌────────────────────────┐
│ "rag_improved"         │       │ "rag_improved"         │
│ → DB constraint error  │  →    │ → Saved successfully   │
│ Classification fails   │       │ Classification works   │
└────────────────────────┘       └────────────────────────┘
```

### ✨ Highlights

- **Database Constraint Update** — Added 3 missing classification methods to the `classification_history_method_check` constraint

### 🔧 Reliability Improvements

- New migration `20260217_224200_add_missing_classification_methods.sql` adds `rag_improved`, `authoritative_source_library`, and `policy_engine` methods
- Updated schema `current.sql` to reflect new constraint

### 👥 Who This Helps

- **All users:** Classifications using policy engine or RAG improvements no longer fail with database errors

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.3-alpha] - 2026-02-17

**Title: Smarter Timeouts & Proper Cancellation**

### 🎉 What You'll Notice

- **Classifications don't hang** — long-running AI/embedding operations can now be properly cancelled
- **Cleaner error handling** — timeouts no longer pollute failure metrics
- **Better resource cleanup** — cancelled requests free up connections immediately

### 📊 Quick Visual

```text
Before:                               After:
┌──────────────────────────┐          ┌──────────────────────────┐
│ Timeout = ignore result  │          │ Timeout = abort request  │
│ Connection stays open    │    →     │ Connection closes fast   │
│ Counts as "failed"       │          │ Not counted as failure   │
└──────────────────────────┘          └──────────────────────────┘
```

### ✨ Highlights

- **Unified AbortController Strategy** — All embedding providers (OpenAI, Gemini, Voyage, Cohere, OpenRouter, Ollama) now support proper request cancellation
- **OperationController Utility** — New centralized timeout/abort handling with both simple and streaming modes
- **Signal Propagation** — Cancellation signals flow through the entire chain: classification → RAG retrieval → embedding router → provider

### 🔧 Reliability Improvements

- 29 new tests for `OperationController` covering timeout, abort, stall detection, and streaming scenarios
- 4 new tests for `ragRetriever` AbortSignal support
- Updated cloud embedding methods to re-throw `AbortError` immediately (no failure recording)
- Full test suite: 79 server suites (1277 tests) + 33 client suites (339 tests) all passing

### 👥 Who This Helps

- **All users:** Classifications are more responsive and don't hang on slow connections
- **Self-hosters:** Better resource management when AI/embedding services are slow
- **Operators:** Timeouts no longer artificially inflate failure metrics

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.2-alpha] - 2026-02-17

**Title: Smarter Scoring & More Reliable Second Pass**

### 🎉 What You'll Notice

- **Higher confidence on clear items** — when multiple signals agree, the score now reflects that consensus
- **Second pass actually improves results** — relaxed gates and extended timeouts let the rerun do its job
- **Fewer unnecessary prompts** — low-quality candidates are filtered from policy questions

### 📊 Quick Visual

```text
Before:                               After:
┌──────────────────────────┐          ┌──────────────────────────┐
│ 4/5 signals agree → 32%  │          │ 4/5 signals agree → 38%  │
│ Second pass times out    │    →     │ 20% boost from agreement │
│ Weak candidates shown    │          │ Only strong candidates    │
└──────────────────────────┘          └──────────────────────────┘
```

### ✨ Highlights

- **Signal Agreement Scoring** — new consensus multiplier boosts confidence 5-30% when 2-5 signals agree on the same library
- **Second Pass Fixes** — extended timeouts (up to 15s), relaxed policy recheck gate, OR-based adoption, and RAG-sourced candidate building
- **Policy Question Filtering** — low-score candidates no longer clutter manual resolution prompts

### 🔧 Reliability Improvements

- 9 new unit tests for agreement multiplier and relaxed gate paths
- Full test suite: 77 server suites (1239 tests) + 33 client suites (199 tests) all passing

### 👥 Who This Helps

- **All users:** Clearer items resolve faster with higher confidence
- **Self-hosters:** Second pass improvements reduce unnecessary manual interventions
- **Operators:** Better scoring transparency with agreement metadata in evaluation results

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.1d-alpha] - 2026-02-17

**Title: Enrichment Retry Respects Daily Limits**

### 🎉 What You'll Notice

- **OMDb only** - Auto-retry now only processes OMDb items (Tavily uses monthly credits, no auto-retry)
- **Respects your daily limit** - Pauses retry when OMDb daily limit reached until next day reset
- **Quota-aware batching** - Won't exceed your remaining daily API calls

### 📊 Quick Visual

```text
Before:                              After:
┌─────────────────────────┐          ┌─────────────────────────┐
│ Retries OMDb AND Tavily │          │ Retries OMDb only       │
│ Ignores daily limits    │    →     │ Checks daily limit      │
│ May exceed quota        │          │ Pauses when limit hit   │
└─────────────────────────┘          └─────────────────────────┘
```

### ✨ Highlights

- **Daily limit check** - Checks remaining quota before processing
- **Smart batching** - Only processes up to remaining quota
- **Tavily skipped** - Tavily has monthly credits, should not be auto-retried

### 🔧 Reliability Improvements

- 11 new tests for quota checking and retry scheduling
- Prevents wasted API calls when quota exhausted

### 👥 Who This Helps

- **Premium OMDb users:** Higher limits are respected automatically
- **Free tier users:** Won't waste precious daily calls on retries
- **Everyone:** Tavily monthly credits preserved for manual use

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.1c-alpha] - 2026-02-17

**Title: Smart On-Demand Enrichment Retry**

### 🎉 What You'll Notice

- **No more manual "Retry OMDb"** - Enrichment retries now trigger automatically when items are queued
- **Efficient scheduling** - Only runs when there's work to do, not on a fixed timer
- **CPU-friendly** - Safety net cron reduced to every 6 hours (on-demand handles immediate needs)

### 📊 Quick Visual

```text
Before:                              After:
┌─────────────────────────┐          ┌─────────────────────────┐
│ Cron every 10 min       │          │ On-demand (5s delay)    │
│ Runs even if 0 pending  │    →     │ Only runs when needed   │
│ Wastes CPU cycles       │          │ 6hr cron as backup      │
└─────────────────────────┘          └─────────────────────────┘
```

### ✨ Highlights

- **Smart scheduling** - Triggers 5 seconds after items are queued, skips if nothing pending
- **Debounced triggers** - Won't spam multiple times if many items queued at once
- **7 new tests** for scheduling logic

### 🔧 Reliability Improvements

- Enrichment queue processes automatically without manual intervention
- Concurrent processing protection prevents duplicate work

### 👥 Who This Helps

- **All users:** Enrichment happens automatically, no need to click retry
- **Self-hosters:** Less CPU usage when queue is empty

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.1b-alpha] - 2026-02-17

**Title: Bug Fix and Massive Test Coverage Expansion**

### 🎉 What You'll Notice

- **Enrichment works again** - Fixed a typo that was breaking OMDb enrichment for new media
- **Cleaner UI** - Removed non-functional hamburger menu on desktop
- **More reliable releases** - 202 new tests ensure future changes don't break things

### 📊 Quick Visual

```text
Test Coverage Expansion
Before:                        After:
┌────────────────────┐        ┌────────────────────────────┐
│ enrichmentRetry    │        │ enrichmentRetry ████████ 28│
│ aiRouter          0│   →    │ aiRouter      ████████ 23│
│ mediaSync         0│        │ mediaSync     ████████ 22│
│ *arr services     0│        │ radarr        ████████ 27│
│ media servers     0│        │ sonarr        ████████ 27│
│ web services      0│        │ tavily        ████████ 25│
└────────────────────┘        │ plex/jellyfin/emby ████ 52│
                              └────────────────────────────┘
                              Total: 202 new tests
```

### ✨ Highlights

- **Bug fix** - Corrected `getById` to `getByIMDBId` in enrichment service
- **9 new test suites** covering the most critical services
- **Better line endings** - `.gitattributes` now enforces LF across all text files

### 🔧 Reliability Improvements

- Tests would have caught the `getById` typo before production
- All core services now have test coverage (AI routing, sync, \*arr integration)
- Future regressions will be caught by CI

### 👥 Who This Helps

- **All users:** Enrichment now works for new media items
- **Developers:** 202 tests provide safety net for future changes

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.1a-alpha] - 2026-02-17

**Title: Smarter Queue Handling When AI is Offline**

### 🎉 What You'll Notice

- **Clear feedback when waiting** - Processing section now tells you when tasks are queued but AI is unavailable
- **Faster OMDb recovery** - Cloudflare errors trigger longer delays, preventing repeated failures
- **New database migration** - Classification status "routed" now supported for items sent to \*arr after manual resolution

### 📊 Quick Visual

```text
Before:                    After:
┌─────────────────┐        ┌─────────────────────────┐
│ No active       │        │ ⚠️ Waiting for AI        │
│ processing      │   →    │ 3 tasks queued but AI   │
│                 │        │ provider is offline     │
└─────────────────┘        │ [Check AI Settings]     │
                           └─────────────────────────┘
```

### ✨ Highlights

- **"Waiting for AI" state** - When AI is offline and tasks are pending, the Processing section shows why processing is paused with a quick link to AI settings
- **OMDb rate limiting** - 1-second minimum delay between requests prevents Cloudflare 520 errors
- **Extended Cloudflare retries** - 3-6 second delays for 5xx Cloudflare errors instead of 1-2 seconds

### 🔧 Reliability Improvements

- 51 OMDb tests covering circuit breaker lifecycle, rate limiting, and Cloudflare error handling
- 10 real media examples (mix of TV/movies) used in integration tests
- Classification history now supports "routed" status for items successfully sent to \*arr after resolution

### 👥 Who This Helps

- **Self-hosters with Ollama:** Clear indication when Ollama is offline and tasks are waiting
- **All users:** Fewer OMDb failures due to smarter rate limiting and retry delays
- **Operators:** More test coverage for OMDb reliability

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.1-alpha] - 2026-02-16

**Title: Stronger Protection When External Services Falter**

### 🎉 What You'll Notice

- **Fewer cascading errors** when OMDb has issues - the system now recognizes and protects against more failure types
- **Copy buttons work everywhere** - Webhook URL and secret key copy reliably, even in non-HTTPS environments
- **Cleaner logs** - fewer confusing error messages during temporary outages

### 📊 Quick Visual

```text
Circuit Breaker Protection Coverage
Before this release:
  Network errors    [██████░░░░] 60%
  Server errors     [░░░░░░░░░░] 0%

After this release:
  Network errors    [██████████] 100%
  Server errors     [██████████] 100%
```

### ✨ Highlights

- **Expanded circuit breaker coverage** - now trips on DNS failures (ENOTFOUND), connection resets, and Cloudflare errors (520-524, 502-504)
- **Improved clipboard compatibility** - fallback method ensures copy works in all browser contexts
- **Null safety fix** - settings page no longer errors on empty values

### 🔧 Reliability Improvements

- Circuit breaker now detects and protects against 8 additional error conditions
- When OMDb infrastructure has issues, the system gracefully falls back instead of flooding logs
- Per-request retries still happen, but the circuit opens faster to prevent waste

### 👥 Who This Helps

- **Self-hosters:** System stays stable even when external APIs have transient issues
- **Operators:** Cleaner logs and fewer alert storms during outages
- **All users:** Copy buttons in settings work reliably

### 📚 Want Technical Details?

See `CHANGELOG.md` for full technical details.

---

## [v0.42.0-alpha] - 2026-02-14

**Title: Command Center - One Surface for Everything**

> [!IMPORTANT]
> This release introduces the new Command Center as the default operational surface. Previous Dashboard, Activity, and Queue pages redirect automatically with guidance notices.

### 🎉 What You'll Notice

- **One page, all actions** - No more bouncing between Dashboard, Activity, and Queue
- **Live processing view** - Visual stepper shows exactly where each classification is in the 8-step pipeline
- **Inline decisions** - Resolve policy questions with Confirm/Change/Yes/No without leaving the page
- **Smart notifications** - Bell icon shows unread count, full panel for history, deep-links to relevant sections

### 📊 Quick Visual

```
┌─────────────────────────────────────────────────────────┐
│  COMMAND CENTER                        Live  2:14 PM    │
│  AI Online  │  Worker Active  │  2 Queue  │  0 Action   │
├─────────────────────┬───────────────────────────────────┤
│  PROCESSING         │  NEEDS ATTENTION                  │
│  ──────────────     │  ─────────────────                │
│  Inception (2010)   │  ┌─────────────────────────────┐  │
│  67% ████░░░░       │  │ The Matrix (1999)           │  │
│  ▶ AI Analysis      │  │ 78% confidence              │  │
│  ✓ ✓ ✓ ○ ○ ○ ○ ○    │  │ [Confirm] [Change]          │  │
│                     │  └─────────────────────────────┘  │
│  Up Next (3)        │                                   │
├─────────────────────┴───────────────────────────────────┤
│  Errors −  Enrichment (89%) −  Recently Completed       │
│  Quick Add +  Libraries −  Today's Summary +            │
└─────────────────────────────────────────────────────────┘
```

### ✨ Highlights

**Command Center**

- Split-layout with Processing + Needs Attention always visible
- Visual phase stepper: Queued → Metadata → Policy → RAG → Signal → AI → Decision → Notification
- Collapsible secondary sections expand when you need them
- Mobile bottom sheet for Processing details on small screens

**Notifications**

- Bell icon in header with live unread count
- Panel groups unread first, then read items
- Mark All Read in one click
- Open-target routing lands on exact Command Center section

**Smart Data Layer**

- Adaptive polling: fast when active, slow when idle
- Tab visibility awareness: pauses when hidden
- Freshness indicator shows Live/Updating status
- No page refresh needed after actions

### 🔄 Transition Notes

**Legacy Routes Redirect Automatically:**

- `/dashboard` → Command Center
- `/activity` → Command Center `#processing`
- `/queue` → Command Center `#processing`

A dismissible notice explains the change on first visit.

**Navigation Changes:**

- Activity and Queue removed from sidebar (functionality is in Command Center)
- Migration page removed from primary navigation
- History remains available for audits and reclassification

### 👥 Who This Helps

- **Daily operators:** Resolve everything on one page without context switching
- **Mobile users:** Touch-friendly layout with bottom sheet for details
- **Admins:** Global notifications surface issues before they become problems

### 📚 Want Technical Details?

See `CHANGELOG.md` for full implementation notes, test scope, and migration-level details.

---

## [v0.41.3-alpha] - 2026-02-11

**Title: Smarter Low-Confidence Routing**

> [!IMPORTANT]
> This upgrade is active by default after update. No observation window is required.

### 🎉 What You’ll Notice

- More low-confidence items can now resolve automatically with a smarter second check.
- Better safety: if quality trends regress, Classifarr can automatically switch to a safer diagnostic mode.
- Cleaner operations: less noisy warnings and clearer request error responses.

### 📊 Quick Visual

```text
Classification flow
Pass 1 🧠  →  Targeted Pass 2 🔎  →  Apply only if better ✅
                     ↘ not better / unavailable → keep safe baseline 🛡️

Safety flow
apply 🟢  ──(sustained regression detected)──▶  shadow 🛡️
```

### ✨ Highlights

- Immediate-apply low-confidence enhancement is now on by default.
- New automatic fallback + optional auto-re-enable controls are available in settings.
- Policy preset picker now shows usage context (`Used in X policies`) to make selection easier.

### 🔧 Reliability Improvements

- Invalid JSON requests now return a cleaner, user-friendly 400 response.
- OMDb HALF_OPEN throttle warnings are reduced to prevent log spam.
- Added release-scoped log reset for cleaner post-upgrade baseline visibility.

### 👥 Who This Helps

- **General users:** fewer manual interventions on tricky/ambiguous items.
- **Operators/admins:** safer rollout behavior, clearer fallback diagnostics, and less noisy logs.

### 📚 Want Technical Details?

See `CHANGELOG.md` for full implementation notes, test scope, and migration-level details.

---

## [v0.41.2d-alpha] - 2026-02-07

**Title: Fresh Install Recovery Update**

> [!IMPORTANT]
> If `v0.41.2c-alpha` failed during first-time setup, start fresh on `v0.41.2d-alpha` using a clean data folder/volume.

### ✅ What This Solves

- Fresh installs are now more reliable during database initialization.
- First-login setup flow is fixed (`/login` now correctly routes new installs).
- RAG status display is now consistent and readable.

### 📈 Quick Snapshot

```text
Fresh install reliability   ██████████
Setup flow clarity          █████████░
RAG status clarity          █████████░
```

### 📚 Want Technical Details?

See `CHANGELOG.md` (`v0.41.2d-alpha`) for exact fixes and implementation notes.

---

## [v0.41.2c-alpha] - 2026-02-06

**Title: RAG Settings UX Polish**

### 🎨 What Improved

- RAG Settings now keeps your current tab on refresh.
- Confidence settings naming is clearer and easier to understand.
- Project housekeeping improved (`.tmp/` intermediate files ignored).

### 📈 Quick Snapshot

```text
Settings usability          ████████░░
Navigation consistency      █████████░
Repo cleanliness            ████████░░
```

### 📚 Want Technical Details?

See `CHANGELOG.md` (`v0.41.2c-alpha`) for exact route/UI updates.

---

## [v0.41.2b-alpha] - 2026-02-06

**Title: Smarter Threshold Alignment**

### 🎯 What You’ll Notice

- Discord verification prompts better match your configured policy thresholds.
- Auto-routing now respects policy configuration instead of fixed confidence assumptions.
- CI cleanup behavior is more reliable and easier to run manually when needed.

### 📊 Quick Visual

```text
Before: fixed threshold assumptions ⚠️
After : policy-driven routing rules ✅
```

### 📈 Quick Snapshot

```text
Routing consistency         █████████░
Discord prompt quality      ████████░░
CI cleanup reliability      ████████░░
```

### 📚 Want Technical Details?

See `CHANGELOG.md` (`v0.41.2b-alpha`) for threshold and CI behavior specifics.

---

## [v0.41.2a-alpha] - 2026-02-06

**Title: Reliability Hotfix Pack**

> [!IMPORTANT]
> If you depend on remote poster URLs for external image embedding services, review companion service allowlist settings.

### 🛠️ What Improved

- Better resilience for temporary OMDb/network instability.
- Cleaner and clearer RAG status diagnostics.
- CI workflow hardening for more predictable release behavior.
- Important schema/logging fixes to reduce hidden operational issues.

### 📈 Quick Snapshot

```text
Service resilience          ████████░░
Diagnostics clarity         ████████░░
CI stability                ████████░░
```

### 📚 Want Technical Details?

See `CHANGELOG.md` (`v0.41.2a-alpha`) for dependency and fix details.

---

## [v0.41.2-alpha] - 2026-02-06

**Title: Multimodal RAG Launch (Image + Text)**

This release introduced image-aware retrieval for harder classification cases and made configuration safer by default.

### 🖼️ Big Upgrade

- Classifarr can combine **text + image context** during retrieval.
- This improves matching quality for ambiguous titles with similar names.
- Image embedding mode defaults to disabled, so users stay in control of compute/cost.

### 🧭 Platform Improvements

- Cleaner image embedding settings flow (simpler setup path).
- Stronger migration governance with timestamp checks and schema snapshot discipline.
- Better release hygiene and template cleanup.

### 📊 Quick Visual

```text
Retrieval context
Before: text only  📄
After : text + image 📄🖼️

Safety defaults
Image mode default: OFF ✅
```

### 📈 Quick Snapshot

```text
Retrieval quality potential  █████████░
Config safety by default     ██████████
Migration governance         ████████░░
```

### 📚 Want Technical Details?

See `CHANGELOG.md` (`v0.41.2-alpha`) for full schema, API, and testing detail.

---

## [v0.41.1-alpha] - 2026-02-02

**Release Date:** February 2, 2026

This release strengthens core reliability with a new OMDb Circuit Breaker, standardizes on Node.js 24 LTS, vastly improves dependency hygiene, and fixes several stability issues.

---

## 🎯 Highlights

### 🛡️ Major OMDb Reliability Improvements

We've significantly improved metadata enrichment reliability with industry-standard circuit breaker patterns, extended error handling, and fallback prioritization fixes.

- **Circuit Breaker:** Automatically detects OMDb outages and recovers after a cool-off period.
- **Visual Status:** System Health dashboard now clearly shows connection states (OPEN/CLOSED).
- **Better Fallbacks:** OMDb timeouts now trigger Tavily fallback correctly.

### 🔧 Node.js 24 LTS Standardization

All environments (Docker, CI/CD, local development) now use Node.js 24.11.0+ for consistency and modern feature support. This eliminates "works on my machine" issues and future-proofs the stack.

### 📦 Dependency Hygiene

Updated 12+ packages including `axios`, `express`, and `discord.js` with security fixes and performance improvements. Audit clean with 0 vulnerabilities.

### 🧪 Test Script Standardization

We've robustified our development tools:

- Standardized `npm run test` commands across both Client and Server.
- Fixed invalid path references in test scripts.
- Enforced safe execution (sequential) for integration tests to prevent database conflicts.

---

## 🔥 Critical Fixes

### OMDb Circuit Breaker Pattern (PR #293)

**Problem:** OMDb timeouts were returning null instead of throwing errors, preventing fallbacks.
**Solution:**
✅ Industry-standard 3-state circuit breaker (CLOSED → OPEN → HALF_OPEN)
✅ Automatic recovery after 30-second cool-off period
✅ Visual indicators in System Health dashboard (🔴 OPEN, 🟡 HALF_OPEN)
✅ Breaking change: Now throws errors on timeouts to enable Tavily fallback

### Enhanced OMDb Reliability

- **Cloudflare Error Handling:** Extended retry logic to cover all transient Cloudflare errors (520, 521, 522, 523).
- **Rating Normalization:** OMDb (MPAA) is now the #1 priority source for content ratings, ensuring accuracy.

---

## 📊 Statistics

- **Test Coverage:** 1,573 tests passing (848 server, 287 client, 438 integration)
- **Security Scan:** 0 vulnerabilities
- **Dependency Updates:** 12+ packages updated

---

## 🚨 Breaking Changes

- **OMDb Error Handling:** The OMDb service now throws errors instead of returning null on timeouts to enable Tavily fallback.
- **Node.js Version:** Minimum required version is now Node.js 24.11.0+.

---

## [0.41.0-alpha] - 2026-02-01

**Release Date:** February 1, 2026

This release delivers major improvements to system monitoring, documentation, user experience, and automation workflows.

---

## 🎯 Highlights

### 📊 System Health & Monitoring

- **Health Dashboard Trends (#184):** Visual trend indicators (↗️↘️→) show if services are improving or degrading
- **Last Successful Check:** Track when services were last healthy to diagnose outage duration
- **Per-Instance Monitoring:** Individual health tracking for Radarr/Sonarr instances

### 🔒 Service Awareness

- **Service Lockdown System (#206):** Features auto-disable when required services are unavailable
- **Clear User Guidance:** Tooltips explain requirements and link directly to settings

### 🤖 Smart Automation

- **Discord Verification Learning (#240):** System learns from user feedback to improve future classifications
- **Auto-Enhancement:** Genres, keywords, and studios automatically added to policy preferences
- **Rate Limiting:** Prevents runaway learning with user and library limits

### ⚙️ Configuration Management

- **Unified Confidence Settings (#241):** All thresholds in one intuitive interface
- **Visual Threshold Flow:** See auto-classify, prompt, and manual ranges at a glance
- **Audit Trail:** Track and revert configuration changes

### 💾 Backup & Restore

- **Encrypted Backups (#186):** AES-256-GCM encryption for config backups
- **Replace or Merge:** Choose how to apply backups
- **Complete Audit:** Track all backup operations

### 📚 Documentation

- **Comprehensive API Docs (#188):** Complete API reference with examples
- **Testing Coverage (#227):** 80% line coverage, 75% function coverage enforced
- **Accessibility (#204):** WCAG 2.1 AA compliant dashboard

---

## ✨ New Features

### System & Monitoring

- System Health Dashboard with trend tracking (#184)
- Service lockdown for unavailable dependencies (#206)
- Sync error hygiene with proper 404 handling (#226)

### Automation & Learning

- Discord verification learning from user feedback (#240)
- Auto-learned preferences with conflict detection
- Smart Discord thresholds (85%+ auto-route, 60-84% verify, <60% detailed)

### Configuration

- Unified confidence settings page (#241)
- Backup & restore system with encryption (#186)
- User profile settings page (#187)

### User Experience

- Classification signal breakdown in history (#185)
- Dashboard accessibility improvements (#204)
- Copyright compliance automation (#198)

### Documentation

- Comprehensive API documentation (#188)
- Testing coverage enforcement (#227)
- Migration guides and release notes

---

## 🔧 Improvements

### Error Handling

- Sync endpoints return 404 for missing libraries (#226)
- Consistent error format: `{ "error": "..." }`
- Reduced log noise for expected failures

### Testing & Quality

- 80% line coverage, 75% function coverage (#227)
- Integration tests for all major features
- Logger mocking for clean test output

### Security

- Copyright compliance CI checks (#198)
- Password strength enforcement
- Rate limiting on sensitive endpoints

---

## 🗑️ Removed

### Event Detection System Retirement

- **Database:** Removed event_detection_type and event_sub_type columns (migration 072) (#228)
- **Backend:** Removed detectEventContent() and all event detection code (#229)
- **Frontend:** Removed all event/holiday UI controls (#225)
- **Presets:** Removed 6 event presets (event_holiday, event_sports, event_ppv, event_concert, event_standup, event_awards)

**Migration:** Event detection now handled exclusively through PolicyEngine presets (migrated in v0.37.0)

---

## 📊 Statistics

- **14 Pull Requests Merged**
- **15+ Major Features Added**
- **3 Legacy Systems Retired**
- **100% Critical Test Coverage**
- **WCAG 2.1 AA Accessibility**

---

## 🙏 Contributors

Thank you to all contributors who made this release possible!

- @cloudbyday90
- Copilot coding agent

---

## 📖 Documentation

- [Migration Guide](docs/migration/v0.41.0-alpha.md)
- [API Documentation](docs/api/README.md)
- [Roadmap](docs/roadmap.md)
- [CHANGELOG](CHANGELOG.md)

---

## 🐛 Known Issues

None at this time.

---

## 🔮 What's Next (v0.42.0)

- RAG Similarity Visualization (#185)
- Advanced Policy Analytics
- Performance Optimizations
- Enhanced Policy Setup Experience

See [Roadmap](docs/roadmap.md) for details.

---

## v0.40.5d-alpha

**Title: \*arr Quality Profile Respect Fix**

### Fixes

- **Quality Profile Routing**: Radarr/Sonarr add requests now coerce `qualityProfileId` to a valid numeric ID and fall back to the instance config profile before defaulting, preventing "Any" quality selection when a profile is configured.

## v0.40.5c-alpha

**Title: Discord Verification Fix**

### Fixes

- **User Verification**: Fixed "Failed to process verification" error when clicking "Yes, Correct" or "No, Choose Different" in Discord.
  - Added specific error logging to ephemeral replies for better debugging.
  - Handled cases where `library_id` is missing in AI-classified items to prevent database errors.
- **Post-Migration Constraint Fix**: Added a new migration that expands `classification_history` status values to include `verified` and `reclassified` for existing installs.

## v0.40.5a-alpha

**Title: pgvector CPU Compatibility Hotfix**

### Fixes

- **Non-AVX CPU Safety**: pgvector now ships with generic + AVX variants and auto-selects the best binary at startup (AVX when supported, generic otherwise), preventing PostgreSQL crashes during vector similarity queries.
- **AVX2 Optimization**: Added an AVX2 pgvector variant and prefer it when the CPU supports AVX2 for faster similarity search.
- **Dashboard Visibility**: Added a banner when pgvector is running in generic mode so users can confirm CPU compatibility status.
- **Build Portability**: Generic pgvector builds now follow upstream guidance (`OPTFLAGS=""`) for maximum CPU compatibility.
- **Upgrade Recovery Marker**: Startup now records the previous version and runs a one-time PostgreSQL restart when upgrading from v0.40.5-alpha.
- **Verification Constraint Fix**: `classification_history` now accepts verification/reclassification status values to prevent constraint errors.

## v0.40.5-alpha

**Title: PolicyEngine + AI Pipeline, \*arr Routing, and Webhook Specials Toggle**

### Features

- **AI Analysis Phase**: Added AI analysis as an explicit phase in the classification pipeline with updated progress tracking.
- **Policy Question Enrichment**: Clarification prompts now include policy scores, weights, RAG summary, and AI rationale.
- **Webhook Specials Toggle**: Optional `include_specials` control to keep or exclude season 0 entries from Overseerr payloads.

### Fixes

- **OMDb Resilience**: Cloudflare 520/521/523 errors now retry/skip gracefully.
- **Clarification JSON Handling**: Safe parsing when `classification.metadata` is already JSONB.
- **Source Library Confidence**: Source-library reconciliations now report 100% confidence.
- **ProviderLockService Init**: Configuration loads on explicit startup, avoiding DB access during import.
- **Test Stability**: Logger DB persistence now uses explicit injection; integration tests set a deterministic `API_KEY_ENCRYPTION_KEY`.
- **Node 25 Test Warnings**: Jest runner strips invalid `--localstorage-file` options and disables experimental web storage.
- **Integration Test Noise**: Setup/migration logs are now opt-in via `INTEGRATION_TEST_VERBOSE`.
- **Migration Tracking**: Integration test setup now records applied migrations in `schema_migrations`.
- **Swagger Doc Fix**: API keys OpenAPI docs now parse cleanly (multi-line description block).

### Improvements

- **PolicyEngine Flow**: Policy signals + RAG feed AI analysis before any policy_prompt is generated.
- **\*arr Routing**: Sonarr uses TVDB lookup data, requested season monitoring, and search-on-add settings; Radarr respects quality profile and search-on-add.

---

## v0.40.4-alpha

**Title: Policy-Driven Clarification, Discord Resolution & \*arr Routing**

### Features

- **Policy-Driven Clarification**: Questions now source dynamically from policy presets and candidate libraries.
- **Smart Language Prompts**: Language questions are suppressed unless language presets exist and language is missing/non-English.

### Fixes

- **Discord Clarification Resolution**: Selections now correctly assign libraries and resolve pending items.
- **\*arr Routing**: Mapped libraries route even when legacy `arr_id` fields are missing.
- **Policy Question Stability**: Hardened parsing prevents invalid JSON errors during resolution.

### Improvements

- **Test Stability**: Improved reliability of integration tests by isolating service side effects, preventing random failures during development and CI runs.
- **Discord Prompts**: Clarify-tier prompts now rely on policy questions or manual selection (seeded buttons removed).
- **Auto-Migration**: One-time backfill aligns existing \*arr mappings with library fields.
- **Data Integrity**: Method/status constraints updated to prevent DB errors during manual resolutions.
- **Test Runner Stability**: Node 25 web storage warnings removed and Vue test noise reduced for cleaner CI output.

---

## v0.40.3a-alpha

**Hotfix: Broken Onboarding Link**

### Fixes

- **Dashboard Onboarding**: Fixed "Connect Media Server" button linking to a non-existent page (404). Now correctly directs to the Media Server settings tab.

---

## v0.40.3-alpha

**Title: Polished Branding & Smarter Sync**

> [!IMPORTANT]
> This release includes a fix for media server connection issues. If you previously encountered a "duplicate key" error when changing servers, this update resolves it.

### New Features

- **New Logo & Favicon**: Updated application branding with a modern, flush logo and optimized favicon.
- **Differential Library Sync**: Changing your Media Server IP/URL (for the same server) no longer wipes your classification history. The system now intelligently matches libraries by external ID.

### Fixes

- **Change Server Error**: Fixed a database constraint violation that prevented changing media servers if separate libraries had the same name (e.g. "Movies").
- **Connect & Save Button**: Clarified UI feedback when saving server configurations.

### Improvements

- **Test Suite**: comprehensive test coverage for backend API and frontend components.

---

## v0.40.2a-alpha

**Title: UI Color Opacity Fix**

### Fixes

- **Tailwind v4 Opacity Issue**: Fixed widespread issue where badges, modals, and overlays appeared as solid "blobs" with invisible text.
  - Migrated 30+ instances of legacy `bg-opacity-{value}` utilities to modern slash syntax (e.g., `bg-green-500/20`).
  - Affected components: Badges, Modal Overlays, Policy Builder, Preset Cards, and Security Settings.
  - Text in badges is now visible, and modal backdrops are correctly transparent.

---

## v0.40.2-alpha

**Title: Activity Dashboard Ghost Tasks Fix**

### Fixes

- **Fixed Ghost Tasks in Activity Dashboard**: Resolved critical issue where 793 ghost tasks (empty progress bars) appeared in the Activity page.
  - **Root Cause**: Express route ordering bug - the `/api/classification/progress` endpoint was registered AFTER the `*` catch-all, causing API to return HTML instead of JSON.
  - The frontend iterated over the 794-character HTML string as an array, creating empty task items.
- **Source Library Filtering**: Added SQL and WebSocket filters to hide `source_library` sync tasks from the Activity dashboard.
- **Socket.IO Path Fix**: Fixed socket.io path mismatch (client used default `/socket.io`, server used `/ws`).
- **Dockerfile Build Fix**: Changed pgvector installation from `git clone` to `curl` download to resolve network issues.

### Improvements

- **Event Name Alignment**: Fixed event listener names to match server events (`classification:progress` instead of `task:progress`).
- **Activity Room Subscription**: Added proper subscription to `activity` WebSocket room on connect.
- **Client-Side Validation**: Added rejection of ghost tasks (empty titles) and source_library tasks in the frontend.

---

## v0.40.1a-alpha

**Title: CI/CD Build Fixes**

### Fixes

- **TailwindCSS v4 Compatibility**: Added `@reference` directive to `Sidebar.vue` scoped styles to fix build failures with TailwindCSS v4.
  - Scoped styles using `@apply` now correctly reference the theme CSS file.
- **Password Visibility Toggle**: Fixed JavaScript syntax error in `PasswordInput.vue` where `visible = visible!` was invalid (corrected to `visible = !visible`).

---

## v0.40.1-alpha

**Title: SWR Persistence & Modernization**

> [!IMPORTANT]
> This release includes a major upgrade to **Tailwind CSS v4**. Please ensure your browser cache is cleared if you experience UI issues.

### New Features

- **SWR (Stale-While-Revalidate) Caching for Dashboard and Statistics**:
  - New `useSWR` composable for instant data display from localStorage cache while fetching fresh data in background
  - Dashboard now shows cached data immediately on page load with "â³ Updating..." indicator during refresh
  - Classification Stats page integrated with SWR for instant statistics display
  - RAG Stats page integrated with SWR while maintaining 5-second polling for real-time updates
  - Offline support: Displays cached data with "ðŸ“¡ Offline" indicator when network unavailable
  - Cross-tab synchronization: Data updates in one tab automatically reflect in others
  - Auto-retry with exponential backoff (1s â†’ 3s â†’ 10s) for failed requests
  - Separate cache management for queue stats (30s TTL with 5s polling) vs main dashboard data (60s TTL)
  - New `CACHE_KEYS` and `CACHE_TTL` constants for centralized cache configuration
  - Comprehensive test suite with 29 unit tests for the SWR composable
- **Circuit Breaker**: Added strict offline handling for Ollama embeddings to prevent log spam.
- **Tailwind CSS v4**: Migrated client to Tailwind CSS v4 for better performance and modern features.

### Improvements

- **Performance**: Significant frontend performance boost from Tailwind v4.
- **Dependencies**: Updated Core Stack (Vue 3.5, Pinia 3.0, Jest 30, pg 8.17).
- **UI**: Cleaner Dashboard without manual refresh button.
- **Backfill**: Idle backfill now pauses intelligently when provider is offline.

### Fixes

- Fixed integration tests for Dashboard component.
- Fixed `localStorage` environment issues in tests.

---

## v0.40.0-alpha

**Title: Queue Service Refactor, Health Checks, API Keys & UI Enhancements**

### Improvements

- **Queue Service Refactor**: Transitioned QueueService from singleton to factory pattern with Dependency Injection to improve test stability.
- **Cleanup**: Removed deprecated test files.

### Fixes

- **CARSA Headers**: Fixed header handling in CARSA middleware.
- **Service Stability**: Reverted unstable changes in classification service.

---

### ðŸ¥ Health Check Endpoints for Kubernetes/Docker (#183)

**Comprehensive monitoring and health check endpoints for container orchestration**

#### New Endpoints

1. **`/api/system/health/live` - Liveness Probe**
   - Fast response (<10ms)
   - Returns 200 if application is running
   - Does NOT check external services
   - Perfect for Kubernetes liveness checks
   - No authentication required

2. **`/api/system/health/ready` - Readiness Probe**
   - Checks critical services (database only)
   - Returns 200 if ready to serve traffic
   - Returns 503 if not ready
   - Perfect for Kubernetes readiness checks
   - No authentication required

3. **`/api/system/health` - Enhanced Health Status**
   - Overall system health (healthy/unhealthy)
   - Application version
   - System uptime (human-readable format)
   - Database connectivity status
   - Requires authentication

4. **`/api/system/health/services` - Detailed Service Health**
   - Complete breakdown of all services:
     - PostgreSQL database
     - Media server (Plex/Emby/Jellyfin)
     - All Radarr instances
     - All Sonarr instances
     - AI provider (Ollama/OpenAI/etc.)
     - Queue worker status
   - Each service includes:
     - Status: `healthy`, `degraded`, `unhealthy`
     - Response latency (ms)
     - Last check timestamp
     - Error message (if unhealthy)
   - Overall system status with summary counts
   - Requires authentication

#### Features

- **Smart Caching**: Service health checks cached for 30 seconds to reduce load
- **Queue Worker Monitoring**: Monitors task queue for stuck/stale jobs
- **Graceful Degradation**: App stays up even if external services are down
- **Comprehensive Testing**: 12 unit tests ensuring reliability

#### Docker/Kubernetes Integration

**Docker Compose:**

```yaml
services:
  classifarr:
    healthcheck:
      test:
        ["CMD", "curl", "-f", "http://localhost:21324/api/system/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Kubernetes Deployment:**

```yaml
livenessProbe:
  httpGet:
    path: /api/system/health/live
    port: 21324
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/system/health/ready
    port: 21324
  initialDelaySeconds: 5
  periodSeconds: 5
```

#### Response Examples

**GET /api/system/health**

```json
{
  "status": "healthy",
  "version": "0.39.7b",
  "uptime": "3d 14h",
  "database": "connected",
  "timestamp": "2026-01-17T15:30:00.000Z"
}
```

**GET /api/system/health/services**

```json
{
  "overall": "healthy",
  "services": [
    {
      "name": "PostgreSQL",
      "status": "healthy",
      "latency": 5,
      "timestamp": "2026-01-17T15:30:00.000Z"
    },
    {
      "name": "Plex",
      "status": "healthy",
      "latency": 45,
      "timestamp": "2026-01-17T15:30:00.000Z"
    }
  ],
  "summary": {
    "total": 7,
    "healthy": 7,
    "unhealthy": 0
  },
  "timestamp": "2026-01-17T15:30:00.000Z"
}
```

---

### ðŸ” API Key Management System (#182)

**Secure third-party integrations and automation with API keys**

#### New Features

- **Create API Keys**: Generate secure API keys with custom names and permission levels
  - `read_write`: Full access to all endpoints
  - `read_only`: Restricted to GET endpoints only
- **Security Settings Page**: New Settings â†’ Security page for managing API keys
- **Dual Authentication**: All API routes now support both JWT tokens (web UI) and API keys (integrations)
- **Encrypted Storage**: Keys stored using AES-256-GCM encryption (can be retrieved by authenticated users)
- **Key Retrieval**: View full API keys again when logged in (unlike passwords, keys can be revealed)
- **Usage Tracking**: Monitor last used timestamp and IP address for each key
- **Active/Inactive Toggle**: Temporarily disable keys without revoking them
- **Auto-Generated Default Key**: First startup creates a default read-write API key (shown in logs)

#### Security Features

- Keys use `clf_` prefix with 32-character base64url-encoded suffix
- Encrypted storage allows secure retrieval (not one-way hashed like passwords)
- Permission enforcement middleware protects write operations
- Rate limiting on key management endpoints
- Activity tracking with IP address logging

#### UI Features

- Create, view, and revoke keys through Settings â†’ Security
- Copy keys to clipboard with one click
- Reveal full keys using eye icon (keys are encrypted, not hashed)
- Inline name editing (double-click)
- Active/inactive status toggle
- Last used timestamp and IP display

#### Usage Example

```bash
# Create a read-only key in Settings â†’ Security

# Use it for monitoring
curl -X GET http://localhost:21324/api/libraries \
  -H "X-API-Key: clf_your_key_here"

# Create a read-write key for automation

# Use it for triggering syncs
curl -X POST http://localhost:21324/api/libraries/1/sync \
  -H "X-API-Key: clf_your_key_here" \
  -H "Content-Type: application/json"
```

#### Protected Routes

- **Libraries**: GET (read-only), POST/PUT/DELETE (read-write)
- **Queue**: GET (read-only), POST/DELETE (read-write)
- **Stats**: GET (read-only)
- **Media Sync**: GET (read-only), POST (read-write)

---

### ðŸ“Š Enhanced UI for Sync Status and CARSA Warnings

**Title: Enhanced UI for Sync Status and CARSA Warnings**

### What's New

- **Real-time Sync Progress**: The Libraries page now shows live sync status and progress
  - See which library is currently being synced
  - Visual progress bar shows completion percentage
  - "Sync Libraries" button is disabled during active syncs to prevent conflicts
  - Button displays current sync status (e.g., "Syncing... 45%")

- **Improved CARSA Warning Dialog**: Replaced basic confirmation with a comprehensive dialog that explains:
  - Exactly what will be deleted (classification history, embeddings, library data)
  - What will be preserved (policies, AI settings, Discord config, ARR connections)
  - What will be auto-restored (Radarr/Sonarr library mappings)
  - Note about RAG embedding rebuild

- **Post-CARSA Notifications**: New warning banner appears if library mappings couldn't be restored
  - Shows prominently on Libraries and Settings pages
  - Quick links to configure Radarr and Sonarr settings
  - Can be dismissed once reviewed

### How It Helps

- **Better Visibility**: No more wondering if sync is running or stuck - see real-time progress
- **Informed Decisions**: Clear warning before CARSA helps prevent accidental data loss
- **Faster Recovery**: If mappings fail to restore, you'll know immediately with guidance on what to check

### For Users

After updating:

1. Navigate to Libraries page - you'll see the new sync status display
2. Try running "Sync Libraries" - watch the progress bar update in real-time
3. Go to Settings â†’ Queue â†’ Advanced Operations
4. Click "Clear & Re-sync All" to see the new comprehensive warning dialog
5. If any library mappings can't be restored after CARSA, you'll see a warning banner with quick links to fix them

---

## Previous Release

**Title: Smart Preservation of Radarr/Sonarr Library Mappings During CARSA**

### What's Fixed

- **Broken library mappings after CARSA** (Issue #177): Radarr and Sonarr library mappings are now automatically preserved and restored after running "Clear and Re-sync All"
- **Manual reconfiguration eliminated**: No more need to manually remap libraries to Radarr/Sonarr instances after CARSA

### What's New

- **Intelligent Mapping Restoration**: System automatically remaps libraries using:
  - **Priority 1**: Media server library ID (most reliable - works even if library renamed)
  - **Priority 2**: Library name + media type (fallback if server ID changes)
- **Multi-Instance Support**: Works with multiple Radarr and Sonarr instances (e.g., Radarr 4K, Radarr 1080p)
- **User Notifications**: If any mappings can't be restored automatically, you'll see a notification with details
- **Quality Profile Preservation**: Quality profiles and root folder paths remain intact

### How It Works

When you run Clear and Resync:

1. ðŸ” **Snapshot**: System captures all library info BEFORE clearing (including media server IDs)
2. ðŸ—‘ï¸ **Clear**: All data is deleted as usual
3. ðŸ”„ **Re-sync**: Fresh libraries are synced from your media server with NEW IDs
4. ðŸ”— **Remap**: System matches old libraries to new ones and updates all mappings
5. âœ… **Notify**: You're notified of successful remaps and any that failed

**Example**: Your "Movies 4K" library had ID 100, mapped to Radarr instance 1. After CARSA, it gets NEW ID 200, but your Radarr mapping is automatically updated to point to 200 instead of 100. No manual work needed!

### For Users

After updating:

1. Run Clear and Resync as usual
2. Your Radarr/Sonarr library mappings will be preserved automatically
3. If any mappings couldn't be restored, you'll see a notification explaining why
4. Check Settings â†’ Radarr/Sonarr to verify mappings (should match what you had before)

**Note**: This only works for mappings in the `library_arr_mappings` table. If you have custom settings elsewhere, they may need manual verification.

---

## Previous Release

**Title: Fix CARSA to Use Fresh Library Sync (Prevents Stale ID References)**

### What's Fixed

- **"Library not found" errors after CARSA**: Fixed the system attempting to sync using OLD library IDs that were just deleted
- **Clear and Resync (CARSA)** now properly deletes ALL tables with references to media server/library/classification data
- **Stale library references**: The system now performs a **fresh sync from the media server** instead of querying deleted library IDs
- Fixed orphaned embeddings and collections that were not being cleaned up

### What's New

- **Fresh Sync Method**: Added `syncAllLibraries()` which creates NEW library entries from the media server (not reusing old IDs)
- **Cache Clearing**: In-memory caches are now cleared before re-sync for a truly fresh start
- **Complete Reset**: System now behaves as if freshly installed after CARSA

### How It Works Now

After running Clear and Resync:

1. All library data is deleted (including the libraries themselves)
2. In-memory caches are cleared
3. **NEW** libraries are created by fetching from your media server (Plex/Emby/Jellyfin)
4. Library content is synced using the **NEW** library IDs
5. Gap analysis runs using fresh data

**Example**: If your old libraries had IDs 100, 101, 102, after CARSA they'll have completely NEW IDs like 200, 201, 202. No stale references anywhere!

### What Changed

The Clear and Resync function now deletes these additional tables:

- **Classification Embeddings**: Previously orphaned embeddings are now properly deleted
- **Library Profiles**: Auto-generated library statistics are now cleared
- **Collections**: Media server collections are now cleared
- **Libraries**: The libraries table itself is now cleared (previously skipped)

All deletions now happen in dependency-safe order to prevent foreign key constraint violations.

### For Users

If you experienced "Library not found" errors or orphaned data after running Clear and Resync, this update resolves those issues. After updating, run Clear and Resync again for a complete fresh start. The system will create brand new library entries from your media server.

---

## v0.39.7b-alpha

**Title: Remove Non-Working Preload Logic**

### Removed

- **preloadModel()**: Removed from `ollama.js` - the `/api/load` endpoint doesn't exist in Ollama's API
- **Model preloading logic**: Removed from `idleBackfillService.js`

### Note for Users

For optimal performance with multiple models (e.g., classification + embedding), configure your Ollama environment:

- `OLLAMA_KEEP_ALIVE=-1` - Keeps models loaded indefinitely
- `OLLAMA_MAX_LOADED_MODELS=2` - Allows both models to stay loaded simultaneously

---

## v0.39.7a-alpha

**Title: Logger Import Hotfix**

### Fixes

- **PROFILE_SCORE Weight**: Fixed profile score calculation in signal-based confidence
- **Fallback Status**: Fixed classification fallback status handling when AI is unavailable
- **Logger Error Handling**: Fixed `logger.error is not a function` error in IdleBackfillService
  - Added try-catch around database persistence in `logger.error()` and `logger.warn()`
  - Console and file logging now complete synchronously before async DB persistence

### New Features

- **AI Retry Mechanism**: Classifications that fail due to AI unavailability are now queued for automatic retry
  - New `pending_retry` status and `queued_for_retry` method
  - Migration 065: Added `retry_after`, `retry_count`, `max_retries` columns
  - Retry queue processed every 5 minutes

### Removed

- **Smart Suggestions from Discord**: Removed deprecated `sendSmartSuggestionNotification()` from Discord bot
  - Discord no longer links to deprecated rule-builder
  - All classification flows now use PolicyEngine

### Added

- **Logger Tests**: 15 new tests for logger resilience when database fails
- **IdleBackfillService Tests**: 11 new tests for model preloading, configuration, and lifecycle
- Total test count increased from 577 to 603

---

## v0.39.6-alpha

**Title: Intelligent Model Swapping & RAG Optimization**

### New Features

- **Intelligent Model Swapping**: Reduces overhead when sharing a GPU between classification and embedding tasks by preventing unnecessary model reloads.
- **Smart Preloading**: Idle backfill now proactively loads the embedding model into VRAM before starting batch processing.
- **Model Affinity Tracking**: The system now tracks which model is currently active, optimizing lock acquisition strategies.

### Improvements

- Added `keep_alive` support to Ollama embedding requests for better batch performance.
- Increased default provider lock wait time from 60s to 120s to prevent timeouts during heavy load.
- Improved classification preemption logic to interrupt embedding tasks more reliably.

### Fixes

- Fixed an issue where classification requests could timeout waiting for long-running embedding operations.

---

## v0.39.5b-alpha

**Hotfix: RAG Pending Count & Migration Fix**

### Bug Fixes

- **RAG Overview Pending Count**: Overview "Pending" now correctly shows items without embeddings (was always showing 0)
  - `getStats()` now queries actual items needing embeddings instead of retry queue
  - Matches the count shown in Manual Backfill
- **Database Migration 064**: Fixed schema error in `064_backfill_library_associations.sql`
  - Removed invalid `updated_at = NOW()` reference (column doesn't exist in classification_history)
  - All integration tests now passing (309/309)

### Added

- **Database Resilience Tests**: New `database-resilience.test.js` to prevent regression of Exit 255 crash bug
  - Verifies `process.exit` is not in database config
  - Tests pool error handler gracefully handles ECONNRESET and connection terminated errors

---

## v0.39.5a-alpha

**Hotfix: Database Connection Crash**

### Critical Bug Fix

- **Container Crash on Database Errors**: Removed `process.exit(-1)` from database pool error handler
  - Transient database connection errors were killing the entire application (Exit 255)
  - Now logs errors and allows connection pool to recover naturally
  - Fixes container crashes on Unraid and other Docker deployments

---

## v0.39.5-alpha

**Critical Bug Fixes - Sync Reconciliation & RAG Embedding Issues**

### Critical Bug Fixes

#### CRITICAL: Sync Reconciliation Database Error ðŸ”¥

- **Previous Bug**: Sync reconciliation failing with `column "updated_at" of relation "classification_history" does not exist`
- **Error ID**: `026eef91-2e2c-45f4-9316-bd5dc15f1185`
- **Root Cause**: PR #164 added `updated_at = NOW()` to UPDATE queries for tables that don't have this column
- **Fix**:
  - Removed `updated_at = NOW()` from classification_history UPDATE query
  - Removed `updated_at = NOW()` from learned_corrections UPDATE query
- **Impact**: Library syncs now complete successfully without database errors

#### RAG Pending Count Inconsistency ðŸ“Š

- **Previous Bug**: Different pending counts shown in Overview (0) vs Backfill tab (4489)
- **Root Cause**: Inconsistent query patterns and library_id filtering
- **Fix**:
  - Standardized all pending count queries to use NOT EXISTS pattern
  - Removed `library_id IS NOT NULL` filter to count ALL items without embeddings
  - Updated overview, manual backfill, idle backfill, and scheduled backfill services
- **Impact**: Consistent pending counts across all RAG tabs

#### Backfill Progress Display Issues ðŸ“ˆ

- **Previous Bug**: Progress showing impossible values (1200/1160) and negative ETA (-1s)
- **Root Cause**:
  - Total set once at start, never updated when new items added during backfill
  - No handling for edge cases where processed > total
- **Fix**:
  - Made getStatus() async to dynamically query current pending count
  - Total now calculated as `max(initialTotal, processed + currentPending)`
  - Progress clamped to never exceed 100%
  - ETA uses Math.max(0, ...) to prevent negative values
- **Impact**: Accurate progress display even when items added during backfill

#### Idle Backfill Not Processing Items â¸ï¸

- **Previous Bug**: Idle backfill creating runs with total=0 and processing nothing
- **Root Cause**: Idle backfill didn't calculate or set total when creating backfill_runs record
- **Fix**:
  - Added getPendingCount() method to idle backfill service
  - Idle backfill now sets total when creating backfill_runs record
- **Impact**: Idle backfill now correctly processes pending items

### Files Changed

- `server/src/services/mediaSync.js` - Removed invalid updated_at references
- `server/src/routes/rag.js` - Standardized pending count queries, made getStatus calls async
- `server/src/services/manualBackfillService.js` - Dynamic total calculation, async getStatus
- `server/src/services/idleBackfillService.js` - Added getPendingCount, set total on start
- `server/src/services/scheduledBackfillService.js` - Standardized pending count query

## v0.39.4-alpha

**Comprehensive Bug Fix & Stability Release**

### Critical Bug Fixes

#### Integration Test Stability ðŸ§ª

- **Previous Bug**: Integration tests failing due to missing `pgvector` extension and database mocking conflicts
- **Fix**: Upgraded test container to `pgvector/pgvector:pg15` and refactored `rag-api` tests
- **Impact**: Ensures reliable verified builds and prevents regression

#### Wrong AI Model Selection ðŸ¤–

- **Previous Bug**: Classification always used hardcoded `qwen3:14b` model instead of configured model
- **Root Cause**: Code read from deprecated `ollama_config` table instead of `ai_provider_config.ollama_model`
- **Fix**: Updated classification service to read from correct config table
- **Impact**: Classifications now use your configured model (e.g., `gemma3:12b`)
- **Fallback**: Defaults to `llama3.2` when no model configured (instead of `qwen3:14b`)

#### Library Profile Generation Failure ðŸ“Š

- **Previous Bug**: Profile regeneration failed with `function jsonb_typeof(text[]) does not exist` error
- **Root Cause**: Code used JSONB functions on TEXT[] array columns
- **Fix**: Changed to use `unnest()` for PostgreSQL TEXT[] arrays
- **Impact**:
  - Profile regeneration now works correctly
  - Genre distribution statistics display properly
  - Movies no longer misclassified due to broken profile scoring
  - All items no longer stuck at 55% confidence

#### RAG Performance Optimization âš¡

- **Previous Behavior**: RAG semantic search ran 10-12+ times per classification (once per library)
- **Fix**: Added caching to call RAG once per classification and reuse results
- **Impact**:
  - 10-12x performance improvement for classifications
  - Reduced load on embedding provider
  - Faster classification response times

#### Dashboard Awaiting Decision Display ðŸ“‹

- **Previous Bug**: "Awaiting Decision" count showed 0 even when items were pending
- **Root Cause**: Incorrect API response parsing (missing `.data` property)
- **Fix**: Corrected to access `pendingRes.data.count`
- **Impact**: Dashboard now shows accurate count of items needing user input

#### Dashboard Library Name Display ðŸ·ï¸

- **Previous Bug**: Items awaiting decision showed "â†’ " with no library name
- **Root Cause**: `library_name` is NULL for awaiting items (by design), but UI didn't handle this
- **Fix**: Show "â³ Awaiting Decision" for items with `status='awaiting_decision'`
- **Impact**: UI now clearly indicates which items need decisions

#### Plex Sync Reconciliation ðŸ”„

- **Previous Bug**: Manually moving files to correct Plex library didn't update classification history
- **Behavior**:
  - User moves file to correct library in Plex
  - Plex scans and shows item in new library
  - Classifarr syncs and updates `media_server_items.library_id`
  - BUT classification history still shows `status='awaiting_decision'`
- **Fix**: Added reconciliation logic after sync completes:
  - Finds items that were awaiting decision but now exist in a Plex library
  - Updates classification history to `status='completed'`
  - Creates learned corrections for future classifications
- **Impact**:
  - Manual Plex library placements now automatically resolve classification questions
  - Future classifications of same content use learned preference
  - No more manual cleanup of classification history needed

### Testing

- Added comprehensive unit test suite covering all bug fixes
- All tests passing with 100% coverage of fixed code paths

### Files Changed

- `server/src/services/classification.js` - AI model selection fix
- `server/src/services/libraryProfileService.js` - Genre distribution fix
- `server/src/services/policyEngine.js` - RAG caching optimization
- `server/src/services/mediaSync.js` - Plex sync reconciliation
- `client/src/views/Dashboard.vue` - Dashboard display fixes
- `server/src/__tests__/bug-fixes.test.js` - Comprehensive test suite

### Verified Already Fixed

- **Discord Bot Initialization**: Configuration save correctly sets `enabled=true`
- **Rating Normalization**: Database UPDATE correctly applied after normalization

---

## v0.39.3

**Fix: Data Consistency, RAG UI Display & Post-Upgrade System**

### Critical Bug Fixes

#### library_name Data Consistency ðŸ”§

- **Previous Bug**: When classifications were corrected via Discord or reclassification service, the `library_name` column was not updated, leaving it NULL or stale
- **Impact**: Embeddings were missing library context, making RAG similarity searches less accurate
- **Fix**: Updated all 3 correction locations to set both `library_id` AND `library_name`:
  - Classification corrections API endpoint
  - Discord bot correction handler
  - Reclassification service
- **Data Backfill**: Migration automatically populates missing `library_name` values for existing data
- **Result**: RAG embeddings now include complete library context for better classification accuracy

#### RAG Overview Statistics Display ðŸ“Š

- **Previous Bug**: Total Embeddings and Pending counts showed "0" even when embeddings existed in database
- **Root Cause**: Field name mismatch between backend (`total`, `pendingRetries`) and frontend (`totalEmbeddings`, `pendingCount`)
- **Fix**: Backend now returns both field names for backward compatibility
- **Impact**: RAG Overview tab now displays accurate embedding counts

### New Features

#### Post-Upgrade Task System âœ¨

- **What**: Reusable system for version-specific one-time maintenance operations
- **Why**: Eliminates need for new migrations for each release's maintenance tasks
- **How It Works**:
  - Tasks defined in configuration (not database migrations)
  - Tracks executed tasks in `post_upgrade_tasks` table
  - Runs automatically on server startup after migrations
  - Tasks are idempotent (safe to run multiple times)
- **Available Task Types**:
  - `clear_logs` - Fresh log start for new version
  - `clear_embedding_queue` - Clear retry queue
  - `rebuild_embeddings` - Mark all embeddings as stale
  - `backfill_library_name` - Populate missing library names
  - `clear_stale_retry_queue` - Remove orphaned retry queue entries
- **Future Versions**: Just add tasks to config, no new migrations needed

#### Stale Retry Queue Cleanup ðŸ§¹

- **Previous Bug**: "Pending" count in RAG Overview showed incorrect number (e.g., 6,740 instead of 0) even when all embeddings existed
- **Root Cause**: Retry queue entries were never removed when embeddings succeeded, accumulating orphaned entries
- **Fix**:
  - Added `clear_stale_retry_queue` post-upgrade task to remove orphaned entries on upgrade
  - Added cleanup in `storeEmbedding()` to remove retry queue entry when embedding succeeds
- **Impact**: RAG Overview "Pending" count now accurately reflects actual pending items

#### Settings Page Responsive Layout ðŸ“±

- **Previous Bug**: Settings sidebar scroll was cut off, and mobile users couldn't access the right side content
- **Fix**:
  - Desktop: Sidebar now has independent scroll with proper sticky positioning
  - Mobile: Settings tabs display as horizontal scrollable chips above content
  - Main content area now has `overflow-x-auto` for wide content
- **Impact**: Settings page is now fully accessible on all screen sizes

### Previously Fixed in 0.39.3-alpha

#### Provider Status Now Accurate ðŸ“Š

- **Previous Bug**: Provider Status card always showed "Offline" even when provider was online
- **Fix**: Corrected variable reference (`stats.providerOnline` instead of `providerOnline`) and added `providerOnline` field to API response
- **Impact**: You can now accurately see your embedding provider status

#### Test Connection Shows Dimensions ðŸ”¢

- **Previous Bug**: Test connection showed "undefined dimensions" on success
- **Fix**: Test connection now actually generates a test embedding to get real dimensions
- **Impact**: You can verify your embedding model is working and see its dimension count (e.g., 768, 1024, 1536)

#### Page Data Loading Fixed ðŸ”„

- **Previous Bug**: RAG Overview page never loaded data (showed defaults)
- **Fix**: Fixed function call in component mount hook (`loadStats()` instead of `loadOverview()`)
- **Impact**: Page now properly loads your configuration and statistics on load

#### Model Change Clears Embeddings âš ï¸

- **New Behavior**: Changing embedding models now automatically clears existing embeddings
- **Why**: Different models have different vector dimensions (768 vs 1024 vs 1536)
- **Impact**: Prevents database errors and ensures RAG continues working correctly after model changes
- **Note**: You'll see a warning in logs when embeddings are cleared

#### Configuration Errors Don't Trip Circuit Breaker ðŸ”§

- **Previous Bug**: Missing API keys or misconfigured providers would trip the circuit breaker, showing "Circuit breaker open"
- **Fix**: Configuration errors are now distinguished from transient network errors
- **Impact**: Circuit breaker only trips for actual network/server failures, not configuration issues
- **Better Error Messages**: Clear guidance on what needs to be configured for each provider mode:
  - "Same as Classification" â†’ requires AI provider configured
  - "Separate Ollama" â†’ requires Ollama host configured
  - "Cloud" â†’ requires cloud provider and API key configured

---

---

> [!NOTE]
> Older release notes have been moved to [RELEASE_NOTES_backup.md](RELEASE_NOTES_backup.md) to keep this file concise.

