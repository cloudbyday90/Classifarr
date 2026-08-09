# Classifarr Release Notes

> Versioning note: these release notes and the UI use public labels such as `v0.48.0-beta`. Package files use semver-safe versions such as `0.48.0-beta`.

## v0.48.0a-beta
**Title: Policy decisions stay clear when library history is incomplete**

> [!IMPORTANT]
> After updating from an earlier `v0.48.0-beta` build, retry any existing
> Needs Attention item that says evidence is missing. The original audit entry
> stays intact; retrying creates the corrected policy explanation.

### 🎉 What You'll Notice
- **Declared policies keep their authority** — an incomplete library history no longer erases a valid policy match or sends the item through an unrelated AI fallback.
- **Clearer review evidence** — review cards retain the policy reason for a recommended destination while still showing when historical observations differ.
- **Library renames stay safe** — changing a destination label cannot change policy matching or the stable order of equally scored candidates.

### 📊 Quick Visual
```text
v0.48.0a-beta Snapshot
Declared policy authority [██████████] remains authoritative
Observed profile history  [████████░░] advisory, explained to reviewers
Library rename safety     [██████████] labels do not affect routing
Release verification      [██████████] dependency and evidence gates repaired
```

### ✨ Highlights
- **Better policy precedence** — ratings, genres, and keywords observed in a library are useful context, but they are not treated as a user-authored prohibition when a declared policy has an identity match.
- **One predictable decision path** — strict policy limits still prevent invalid routes, while AI remains advisory instead of becoming an accidental fallback for a valid deterministic result.

### 🔧 Reliability Improvements
- Release verification no longer fails on a duplicate diagnostics export, keeping dependency checks and acceptance evidence on the intended path.
- The release guide includes a PowerShell-safe version-contract command for npm 12.

### 👥 Who This Helps
- **Policy authors:** library intent remains stable even when observed collection history is sparse or stale.
- **Reviewers:** pending items explain the recommendation instead of presenting an unexplained missing-evidence state.
- **Operators:** a release candidate cannot be published when its dependency-declaration or acceptance gates are blocked.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.48.0-beta
**Title: Policies you can trust, clearer reviews, and safer AI assistance**

> [!IMPORTANT]
> Back up your database before updating, then allow startup migrations and policy reconciliation to finish. Supported existing policies are brought forward automatically; configurations needing attention are surfaced for maintenance rather than silently reinterpreted.

### 🎉 What You'll Notice
- **Create policies from the library you mean** — policy authoring starts with the selected media-server library and its observed context, then records the purpose, limits, review behavior, and routing target that define it.
- **AI helps without taking control** — verified AI output can add bounded advisory context, but it cannot veto a deterministic policy match or choose a destination by itself.
- **Review cards explain the decision** — Needs Attention shows the leading destination, policy score, confirmation and automatic thresholds, and the policy-backed reasons for a recommendation.
- **One item, one decision** — duplicate pending decisions are safely superseded, retries are idempotent, and confirmations apply only to the decision you review.

### 📊 Quick Visual
```text
v0.48.0-beta Snapshot
Policy authority        [██████████] server-owned, deterministic decisions
AI assistance           [██████████] advisory context, never a route veto
Operator review         [██████████] one active decision with clear reasons
Upgrade safety          [█████████░] native reconciliation and bounded recovery
Release verification    [██████████] immutable image, provenance, consumer smoke
```

### ✨ Highlights
- **Native policy lifecycle** — new and existing policies use a versioned, server-authoritative intent model that preserves routing and review behavior through supported upgrades.
- **Reliable recovery** — provider failures, stale evidence, retries, restarts, and queue maintenance keep bounded operational state and preserve deterministic policy outcomes.
- **Safer self-hosted operations** — the release pipeline verifies an immutable container image, its provenance, and a consumer startup check before release publication.

### 🔧 Reliability Improvements
- Classification history handles large installations more efficiently and returns a retryable response when PostgreSQL reaches its configured statement timeout.
- Current client assets stay cacheable while stale content-hashed asset requests return a clean not-found response instead of an application error.
- PostgreSQL 18, pgvector, fresh-install vector indexes, and task-queue retention received upgrade and recovery coverage.

### 👥 Who This Helps
- **Policy authors:** define what a destination means without tuning provider scores or relying on opaque AI disagreement.
- **Reviewers:** confirm a clearly explained recommendation or choose a safer alternative without duplicate work.
- **Operators:** upgrade with a reconciliation path, bounded maintenance states, and a release record tied to a verifiable container image.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.5c-beta
**Title: RAG health fix, Docker startup hardening, and schema integrity guard**

### 🎉 What You'll Notice
- **RAG is healthy again on fresh installs** — a missing text vector index caused the RAG panel to show "Degraded" after a clean installation; it is now created correctly and the health panel clears on first boot.
- **Container starts up cleaner** — the Docker healthcheck now gives the container 120 seconds to be ready (up from 60), so rebuilds and first-starts no longer show false-unhealthy states during Postgres initialization.
- **Rebuild commands confirm they worked** — `docker:smart:rebuild` now blocks until the container is actually healthy before returning, giving you a real success/failure signal instead of a detach.
- **Sweep test cleanup is one command** — `npm run test:local:ai-policy-sweep:cleanup` removes all DB artifacts from previous sweep runs so you can re-test on a clean slate.

### 📊 Quick Visual
```text
v0.47.5c-beta Snapshot
RAG health (fresh install)   [██████████] text HNSW index always created
Docker healthcheck margin    [██████████] 120s start period (was 60s)
Rebuild confirms healthy     [██████████] --wait blocks until container ready
Schema snapshot guard        [██████████] migration:check validates critical indexes
Sweep cleanup utility        [██████████] one command resets test DB state
Strict animated preset       [██████████] anime keywords excluded as hard conflicts
```

### ✨ Highlights
- **RAG Degraded on Fresh Install — Fixed** — the text HNSW vector index was missing from the schema snapshot used for fast installs, causing the RAG health check to report "Degraded (Missing indexes: text)". The index is now always created on first boot and the schema integrity guard catches similar gaps before they ship.
- **Docker Startup Hardening** — healthcheck `start_period` doubled to 120s and added directly to `docker-compose.yml` so timing is visible and tunable without a rebuild. The rebuild script now waits for healthy instead of silently detaching.

### 🔧 Reliability Improvements
- **Schema Snapshot Integrity Check** — `migration:check` now verifies that the committed schema snapshot contains required vector indexes; fails with an actionable error pointing to the right fix command.
- **Animated-Only Strict Preset Refined** — anime-signaled keywords are now explicitly excluded under strict mode so the preset correctly separates anime from Western animation.

### 👥 Who This Helps
- **Fresh installers** — RAG now works correctly out of the box without manual SQL intervention.
- **Operators running Docker** — cleaner startup, accurate health reporting, and a reliable rebuild command.
- **Developers running local AI sweeps** — sweep test cleanup is now a single npm command.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.5b-beta
**Title: Active classification visibility, local sweep auth, strict animated presets, and build hardening**

### 🎉 What You'll Notice
- **Processing Panel shows live classification progress** — when a classification is active, the Command Center now displays the media title, phase, progress bar, AI model, and a queued-waiting state for pending items.
- **Local AI policy sweep auth is scoped and short-lived** — the new `/api/auth/token/exchange-local-sweep` endpoint issues 60–900s JWTs scoped to `classifarr:local-ai-policy-sweep` with API-prefix restrictions, so sweep scripts never hold admin-level tokens.
- **Strict animated-only preset blocks non-animated items** — the `animated_only_strict` preset enforces hard genre/keyword constraints instead of soft advisory matching, preventing live-action titles from sneaking into anime libraries.
- **Vite 8 / Rolldown build is clean** — the `INVALID_ANNOTATION` warnings from `@vueuse/core` are suppressed during build, so production bundles build without noise.

### 📊 Quick Visual
```text
v0.47.5b-beta Snapshot
Processing Panel          [██████████] live classification progress & queue
Sweep auth scoping        [██████████] short-lived scoped JWTs for local scripts
Strict animated preset    [██████████] hard-block non-animated content
RAG busy degradation      [██████████] provider lock timeouts → graceful empty result
Rolldown build            [██████████] clean build output, no annotation warnings
Dependency freshness      [██████████] @playwright/test 1.61.0, knip 6.17.1
Test suite                [██████████] 13,125 server + 2,442 client tests passing
```

### ✨ Highlights
- **ProcessingPanel Active Classification UI** — real-time title, phase, progress, queue depth, AI telemetry, and up-next queue, with an idle "No active processing" state when no items are running.
- **Scoped Sweep Token Exchange** — admin API key → short-lived JWT with `classifarr:local-ai-policy-sweep` audience and `/api/classify/` prefix restriction, per RFC 8725/7519/6750 BCP.
- **Local AI Policy Sweep Harness** — submit real classification requests across models, validate response contracts, verify queue lifecycle, and persist results; paired with a cleanup utility.

### 🔧 Reliability Improvements
- Semantic search provider lock timeouts return an empty result set at INFO level instead of propagating as hard errors.
- Vite `onwarn` suppresses Rolldown `INVALID_ANNOTATION` from `@vueuse/core` — purely cosmetic; tree-shaking still works.
- Dependabot bumps applied: `@playwright/test` 1.61.0, `knip` 6.17.1.

### 👥 Who This Helps
- **Operators running local sweep scripts:** scoped JWTs limit blast radius; no admin tokens in CI or cron jobs.
- **Self-hosters with animated-only libraries:** strict preset prevents soft-advisory misclassification of non-animated content.
- **Developers:** clean build output; Rolldown annotation noise is gone.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.5a-beta
**Title: Resilient connections, smarter retry handling, and reasoning model fixes**

> [!IMPORTANT]
> This release includes a one-time post-upgrade log clear. Unresolved error_log rows and all app_log rows are cleaned at startup; resolved (operator-reviewed) error entries are preserved.

### 🎉 What You'll Notice
- **Classifications no longer stall on qwen3 reasoning models** — thinking models like `qwen3.5:4b` now bypass the constrained-JSON grammar that caused generation stalls and timeouts, using free-form generation instead with the existing strip-and-parse pipeline.
- **Transient database connection timeouts no longer crash startup** — brief Postgres unavailability during early reads (JWT secret, config lookups) is now handled with bounded exponential-backoff retry on the connection step, preserving exactly-once query semantics.
- **Stuck retry items are dead-lettered automatically** — classifications that exhaust their automatic retry budget move to a terminal `failed` state instead of looping forever. They stay visible in History and are recoverable via manual retry.
- **Retry items now appear in Command Center** — items queued after an AI failure are listed in the Needs Attention panel with their failure reason and a dedicated Retry Classification action.
- **OMDb 401 errors no longer flood the error log** — invalid API keys or exhausted quotas are logged at WARN once per 30 minutes instead of ERROR with a stack trace on every cycle.
- **Plex sync no longer hangs for 30 seconds on unreachable servers** — library fetch now has a 10-second timeout matching the existing items endpoint.

### 📊 Quick Visual
```text
v0.47.5a-beta Snapshot
DB startup resilience    [██████████] bounded retry on transient timeouts
Retry dead-lettering     [██████████] exhausted items reach terminal state
Command Center retries   [██████████] queued items visible with retry action
Reasoning model support  [█████████░] qwen3 family bypasses rigid grammar
OMDb 401 log noise       [██████████] WARN + deduplicated (30-min window)
Dependency security      [██████████] ws 8.21, js-yaml 4.2, form-data 4.0.6
```

### ✨ Highlights
- **Reasoning model stall budgets** — thinking models now get larger streaming timeouts (240s first-token, 90s heartbeat, 600s hard cap) and bypass the JSON grammar that conflicts with internal reasoning tokens.
- **Manual retry resets the budget** — operator-initiated "Retry Classification" resets `retry_count` to 0 so items get a fresh automatic-retry cycle, mirroring the DLQ operator-resubmit pattern.

### 🔧 Reliability Improvements
- Connection-acquisition retry uses unref'd timers so a pending retry never holds the process or test teardown open.
- `healthCheck()` deliberately keeps failing fast without retry to report true connectivity.
- "No Library Configured" label on retry items corrected to reflect a missing selected library, not a configuration problem.
- Security dependencies updated: ws 8.20.1 → 8.21.0 (memory exhaustion DoS fix), js-yaml 4.1.1 → 4.2.0 (quadratic DoS fix), form-data 4.0.5 → 4.0.6 (CRLF injection fix).
- Domain-validation regex lint hardening for eslint-plugin-security 4.0.1.

### 👥 Who This Helps
- **Self-hosters with intermittent Postgres:** startup no longer fails on brief connection timeouts; retries are silent and bounded.
- **Operators using AI models:** qwen3 reasoning models work without stalls; stuck retries are self-healing or visible in Command Center.
- **Operators monitoring logs:** OMDb auth failures are a single deduplicated WARN line instead of a stack-trace flood.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.5-beta
**Title: Smarter routing, rating normalization fixes, and a web search provider foundation**

### 🎉 What You'll Notice
- **Auto-routing works with modern library mappings** — high-confidence and policy-auto classifications now correctly route to the right Radarr/Sonarr library even when it uses modern `library_arr_mappings` instead of legacy `arr_type` fields.
- **Skipped routes are visible** — when a classification skips routing, you'll now see diagnostics explaining why, so you can spot configuration gaps.
- **Rating normalization is accurate** — fixed double-counting in "Needs Normalization" and "Already Normalized" categories, and ratings from OMDb/TMDB metadata are now normalized during prioritization.
- **No more sync-normalization ping-pong** — rating syncs from media servers only update local ratings when values actually change, preventing endless re-normalization loops.
- **Deleted libraries don't break history** — when a library is deleted, classification history rows are cleanly marked instead of causing sync failures.
- **Missing AI models fail gracefully** — when an Ollama model isn't found (404), it's treated as a provider availability issue instead of a hard classification error.

### 📊 Quick Visual
```text
v0.47.5-beta Snapshot
Routing reliability     [██████████] auto-route works with modern library mappings
Rating normalization    [██████████] accurate counts + no more sync loops
Library sync resilience [██████████] deleted libraries handled cleanly
AI error handling       [█████████░] missing models fail gracefully
Web search framework    [███████░░░] foundation laid for multi-provider search
```

### ✨ Highlights
- **Web Search Provider Framework** — introduced a provider-neutral architecture for web search evidence (Tavily, Brave, Serper) with contract validation, error taxonomy, normalized response shapes, and dedicated config/usage storage. This is the foundation for future multi-provider web search support.
- **TMDB ID mismatch repair** — added a migration to detect and repair mismatched TMDB IDs that could cause duplicate or mislinked classification history entries.

### 🔧 Reliability Improvements
- Hardened auto-route classification to invoke the routing resolver for mapped libraries.
- Added route-decision diagnostics for skipped or attempted routing.
- Made "Needs Normalization" and "Already Normalized" count queries mutually exclusive.
- Added post-upgrade database cleanup to reset stale rating normalizations.
- Conditionalized rating sync database updates on actual value changes to prevent re-normalization loops.
- Preserved HTTP status metadata from Ollama failures and classified model-not-found as availability failures.
- Reconciled provider-neutral web-search seed data so fresh and upgraded installs receive Tavily, Brave, and Serper provider rows.

### 👥 Who This Helps
- **End users:** classifications route correctly to mapped libraries; rating normalization stats are trustworthy; deleted libraries don't cause errors.
- **Operators/admins:** clearer routing diagnostics, graceful AI provider failure handling, and a forward-compatible web search foundation ready for Brave/Serper adapters.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.4c-beta
**Title: Enrichment sync, media server setup fixes, and password manager friendliness**

### What You'll Notice
- **Enrichment stats update instantly** — when you enqueue, cancel, retry, or dismiss enrichment tasks, the "Basic Enriched" count and related stats reflect the change immediately without a page refresh.
- **Media server setup is smoother** — the "Configure Media Server" CTA now jumps to the right tab, and the "Connect & Save" button works as a universal submit action across setup wizard steps (Plex, Jellyfin, Emby).
- **OMDb metadata fills in automatically** — items that were enriched before OMDb was configured are now re-queued for full metadata profiles when the OMDb provider becomes active, including rating normalization updates.
- **Password managers won't nag you** — API key and secret fields in settings no longer trigger browser/password manager save prompts.

### Quick Visual
```text
v0.47.4c-beta Snapshot
Enrichment sync       [██████████] real-time status updates without refresh
Media server setup    [██████████] correct CTA navigation + universal save
OMDb queue refill     [██████████] auto re-queue on provider activation
Password manager UX   [██████████] no more save prompts on API key fields
Quick start image     [██████████] Docker Compose uses :latest by default
Test suite            [██████████] 800 server + 2,429 client tests passing
```

### Reliability Improvements
- Corrected media server settings tab ID from `media-server` to `mediaserver` for proper navigation.
- Enabled "Connect & Save" button when valid media server config is loaded, including during setup wizard steps.
- Allowed gap analysis queue refill to identify and re-queue items missing OMDb metadata.
- Allowed previously-normalized items to be re-queued when new OMDb or TMDB ratings become available.
- Added info icon to "Basic Enriched" status badge to guide OMDb API key configuration.
- Configured `PasswordInput` component with `autocomplete="off"` and password manager ignore attributes.
- Changed README Docker Compose example to use `:latest` image tag for simpler upgrades.

### Who This Helps
- **End users:** enrichment stats and media server setup work correctly on first run; no more browser password manager prompts on settings pages.
- **Operators/admins:** OMDb metadata backfill and rating normalization happen automatically when providers come online.

### Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.4b-beta
**Title: First-run setup is quiet and reliable on local and LAN installs**

> [!IMPORTANT]
> This is a hotfix for fresh installs. Update the image and restart/recreate the container before creating the first admin account.

### 🎉 What You’ll Notice
- **First admin setup stays on setup** — fresh installs no longer get pushed to `/login?expired=true` while creating the first account.
- **Cleaner browser console** — local and LAN HTTP installs no longer show COOP/OAC warnings for untrustworthy origins.
- **Less network noise** — setup no longer triggers authenticated health checks or refresh-token calls before an account exists.

### 📊 Quick Visual
```text
v0.47.4b-beta Impact
First-run setup         [██████████] no expired-login loop
LAN HTTP console noise  [██████████] COOP/OAC warnings removed
Setup network calls     [██████████] setup status only
Security headers        [█████████░] standard hardening preserved
```

### ✨ Highlights
- Classifarr now pauses background system-health polling on login and setup pages, so unauthenticated first-run screens do not make admin-only API calls.
- Setup-status checks no longer trigger the expired-session redirect path.
- COOP/OAC browser isolation headers are now reserved for deployments that enable HTTPS header enforcement.

### 🔧 Reliability Improvements
- Added regression coverage for setup/login route polling, setup-status redirect suppression, and HTTP-compatible security header behavior.
- Verified the rebuilt container renders `/setup-account` without `/api/system/health`, `/api/auth/refresh`, 401/403/429, canceled asset, or COOP/OAC console noise.

### 👥 Who This Helps
- **New self-hosters:** first-run account setup works cleanly without manual API workarounds.
- **LAN HTTP users:** browser DevTools stays focused on real issues instead of expected local-origin warnings.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.4a-beta
**Title: Safer Docker starts, clearer policy building, and no pgvector startup loops**

> [!IMPORTANT]
> Existing Docker and Unraid users do not need to edit their compose or template settings. Update the image and restart/recreate the container; Classifarr will safely choose the best pgvector path at startup.

### 🎉 What You’ll Notice
- **Docker starts more reliably** — hardened containers no longer restart in a loop when PostgreSQL cannot execute a copied pgvector binary from runtime storage.
- **Existing Unraid setups benefit automatically** — the new image defaults to opportunistic pgvector selection even when older container templates do not include new environment variables.
- **Policy Builder is easier to reason about** — the new intent-first model separates identity, compatibility, strict constraints, boosters, and exclusions from raw preset JSON.

### 📊 Quick Visual
```text
v0.47.4a-beta Impact
Docker startup reliability  [██████████] startup-loop guard
Unraid compatibility        [██████████] no template edit required
pgvector optimization       [█████████░] AVX/AVX2 when safe, generic fallback
Policy builder clarity      [████████░░] intent fields over raw presets
Migration resilience        [██████████] PostgreSQL 18 bigint fix
```

### ✨ Highlights
- Classifarr now stages pgvector with a symlink to the image-layer AVX/AVX2 binary, so `/run/postgresql` can stay `noexec` while supported CPUs still get the optimized path.
- If optimized pgvector staging is not safe, startup falls back to the generic image-layer binary instead of crashing during RAG embedding migration.
- The Policy Builder now has the first pieces of an intent-first editing model, making policy tweaks more intuitive while preserving legacy preset compatibility.

### 🔧 Reliability Improvements
- Fixed a PostgreSQL 18 migration edge case that could fail classification-history BIGINT migration checks.
- Added startup smoke coverage for pgvector staging behavior and hardened Compose defaults.
- Tightened the non-production library rule debug insert endpoint so it requires read-write API permissions.
- Documented the new `PGVECTOR_RUNTIME_STAGING` behavior for Docker, Unraid, and local compose users.

### 👥 Who This Helps
- **Self-hosters and Unraid users:** update the image without emergency compose edits or startup-loop debugging.
- **Operators/admins:** policy configuration becomes easier to explain, audit, and evolve without breaking legacy presets.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.4-beta
**Title: Policy classification hardened — calibration, quality gating, constraint semantics, and streamlined *arr setup**

### What You'll Notice
- **Classifications are more trustworthy** — weak RAG-only and compatibility-only candidates can no longer outrank strong identity evidence through high raw scores alone. Scores are now calibrated before ranking with bounded diagnostics.
- **Policy constraints actually enforce** — strict runtime constraints (genres, keywords, studios, language, media type, certifications, release year, vote average, runtime) now exclude candidates that violate policy intent, not just downrank them.
- **RAG evidence quality is gated** — neighbors without trusted final outcome provenance, resolved library identity, or compatible profile evidence are demoted before they influence policy decisions.
- ***arr setup is faster** — Radarr and Sonarr instance configuration shares a single composable flow: save once, immediately enter edit mode with root folder and quality profile counts visible, and delete any instance including the last one.

### Quick Visual
```text
v0.47.4-beta Snapshot
Evidence calibration  [██████████] weak candidates demoted before ranking
Quality gating        [██████████] RAG evidence provenance enforced
Constraint semantics  [██████████] strict runtime constraints exclude mismatches
Policy configuration  [██████████] structured configuration_view for presets + custom
*arr setup            [██████████] shared composable, one-pass configuration
Signal snapshots      [██████████] final outcome vs. original evidence separated
Dependency freshness  [██████████] 3 Dependabot rollups merged
Test suite            [██████████] 800 server + 2,383 client tests passing
```

### Highlights
- **Policy Candidate Evidence Calibration** — compatibility-only, profile-only, and RAG-only evidence is calibrated with multipliers and caps before ranking, so high raw scores from weak sources cannot dominate. Ranked candidates preserve `raw_score` and `score_calibration` diagnostics for explainability.
- **RAG Evidence Quality Gating** — deterministic RAG neighbor quality scoring demotes evidence without trusted final outcome provenance, resolved library identity, or compatible profile evidence. Policy candidate diagnostics include bounded `rag_evidence_quality` details.
- **Policy Constraint Semantics** — strict runtime constraint evaluation for policy preset signals across 10+ dimensions; failing constraints are excluded from ranking and persisted as `policy_constraints` diagnostics.
- **Policy Configuration Modernization** — policy responses now include a `configuration_view` that projects merged preset and custom signals into identity signals, compatibility signals, strict constraints, boosters, exclusions, and bounded configuration warnings.
- **Final Outcome vs. Signal Snapshot Separation** — the History detail modal now separates final outcome from original signal snapshot, showing snapshot source, date, score, and summary without reusing the final row's confidence for diagnostic evidence.
- **Streamlined *arr Instance Setup** — Radarr and Sonarr settings views now share `useArrConfig.js` composable with connection test enrichment (root folder and quality profile counts) and clean delete support for any instance.

### Reliability Improvements
- Removed dead `calibratePolicyCandidates` batch wrapper flagged by knip production CI and ESLint `no-unused-vars`.
- RAG evidence library identity resolution uses live `libraries` table instead of stale denormalized `classification_history.library_name`.
- pgvector HNSW recall tuning raised `ef_search` defaults and expanded candidate windows.
- 3 Dependabot dependency rollups merged (server tooling, server runtime, client tooling).
- RAG evidence snapshot observability persists neighbor evidence in classification metadata for incident diagnosis.

### Who This Helps
- **End users:** more accurate library routing, especially for media with ambiguous metadata or weak evidence signals.
- **Operators/admins:** policy diagnostics explain why a candidate was calibrated or excluded; *arr setup is faster with fewer clicks.

### Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.3-beta
**Title: Leaner codebase — dead exports cleaned up, pgvector recall hardened, and full decision trace observability**

### 🎉 What You'll Notice
- **Faster CI builds** — knip dead-export checks pass cleanly again, no more false negatives blocking merges.
- **Better RAG retrieval accuracy** — pgvector HNSW recall tuning means policy and profile re-checks evaluate a wider, more representative candidate set before rejecting or accepting matches.
- **Full classification decision tracing** — every classification now carries a W3C-compatible trace context with stage timing, span IDs, and correlation IDs visible in the History detail panel.

### 📊 Quick Visual
```text
v0.47.3-beta Snapshot
Dead code removed     [██████████] 2 namespace exports eliminated
pgvector recall       [██████████] Higher ef_search + iterative HNSW scans
Decision tracing      [██████████] W3C traceparent + 6 stage spans
Policy hardening      [██████████] Weak evidence can't become primary anchors
Docker pulls          [██████████] 17,000+ for cloudbyday90/classifarr
Total test count      [██████████] 12,738 server + 2,370 client tests
```

### ✨ Highlights
- **Decision Trace Correlation and Stage Timing** — every classification outcome now includes a W3C-compatible trace ID, correlation ID, and timed child spans for gate, enrichment, retrieval, policy recheck, AI rerun, and RAG candidate stages — all visible in the History detail modal.
- **pgvector Recall Audit Mode** — new admin-only endpoint compares bounded HNSW results against exact search so you can verify retrieval accuracy without touching PostgreSQL directly.

### 🔧 Reliability Improvements
- Removed unused `decisionTraceContext` and `decisionTraceSpanCollector` namespace exports flagged by knip.
- pgvector candidate CTE now orders by raw distance operator to keep HNSW index eligibility.
- Policy evidence anchor hardening prevents weak RAG-only or generic signals from dominating specialized library matches.
- RAG evidence snapshot observability persists neighbor evidence in classification metadata for incident diagnosis.

### 👥 Who This Helps
- **End users:** more accurate library routing, especially for media with ambiguous metadata.
- **Operators/admins:** full decision trace observability and a recall audit endpoint for diagnosing retrieval quality without database access.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.2a-beta
**Title: Ollama reliability fix — no more false "generation timeout" warnings**

### 🎉 What You'll Notice
- **Ollama preflight probes succeed reliably** — even on cold starts where the model takes 30-90 seconds to load into GPU memory, the health check now waits long enough to complete successfully.
- **Fewer warning logs** — eliminates the cascading "Scheduled Ollama preflight failed" warnings that appeared on every retry cycle.

### 📊 Quick Visual
```text
v0.47.2a-beta Snapshot
Probe timeout         [██████████] 120s (was 15s)
Cold start coverage   [██████████] Up to 120B parameter models
Existing installs     [██████████] Auto-upgraded on next release
```

### 🔧 Reliability Improvements
- Increased Ollama generation probe timeout from 15 seconds to 2 minutes, covering real-world cold model load times.
- Updated `.env.example` with documented defaults for operators who want to fine-tune.

### 👥 Who This Helps
- **Self-hosters with local Ollama:** no more false-negative health checks after model swaps or restarts.
- **Operators with larger models (8B–120B):** preflight probes now complete within the timeout window.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.2-beta
**Title: Smarter classification history, stronger profile scoring, and dependency security hardening**

> [!IMPORTANT]
> Existing installs will automatically regenerate library profiles on startup if stale, non-canonical rating buckets are detected. No manual action required.

### 🎉 What You'll Notice
- **Cleaner classification history** — the History page now shows one canonical final row per media item instead of cluttering the list with every intermediate retry and source observation. The detail modal still shows the full lifecycle.
- **More accurate library profiles** — raw age ratings (16, 17, 18) now correctly map to canonical TV ratings like TV-MA, improving how well your libraries match new media.
- **RAG can't decide for you anymore** — RAG-only evidence no longer auto-promotes to a final classification outcome; it needs corroboration from policies, profiles, or manual decisions.
- **Security-hardened HTTP client** — axios upgraded to 1.17.0 with SSRF config hardening and improved auth/proxy handling.

### 📊 Quick Visual
```text
v0.47.2-beta Snapshot
History deduplication     [██████████] One canonical row per media item
Rating normalization      [██████████] Raw ages → canonical TV/MPAA
RAG guard rails           [██████████] No more unsupervised RAG outcomes
Profile auto-repair       [██████████] Stale buckets regenerated on startup
Profile diagnostics       [██████████] Scoring breakdown visible in History
Dependency security       [████████░░] axios SSRF hardening + GHA pinning
Total test count          [██████████] 12,646 server + 2,370 client tests
```

### ✨ Highlights
- **Canonical Classification History** — the History API and UI now deduplicate intermediate events into a single final outcome per media item, with the full event lifecycle (retries, rechecks, resolutions) available in the detail modal.
- **Profile Scoring Observability** — classification diagnostics now include the exact rating normalization, genre/keyword scores, and exclusion hits used, so you can understand why a classification landed where it did.
- **Post-Upgrade Profile Regeneration** — a one-time startup task automatically repairs library profiles with stale rating buckets.

### 🔧 Reliability Improvements
- RAG-improved candidates downgraded to weak viability unless corroborated by policy/profile/history evidence.
- Library profile rating normalization handles legacy persisted distributions at read time.
- Removed dead `computeProfileScore()` export detected by updated knip 6.16.0.
- Spurious jsdom navigation warning in test runs silenced.

### 👥 Who This Helps
- **End users:** cleaner History view, more accurate library matching, automatic profile repair after upgrades.
- **Operators/admins:** profile scoring diagnostics for debugging classifications, security-hardened dependencies.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.1-beta
**Title: AI classification overhaul, backup restore fixes, and massive reliability push**

### 🎉 What You'll Notice
- **Smarter AI classifications with fewer retries** — new JSON Schema constrained decoding forces the AI to return valid structured responses on the first try, dramatically reducing repair cycles on both local (Ollama) and cloud (OpenAI, Gemini, etc.) providers.
- **Backup restores work correctly again** — 10 schema mismatches in the restore pipeline have been fixed, so importing a backup won't silently corrupt data or crash.
- **Consistent error responses everywhere** — 55 service-layer throws promoted to typed errors (400/404/409/503), giving you clear, actionable messages instead of generic 500s.
- **Cleaner, leaner codebase** — 18 dead client files removed, 6,000+ lines of dead code deleted, and every unused import/variable now blocked by CI.

### 📊 Quick Visual
```text
v0.47.1-beta Snapshot
AI response reliability   [██████████] JSON Schema enforced on all providers
Backup restore fixes      [██████████] 10 schema mismatches resolved
Typed error coverage      [████████░░] 55 services promoted (400/404/409/503)
Integration test suites   [██████████] 7 new modules / 113 new tests
Dead code removed         [██████████] 18 files / 6,289 lines deleted
ESLint rules at error     [██████████] security (14/14) + n (15/15) + core
Total test count          [██████████] 12,633 server + 2,369 client tests
```

### ✨ Highlights
- **JSON Schema constrained decoding for all AI providers** — local Ollama models and cloud gateways (OpenAI, OpenRouter, LiteLLM, Gemini) now receive strict response schemas that enforce valid JSON output at the grammar level, eliminating malformed responses.
- **Zod validation auto-repair loop** — AI responses are validated against a Zod schema after parsing; on failure, the exact validation errors are fed back to the model for a second attempt (the "Validation Sandwich" pattern).
- **AI telemetry endpoint** — new `/api/stats/classification/ai-telemetry` endpoint tracks first-pass success rates, repair attempts, and validation failures for operations monitoring.
- **Full backup restore pipeline audit** — all 20 `restoreXxx` functions tested against the live database; fixed column mismatches, a dollar-quote SQL bug, and dead code from earlier schemas.
- **18 dead client files removed** — unused Vue components, stores, views, and utilities cleaned out along with the `socket.io-client` dependency.

### 🔧 Reliability Improvements
- Fixed `pg` driver JSONB array serialization bug affecting clarification questions, learning patterns, and backup restore.
- Fixed `restoreLibraryPolicies` `$$` dollar-quote bug that could cause SQL parsing errors during restore.
- Promoted 20 config-missing service throws to `ServiceUnavailableError` (503) — API key not configured, Discord token missing, etc. now return meaningful status codes.
- Consolidated AI settings error handling into a shared `trySettingsAction` helper.
- Eliminated 6 redundant route-layer catch blocks — errors now flow through centralized `errorHandler` uniformly.
- Deterministic temperature locking (`temperature: 0`) when JSON Schema parsing is active.
- Multi-layer AI response normalizer strips `<think...</thinko>` tags, markdown fences, preamble text, and normalizes numeric fields.
- Hardened prompting with explicit few-shot examples to keep local models compliant.

### 👥 Who This Helps
- **End users:** more reliable AI classifications, backup restores that work correctly, and clearer error messages when something is misconfigured.
- **Operators/admins:** AI telemetry for monitoring, 503 status codes for missing configs, 7 new integration test suites catching regressions in CI.
- **Developers:** ESLint security + compatibility rules at `error`, Knip dead-code detection in CI, 15,000+ tests across server and client.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.47.0-beta
**Title: Rock-solid error handling, cleaner codebase, and sharper CI gates**

### 🎉 What You'll Notice
- **Errors are clearer and more consistent** — all route error responses now flow through a single centralized handler, giving you uniform `{ error: "message" }` responses every time.
- **The app is more reliable at startup** — a crash-causing bug in the backfill scheduler (`db is not defined`) is fixed, so the server starts cleanly every time.
- **The system catches more problems before they ship** — unused imports, phantom globals, and dead code are now blocked by CI, not just warned about.

### 📊 Quick Visual
```text
v0.47.0-beta Snapshot
Error standardization  [██████████] 0 inline error responses remain in route handlers
Code cleanliness       [██████████] 28 dead imports removed, 0 ESLint warnings
CI hardening           [██████████] no-unused-vars + no-undef both enforced as errors
Test suite             [██████████] 356 suites / 13,086 tests — all green
DI integrity           [██████████] 27 default deps verified, all handler params match
```

### ✨ Highlights
- **Every route error response is now uniform** — whether it's a 400 validation error, 404 not found, or 500 server error, you get a consistent JSON shape through the centralized error handler.
- **Zero dead imports in the server** — 30 unused imports, variables, and stale directives removed across 22 files. ESLint enforces this as a blocking gate.
- **Dependency injection fully verified** — all 27 default service singletons match their live exports, all 11 handler factory signatures match their descriptor pass-throughs, and one previously-hardcoded dependency is now properly injectable for testing.
- **70+ modular ESM extractions** — services and routes refactored into focused single-responsibility modules with named exports, callback injection, and comprehensive test coverage.
- **Schema snapshot drift resolved** — `dump-schema.mjs` now trusts applied database state and canonicalizes through a fresh container install, eliminating CI failures from formatting differences between environments.

### 🔧 Reliability Improvements
- Fixed a runtime crash in `scheduledBackfillService.mjs` where a bare `db` reference caused `ReferenceError` during Docker startup.
- Fixed `AppError.toJSON()` message corruption — error objects with `message` in their `extra` payload no longer overwrite the primary error text.
- Added `errorHandler` middleware to 3 integration test apps that were missing it, resolving 11 test failures.
- Fixed missing `ValidationError` import in API key routes that caused 500 errors instead of proper 400 responses.
- Applied 5 Dependabot dependency bumps (helmet 8.2, undici 8.3, vite 8.0.14, vitest 4.1.7, typescript 6.0.3).
- Eliminated `glob@10.5.0` deprecation warning and `undici` phantom dependency.
- Added ESLint `no-undef: error` and `no-unused-vars: error` rules — zero violations across the entire codebase.
- Added Knip static analysis CI gate with production mode — removed 22 dead exports and 1 dead file.

### 👥 Who This Helps
- **End users:** more reliable error messages and no startup crashes after configuration changes.
- **Operators/admins:** cleaner logs (no redundant double-logging), consistent API error responses, and a CI pipeline that catches code quality issues before merge.
- **Developers:** modular codebase with clear dependency injection, comprehensive test coverage, and automated dead-code detection.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.4a-beta
**Title: Dependencies are fresher, security posture is tighter, and the runtime is up to date**

### 🎉 What You'll Notice
- **Nothing breaks** — all dependency bumps are patch-level or minor upgrades; no API changes or operator actions required.
- **WebSocket security is patched** — a moderate `ws` vulnerability (CVE-2026-45736) is resolved without downgrading any functionality.
- **The Docker runtime is current** — the embedded Node.js container now runs the latest Node 24 LTS release.

### 📊 Quick Visual
```text
v0.46.4a-beta Snapshot
Dependency freshness    [██████████] 14 npm packages updated across root, server, and client
Vulnerability posture   [██████████] server and client npm audit both at 0
CI supply chain         [██████████] last floating action tag is now hash-pinned
Runtime currency        [██████████] Node.js 24.14.1 → 24.15.0 in Docker image
```

### ✨ Highlights
- **Zero known vulnerabilities** — npm audit reports 0 issues across all three workspaces after the `ws` override and dependency bumps.
- **Supply chain hardening** — the only floating GitHub Action tag in the pipeline (`upload-artifact@v7`) is now pinned to an immutable commit hash.
- **Every dependency group is current** — all open Dependabot PRs (#423–#429) have been resolved, covering runtime dependencies, dev tooling, and GitHub Actions.

### 🔧 Reliability Improvements
- Bumped root `axios` to 1.16.1 (prototype pollution hardening and proxy cleartext leak fix).
- Bumped server `pg` to 8.21.0 (Node 26 support, SCRAM hardening), `express-rate-limit` to 8.5.2.
- Bumped client `vue-router` to 5.0.7 (prototype pollution hardening), `vite` to 8.0.13, `vue-tsc` to 3.3.0.
- Bumped client and server `eslint` to 10.4.0, `@types/node` to 25.9.0.
- Bumped CI `codeql-action` to 4.35.5 and client `postcss` to 8.5.15.

### 👥 Who This Helps
- **End users:** a slightly faster, more secure experience with no configuration changes needed.
- **Operators/admins:** fewer audit warnings, cleaner CI pipeline, and confidence that the runtime is on a current LTS patch.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.4-beta
**Title: Warnings are quieter, diagnostics are sharper, and releases are safer**

### 🎉 What You'll Notice
- **Operator alerts are less noisy** — repeated OMDb/Tavily provider problems and several configuration-drift issues now surface once with clearer summaries instead of repeating the same warning on every affected item.
- **Needs Attention cards explain failure sequences better** — malformed AI output, targeted re-check outcomes, and parser diagnostics are easier to understand without digging through logs.
- **Fresh installs are more consistent** — schema snapshots and reconciliation migrations now keep bootstrap seed/config state aligned more reliably across installs and upgrades.

### 📊 Quick Visual
```text
v0.46.4-beta Snapshot
Warning noise          [██████████] repeated provider/config symptoms deduped
Diagnostics clarity    [█████████░] malformed AI and re-check paths easier to inspect
Release safety         [██████████] schema snapshot + current.sql guidance tightened
Fresh install parity   [█████████░] seed/config reconciliation coverage expanded
```

### ✨ Highlights
- **Metadata provider failures are easier to trust** — OMDb and Tavily now warn once per real provider problem instead of flooding the logs while the same outage continues.
- **AI contract failures leave better breadcrumbs** — malformed classify output now keeps a safe preview/fingerprint trail for follow-up debugging.
- **Release workflow is stricter about schema drift** — `current.sql` is now explicitly called out as part of schema-changing release hygiene so CI does not fail on snapshot drift.
- **The release gates now match the real dependency state better** — stale OSV suppressions are gone and the affected transitive package pin has been updated, so prerelease tags are less likely to fail on already-fixable advisory drift.

### 🔧 Reliability Improvements
- Added startup integrity audits for more configuration-drift cases, including metadata providers.
- Tightened warning severity so benign or repeated fallback behavior does not drown out real incidents.
- Hardened schema snapshot release guidance around `database/schema/current.sql` regeneration and verification.
- Aligned release-time schema refresh with the same containerized PostgreSQL dump path CI uses, so `current.sql` does not drift between local release prep and tag validation.

### 👥 Who This Helps
- **End users:** fewer confusing “stuck” or overloaded status messages when upstream providers are having trouble.
- **Operators/admins:** cleaner logs, clearer diagnostics, and fewer release-time surprises from schema snapshot drift.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.3a-beta
**Title: Webhook authorization headers stay stable, and the settings page stops crying wolf**

### 🎉 What You'll Notice
- **Refreshing the Webhooks page no longer silently replaces your authorization header** — the page stops auto-generating a new header just because it cannot display one immediately.
- **The scary red warning flash is gone** — the Webhooks settings screen now waits for the real authorization-header state instead of briefly showing `Authorization Header Required` during load.
- **Encryption-key problems are clearer** — Classifarr now distinguishes between “no header exists” and “a stored header exists but cannot be decrypted with the current key.”

### 📊 Quick Visual
```text
v0.46.3a-beta Snapshot
Header stability       [██████████] refreshes no longer replace stored webhook secrets
Settings clarity       [██████████] false missing-header warning flash removed
Operator guidance      [█████████░] missing vs unavailable secret states separated
```

### ✨ Highlights
- **Webhook secret changes are now deliberate** — generate/regenerate only happens from an explicit user action.
- **Load-state UX is calmer** — the page uses a neutral loading state until the server confirms whether the header is available, missing, or unavailable.

### 🔧 Reliability Improvements
- Preserved stored webhook authorization headers instead of overwriting them when the settings page mounts.
- Added an explicit webhook secret status contract so the server and UI agree on `available`, `missing`, and `unavailable`.
- Prevented a false negative warning path that made a healthy stored header look missing for a split second after refresh.

### 👥 Who This Helps
- **End users:** webhook integrations stop breaking unexpectedly after visiting the settings page.
- **Operators/admins:** encrypted secret/key-mismatch situations are easier to understand without guessing why a header changed.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.3-beta
**Title: RAG recovers on its own, progress is clearer, and embedding failures finally tell you what actually broke**

### 🎉 What You'll Notice
- **RAG backfill no longer depends on a restart to resume** — if embeddings are pending and the system is already idle, Classifarr now reconciles and restarts the idle backfill path automatically.
- **Queue and enrichment progress make more sense** — the Processing panel now reflects Plex sync coverage, while enrichment surfaces separate processed, pending, deferred, and failed states more clearly.
- **RAG status is much easier to read** — text and image embedding cards now use matching labels, and failure counts are split by text vs image instead of being lumped into one generic total.

### 📊 Quick Visual
```text
v0.46.3-beta Snapshot
RAG auto-recovery      [██████████] resumes pending embeddings after restart/idle recovery
Progress clarity       [█████████░] sync and enrichment surfaces no longer mix workflows
Failure diagnostics    [█████████░] text vs image embedding failures split explicitly
Operator forensics     [█████████░] rebuild/clear triggers leave durable audit trails
```

### ✨ Highlights
- **Idle RAG recovery is now state-aware** — backfill startup checks now look at pending work and idle status instead of waiting forever for a fresh idle event.
- **Embedding status is standardized** — text and image overview cards now mirror each other and show the right counts for each pipeline.
- **Rebuild causes are traceable** — clears, stale-marking, and automatic rebuild triggers now leave durable `rag_logs` breadcrumbs for operators.

### 🔧 Reliability Improvements
- Split metadata-enrichment concurrency from the legacy general worker cap so OMDb/Tavily throughput can be tuned separately.
- Made enrichment item state explicit (`pending`, `processing`, `completed`, `deferred`, `failed`) instead of inferring it indirectly from retries.
- Preserved webhook authorization secrets across restarts when the encryption key is unavailable, rather than silently regenerating them.
- Added real text-vs-image RAG failure metrics to the status payload so the UI is backed by actual server data instead of guessed totals.

### 👥 Who This Helps
- **End users:** queue progress, enrichment progress, and embedding status are easier to trust at a glance.
- **Operators/admins:** RAG recovery, embedding rebuilds, and webhook secret problems are easier to diagnose without digging through shell logs.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.2c-beta
**Title: Enrichment progress is clearer, webhook log errors are gone, and RAG health now explains what is actually missing**

### 🎉 What You'll Notice
- **Enrichment no longer looks falsely stuck when Tavily hits its monthly quota** — deferred Tavily fallback items are now shown separately instead of looking like they are actively blocking the rest of metadata processing.
- **Webhook log refreshes stop throwing noisy errors** — the page refresh flow no longer sends invalid paging values that turn into PostgreSQL `NaN` failures.
- **RAG health is much easier to understand** — the system health view now tells you whether pgvector is present, whether the embeddings table exists, and whether required indexes are missing.

### 📊 Quick Visual
```text
v0.46.2c-beta Snapshot
Enrichment clarity   [██████████] deferred Tavily shown separately
Webhook logging      [██████████] invalid page/limit noise removed
RAG diagnostics      [█████████░] degraded vs unavailable now visible
Operator insight     [█████████░] missing indexes surfaced in System view
```

### ✨ Highlights
- **Deferred is no longer confused with blocked** — OMDb/core enrichment can finish while Tavily-only follow-up waits for the monthly quota reset.
- **Health cards now explain partial readiness** — RAG can surface as degraded instead of failing as a vague binary healthy/unhealthy state.
- **System troubleshooting is faster** — missing vector indexes and embeddings prerequisites are visible from the UI instead of only in backend logs.

### 🔧 Reliability Improvements
- Removed invalid pgvector health probes and existence-unsafe HNSW prewarm checks that were generating avoidable PostgreSQL log noise.
- Added stricter RAG readiness reporting for pgvector, the embeddings table, required indexes, and `pg_prewarm`.
- Tightened webhook log parameter handling so malformed paging input fails cleanly instead of reaching PostgreSQL.
- Removed a leftover internal debug helper from the committed server tree so release builds stay cleaner.

### 👥 Who This Helps
- **End users:** progress bars and enrichment status make more sense when optional Tavily work is deferred.
- **Operators/admins:** the system page now points to concrete RAG readiness gaps like missing indexes instead of leaving only generic health states.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.2b-beta
**Title: Heartbeat controls work again — no more 500 errors when checking scheduler status**

### 🎉 What You'll Notice
- **The heartbeat status page loads without errors** — a missing wiring issue caused the heartbeat check, start, and stop controls to crash with a server error every time they were used.
- **Heartbeat scheduling is fully functional** — start, stop, and status-check all route correctly now.

### 📊 Quick Visual
```text
v0.46.2b-beta Snapshot
Heartbeat status   [██████████] GET /heartbeat — 200 OK (was 500)
Heartbeat start    [██████████] POST /heartbeat/start — working
Heartbeat stop     [██████████] POST /heartbeat/stop — working
```

### ✨ Highlights
- **All three heartbeat endpoints are live again** — the underlying functions were always there, they just weren't connected to the route handler.

### 🔧 Reliability Improvements
- Fixed an incomplete service facade that silently dropped heartbeat functions from the route wiring.

### 👥 Who This Helps
- **End users:** heartbeat scheduler controls in the UI work without throwing errors.
- **Operators/admins:** automated health-check scheduling can be managed from the UI again.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.2a-beta
**Title: PostgreSQL upgrades are safer, schema verification is tighter, and Docker cleanup is now part of the release contract**

### 🎉 What You'll Notice
- **Your database starts more reliably** — missing PostgreSQL extensions no longer crash the container on Unraid and other Docker hosts.
- **Upgrades from PostgreSQL 17 to 18 are smoother** — config overrides (including `ALTER SYSTEM` changes) are now preserved and normalized during the upgrade path.
- **Release quality is now verified more strictly** — CI and release prep now rebuild the committed schema snapshot correctly, prove Docker recovery/upgrade behavior, and clean up temporary verification containers afterward.

### 📊 Quick Visual
```text
v0.46.2a-beta Snapshot
Startup resilience    [██████████] survives missing pg_stat_statements
Upgrade safety        [██████████] config normalized across PG17→18
Schema verification   [██████████] canonical snapshot drift now enforced
Docker cleanup        [██████████] temp verification containers auto-purged
Config diagnostics    [█████████░] include-file usage now surfaced on failure
```

### ✨ Highlights
- **PostgreSQL startup hardened** — the container now detects and recovers from missing `pg_stat_statements` runtime files instead of crashing.
- **PG17→18 upgrade preserves config** — both `postgresql.conf` and `postgresql.auto.conf` overrides are carried forward and normalized, including `ALTER SYSTEM` changes.
- **Schema drift is now a real release gate** — the committed snapshot must match a fresh PostgreSQL 18 rebuild, including canonical migration-tracking structure.
- **Docker smoke suite in CI** — every release now proves a fresh instance boots, an existing cluster recovers, and the upgrade path completes, with full cleanup afterward.

### 🔧 Reliability Improvements
- Fresh installs skip unnecessary checksum migration checks on PG18.
- Schema snapshot freshness is now an executable CI contract, with helper-sequence drift stripped out of the generated snapshot.
- Temporary schema-verification containers now label and purge stale leftovers automatically on the next run.
- Included config files (`include`/`include_dir`) are surfaced in diagnostics, but remain explicitly admin-managed during PG17→18 upgrades.
- Migration docs codify fail-fast standards with self-guarding SQL patterns.
- Production security defaults are tighter: inline scripts are no longer allowed by the app CSP, and health-check failures avoid exposing raw database errors in production.

### 👥 Who This Helps
- **End users:** fewer surprise crashes on Unraid and other Docker hosts with non-standard PostgreSQL setups.
- **Operators/admins:** clearer diagnostics, safer upgrades, more trustworthy schema drift checks, and cleaner Docker verification runs.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.2-beta
**Title: Admin settings are steadier, AI route failures are cleaner, and release checks are harder to bypass**

### 🎉 What You'll Notice
- **Admin settings save more predictably** — the remaining settings route helpers now use the same modern response and validation flow instead of each carrying its own fragile error plumbing.
- **AI and RAG admin tools fail more cleanly** — backfill, diagnostics, retry, and export routes now return more consistent errors instead of drifting between route-specific behaviors.
- **Release regressions are caught earlier** — the server CI path now typechecks locally before coverage runs, so workflow-only failures are less likely to surprise operators after a push.

### 📊 Quick Visual
```text
v0.46.2-beta Snapshot
Admin settings consistency [█████████░] more shared validation and error handling
RAG route resilience       [█████████░] cleaner failures across backfill and diagnostics
Release confidence         [██████████] local CI now catches server typecheck drift
```

### ✨ Highlights
- **Settings route modernization continues** — the remaining operational settings helpers now run through the shared async-handler and typed app-error flow.
- **RAG helper routes are more uniform** — backfill, core, diagnostics, and operations endpoints now share one modular route wrapper for logging and error responses.
- **The server test path is stricter where it matters** — route refactors now hit the same typecheck boundary locally that GitHub Actions enforces in CI.

### 🔧 Reliability Improvements
- Validation and not-found paths now use typed app errors in more RAG helper code instead of ad hoc status mutation.
- The shared `AppError` contract again exposes the legacy `.status` alias, protecting older route tests and mixed helpers during the ESM migration.
- Added direct regression coverage for RAG backfill route behavior and shared app-error compatibility.

### 👥 Who This Helps
- **End users:** fewer inconsistent admin failures when working with AI settings and RAG maintenance tools.
- **Operators/admins:** cleaner troubleshooting, more consistent error responses, and fewer “green locally, red in CI” surprises.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.1a-beta
**Title: Cleaner fresh installs — no more spurious checksum warning**

### 🎉 What You'll Notice
- **Fresh installs start cleanly** — the "Could not determine checksum status" message no longer appears when setting up Classifarr for the first time.

### 📊 Quick Visual
```text
v0.46.1a-beta Snapshot
Fresh install experience  [██████████] clean startup, no spurious warnings
Existing upgrades         [██████████] unchanged, already handled correctly
```

### ✨ Highlights
- Fresh PostgreSQL 18 installations now skip the one-time checksum migration check, since PG18 already enables checksums by default.

### 🔧 Reliability Improvements
- Eliminated a harmless but confusing log message on first-time deployments.

### 👥 Who This Helps
- **New users:** cleaner first-run experience with no unexpected warnings.
- **Operators/admins:** less noise in logs when deploying to new hosts.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.46.0-beta
**Title: The big rewrite — native ESM, PostgreSQL 18, modular services, and a 20x bigger queue**

> [!IMPORTANT]
> This is a major infrastructure release. If you're upgrading from a previous version, PostgreSQL will automatically upgrade from 17 to 18 on first start. Your data is preserved and backed up. No manual steps required.

### 🎉 What You'll Notice
- **Your database upgrades itself** — existing PostgreSQL 17 deployments are automatically migrated to PostgreSQL 18 on first start with zero downtime.
- **Larger libraries queue faster** — the task queue now holds up to 200,000 items instead of 10,000, so big media libraries won't stall out.
- **Database versions are now visible** — the System Information page shows your PostgreSQL and pgvector versions at a glance.
- **The entire platform is faster and more maintainable** — months of behind-the-scenes work to modernize the codebase from the ground up.

### 📊 Quick Visual
```text
v0.46.0-beta Snapshot
Database engine        [██████████] PostgreSQL 18 (auto-upgrade from 17)
Queue capacity         [██████████] 200k rows (was 10k)
Version visibility     [██████████] PG + pgvector in System Info
ESM migration          [██████████] Entire server converted to native ESM
Service extraction     [██████████] Large files split into modular services
Test modernization     [██████████] All tests converted to native ESM
Upgrade safety         [██████████] pg_upgrade --link, old data preserved
```

### ✨ Highlights
- **Full CommonJS to native ESM migration** — every server file has been converted from CommonJS (`require`/`module.exports`) to native ECMAScript Modules (`import`/`export`). This is the foundation for faster startup, better tree-shaking, and modern JavaScript tooling.
- **Large services split into focused modules** — monolithic files like `scheduler.mjs`, `queueService.mjs`, and `classification.mjs` were decomposed into dedicated single-responsibility services (e.g., `QueueMaintenanceService`, `QueueRefillService`, `ClassificationMaintenanceService`, `SchedulerRetentionService`, `RatingNormalizationQueueService`, and many more).
- **PostgreSQL 18 with automatic in-place upgrade** — existing PG17 deployments migrate transparently using `pg_upgrade --link` (hard links, no data copy), with the original data backed up safely.
- **pgvector updated to v0.8.2** — built from source for both PG17 and PG18 to ensure a smooth upgrade path.
- **Centralized error handling** — route handlers now use a shared `asyncHandler` + `errorHandler` pattern instead of inline try/catch blocks.

### 🔧 Reliability Improvements
- Task queue cap raised 20x to prevent large libraries from hitting the row limit.
- Data checksums enabled automatically on existing clusters, matching PG18's default.
- All server tests converted to native ESM with shared mock factories and test helpers, eliminating flaky CommonJS mock ordering issues.
- Logging stack rebuilt on `pino` with extracted modules for config, sanitization, request context, and deduplication.
- ESLint config converted to native ESM, now actually linting the `.mjs` server tree.
- Playwright browser tests removed from CI to eliminate flaky Chromium dependency.

### 👥 Who This Helps
- **End users:** bigger libraries queue without interruption; database versions are easy to check; faster and more reliable platform.
- **Operators/admins:** zero-touch PostgreSQL 18 migration with data safety net; modern logging and error handling improve debuggability.
- **Developers:** native ESM codebase with modular services, shared test helpers, and modern tooling makes contributing easier and faster.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details — this release includes hundreds of changes across nearly every file in the project.

---

## v0.45.6-beta
**Title: AI settings are safer, modern models work better, and releases are harder to drift**

### 🎉 What You'll Notice
- **Changing AI providers is smoother** — settings no longer carry stale model IDs, old API keys, or unrelated provider fields into the next save.
- **Modern OpenAI reasoning models are better supported** — official OpenAI reasoning models now use the newer Responses flow while OpenAI-compatible gateways stay on their existing behavior.
- **Backups and webhooks are safer to restore** — secrets are preserved, cleared, and restored more consistently.

### 📊 Quick Visual
```text
v0.45.6-beta Snapshot
AI settings safety      [██████████] stale payloads and null-secret crashes fixed
Modern model support    [█████████░] OpenAI reasoning models use Responses
Fresh install safety    [██████████] schema snapshot regenerated and guarded
Release confidence      [██████████] tests, lint, audits, Docker no-cache build passed
```

### ✨ Highlights
- **AI provider changes are cleaner** — switching between local, cloud, and embedding providers now clears stale fields instead of silently reusing them.
- **Long model names save correctly** — newer provider model identifiers can be stored without hitting old database length limits.
- **Image embeddings start disabled by default** — new and corrected installs no longer inherit the wrong local sidecar defaults.
- **Fresh installs are aligned with upgraded installs** — the schema snapshot was regenerated from a fully migrated database and now matches the current migration state.

### 🔧 Reliability Improvements
- Secrets now share clearer behavior: omitted or masked values are preserved, explicit empty values clear, and real new values replace.
- Webhook and API-key validation now rejects malformed non-string values more defensively.
- Backup restore now handles webhook secrets and restored admin API keys more reliably.
- Release automation now checks package and lockfile version drift before release.

### 👥 Who This Helps
- **End users:** fewer AI settings save failures and fewer surprises when changing providers or models.
- **Operators/admins:** safer backups, more predictable restores, cleaner fresh installs, and stronger release verification.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.45.5-beta
**Title: Queue reliability is stronger, AI settings behave correctly, and Ollama health is visible**

### 🎉 What You'll Notice
- **Classification bursts no longer stall the queue** — a pool exhaustion cascade caused by a sequential full-table scan has been eliminated. Workers no longer race for connections, and the slow-query logger no longer triggers itself.
- **AI settings save cleanly** — the "Unsupported configuration keys. Please reload the page" error is gone. Internal auto-fallback and cache state columns are now stripped before the config reaches the client.
- **Ollama health checks are smarter and visible** — the scheduled preflight retries on transient failures with jittered backoff instead of waiting a full day, and the current status (last check, failure type, next attempt) is now visible in the AI settings UI.

### 📊 Quick Visual
```text
v0.45.5-beta Snapshot
Queue reliability       [██████████] pool exhaustion + partial index + log cascade fixed
Service decomposition   [██████████] queue + classification fully modularized
Ollama visibility       [█████████░] smart preflight, UI status, jittered retry
AI settings UX          [█████████░] no more "reload page" on save
```

### ✨ Highlights
- **Queue pool exhaustion eliminated** — a partial DB index (`idx_task_queue_processing_classification`) replaces a full-table scan, a 250ms in-process cache collapses concurrent per-worker DB calls, and `skipDbPersist` on the slow-query logger breaks a self-referential error cascade.
- **AI settings save without errors** — eleven internal state columns that leaked into the config payload are now stripped server-side before the response reaches the client.
- **Ollama preflight is observable** — configurable timeouts, jittered retry, failure classification, and UI status reporting replace the previous fixed-interval single-attempt pattern.
- **Services continue to be decomposed** — the queue layer now spans `QueueMaintenanceService`, `QueueReadModel`, `QueueTaskProcessorService`, `QueueWorkerLoopService`, and `AIRouterService`; `classification.js` loses more responsibility to `libraryRulesService`, `libraryLabelsService`, and dedicated policy and legacy signal path services.

### 🔧 Reliability Improvements
- uuid vulnerability GHSA-w5hq-g745-h8pq resolved via `uuid@14` npm override; axios, vite, vitest, Vue, and vue-router refreshed.
- `buildRagLoopSummary` now returns a baseline summary when trace is disabled but events are present, instead of returning `null`.
- Code-health rule added: no silently swallowed errors — empty `catch` blocks and silent `.catch(() => {})` calls are now flagged in CI unless explicitly suppressed with a reason comment.
- Integration test cache isolation hardened so queue-robustness tests no longer intermittently read stale blocker state from the previous test.

### 👥 Who This Helps
- **End users:** fewer classification queue stalls on busy systems with multiple concurrent workers; Ollama is more resilient when models are slow to warm up.
- **Operators/admins:** Ollama health status visible in the UI without digging through logs; AI settings save reliably without the reload-required error.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.45.4-beta
**Title: Classification is more trustworthy, health alerts are clearer, and local Docker builds are smoother**

### 🎉 What You'll Notice
- Classification decisions are more conservative when confidence is ambiguous, so edge cases are less likely to auto-route into the wrong library.
- Image embedding sidecar authentication and health reporting are easier to trust, with cleaner failure handling and clearer status transitions.
- Local source builds are smarter on modern CPUs, so Docker setups start with a better pgvector build instead of relying on fragile runtime switching.

### 📊 Quick Visual
```text
v0.45.4-beta Snapshot
Classification trust   [██████████] safer threshold handling and ambiguity fallbacks
Operator visibility    [█████████░] clearer health alerts and sidecar status changes
Local Docker setup     [█████████░] smarter CPU-aware pgvector builds
Release confidence     [██████████] broad regression coverage and full-suite reruns
```

### ✨ Highlights
- **Safer classification decisions** — threshold handling, policy ranking, confidence math, and routing rules were hardened so malformed values, close-score ties, and conflicting signals do not quietly produce overconfident actions.
- **Sidecar auth and health flow are stronger** — local image embedding API-key handling is more robust, system-health alerting is clearer, and service-state transitions are easier for admins to follow.
- **Local Docker builds are now CPU-aware** — when you build from source locally, Classifarr can choose an AVX2, AVX, generic, or portable pgvector build before the read-only container starts.

### 🔧 Reliability Improvements
- Policy thresholds now enforce a valid prompt/auto ladder instead of relying on loose coercion and incidental ordering.
- Confidence scoring no longer lets neutral or missing evidence quietly inflate totals, and conflicting authoritative inputs now degrade conservatively.
- Read-only Docker runtimes no longer emit the pgvector filesystem write error on startup, and startup logs now report the real active variant.
- Regression coverage was expanded across policy math, routing, schema enforcement, and Docker-related startup behavior.

### 👥 Who This Helps
- **End users:** fewer incorrect auto-classifications when evidence is close, incomplete, or contradictory.
- **Operators/admins:** clearer sidecar troubleshooting, better health visibility, and a smoother local source-build path.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.45.3-beta
**Title: Learned classification evidence is unified and now has its own admin view**

> [!IMPORTANT]
> This release adds the `classification_evidence` table. The migration runs automatically on startup — no manual steps required.

### 🎉 What You'll Notice
- **A new Evidence screen is available to admins** — browse, filter, diagnose, and manage the classification evidence Classifarr has learned over time, all from one place.
- **Classification learning is more consistent** — all learned patterns now flow through one unified evidence store, so scoring and reinforcement behave the same way regardless of how a pattern was discovered.
- **Embedding and classification work respects AI availability** — when an AI provider is unavailable or busy, classification tasks pause cleanly instead of queuing up failed attempts.

### 📊 Quick Visual
```text
v0.45.3-beta Snapshot
Evidence visibility     [██████████] new admin screen: search, filter, diagnose, purge
Learning consistency    [██████████] unified evidence store for all learned patterns
AI-gate reliability     [█████████░] clean pause during AI cooldowns, no queued failures
Code health             [█████████░] 35 lint warnings resolved, 0 npm vulnerabilities
```

### ✨ Highlights
- **Evidence admin screen** — operators can see what Classifarr has learned, filter by library or scope, run diagnostics, and trigger decay/promote/purge operations directly from the UI.
- **Classification evidence unified** — `learning_patterns` and `discovered_patterns` are backfilled into a single `classification_evidence` table, making pattern scoring and reinforcement deterministic and auditable.
- **AI and embedding resilience** — embedding lock-contention is handled as deferred `PROVIDER_BUSY` behavior, and classification tasks no longer dequeue during AI cooldown windows.

### 🔧 Reliability Improvements
- PolicyEngine no longer short-circuits on learned patterns; all evidence is now scored through `scoreRelatedEvidence()` for consistent results.
- Backup and restore now include `classification_evidence` rows with automatic library ID remapping.
- Evidence summaries flow into AI prompts and clarification question payloads for better classification context.
- 35 ESLint warnings eliminated and 0 npm vulnerabilities confirmed across server and client.

### 👥 Who This Helps
- **End users:** classification learns more consistently and is less likely to give divergent results over time.
- **Operators/admins:** new Evidence screen gives direct visibility into what Classifarr has learned and tools to correct or tune that learning.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.45.2-beta
**Title: Maintenance is quieter, upgrades are cleaner, and release safety is stronger**

### 🎉 What You'll Notice
- **Routine updates should show up in fewer, cleaner PRs** — Dependabot now watches the repo on a schedule and groups related updates together instead of trickling in as one-off maintenance noise.
- **Build and release infrastructure is more predictable** — the app, CI, and container images now target a current Node 24 baseline with tighter image and workflow pinning.
- **Frontend and repo tooling are more current** — the client lint/test stack and shared npm dependencies were refreshed so routine upgrades are less likely to pile up into one large migration later.

### 📊 Quick Visual
```text
v0.45.2-beta Snapshot
Update automation          [██████████] grouped Dependabot PRs, weekly cadence
Release safety             [██████████] workflow SHAs pinned, stricter CI defaults
Runtime freshness          [█████████░] current Node 24 baseline and pinned images
Operator effort            [█████████░] less manual dependency drift to manage
```

### ✨ Highlights
- **Dependency maintenance is now automated instead of ad hoc** — GitHub Actions plus the root, client, and server npm manifests are all covered by scheduled Dependabot updates.
- **Workflow supply-chain posture is tighter** — GitHub-hosted and third-party actions now use immutable full-length commit SHAs instead of floating tags.
- **The frontend tooling stack is current again** — Vue/Vite test and lint dependencies, plus the client ESLint stack, were refreshed to the current baseline.
- **Maintenance expectations are documented in the repo** — there is now a dedicated maintenance policy covering update cadence, verification expectations, and version/runtime guidance.

### 🔧 Reliability Improvements
- CI now uses lockfile-based npm caching and `npm ci` where a lockfile exists.
- Docker build/runtime stages are pinned to `node:24.14.1-alpine3.23`, and the CI Postgres service is pinned to `17.7-alpine3.23`.
- Trivy SARIF uploads now follow the current CodeQL v4 action path.
- Root, client, and server direct npm dependencies are aligned on the latest safe baseline currently in use by the repo.

### 👥 Who This Helps
- **End users:** fewer chances of large, disruptive maintenance jumps and more predictable release quality over time.
- **Operators/admins:** lower routine maintenance overhead, clearer update policy, and better workflow provenance.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.45.1-beta
**Title: Embeddings are calmer, RAG is cleaner, and release checks are stricter**

### 🎉 What You'll Notice
- **Embedding outages no longer spam retries for days** — when your local or cloud embedding provider goes offline, Classifarr now pauses embedding work and waits for recovery instead of repeatedly hammering the same failed path.
- **RAG settings and status are easier to trust** — text/image model choices, backfill controls, and health reporting now flow through one modern API shape instead of a mix of older route patterns.
- **Frontend quality checks are stronger before release** — the Vue client now has first-class ESLint coverage, so dead imports, stale helpers, and similar issues are caught before shipping.

### 📊 Quick Visual
```text
v0.45.1-beta Snapshot
Embedding resilience        [██████████] shared cooldowns, cleaner recovery, less noise
RAG API clarity             [█████████░] canonical routes, shared status/config contracts
Frontend verification       [█████████░] client lint joins tests, coverage, and Docker checks
Upgrade effort              [██████████] safe migrations, no manual schema work
```

### ✨ Highlights
- **Embedding recovery is now coordinated across the app** — shared availability state, smarter cooldowns, and provider-aware probes stop repeated retry storms when Ollama or a cloud embedding endpoint is unavailable.
- **The RAG surface is simpler to operate** — status, model metadata, and backfill controls were consolidated behind the current route contract, and the old transition routes were removed instead of being kept alive forever.
- **The RAG backend is easier to maintain** — the oversized route module was split into focused helpers for backfill, status, diagnostics, operations, and model metadata, with direct helper-level coverage added.
- **Client API usage is cleaner and more consistent** — the remaining direct `fetch('/api/...')` holdouts and old queue-era aliases were replaced with named shared helpers.

### 🔧 Reliability Improvements
- The dead embedding retry queue is gone from both runtime behavior and the live schema.
- Embedding breaker ownership now lives in one place, reducing double-counted failures and split same-mode behavior.
- Dependency overrides now pin the patched transitive versions needed to clear current audit findings.
- Client lint now runs in the normal root and CI verification flow alongside the existing server checks.

### 👥 Who This Helps
- **End users:** fewer embedding stalls turning into endless background noise, and more consistent RAG behavior once providers come back online.
- **Operators/admins:** cleaner backfill/status visibility, fewer stale APIs to reason about, and stronger release gates before a build goes out.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.45.0-beta
**Title: Classification gets smarter, policies get honest, and second-pass finally has a scoreboard**

### 🎉 What You'll Notice
- **Custom presets are now real policy inputs** — you can attach your own presets to any policy just like built-in ones, and the migration backfills your existing custom presets automatically on upgrade.
- **Second-pass evaluation is now visible in Statistics** — a new section shows whether second-pass AI re-analysis is actually reducing corrections and retries across 7/30/90-day windows so you can decide whether it is worth running.
- **History drill-down now shows the full story** — individual classification rows surface whether a second pass ran, what it decided, and any follow-up correction/retry that happened afterward, all in one place.
- **Classification uses the right AI provider** — cloud providers (OpenAI, Gemini, OpenRouter, LiteLLM) now actually handle classification instead of silently falling back to Ollama.
- **Policy combination modes now actually work** — `best_match`, `average`, `weighted_average`, and `require_all` are now real runtime behavior, not cosmetic saved fields.
- **Policy weight editing now matches the runtime again** — the profile score component reappears in the advanced weight editor so the "100%" total is honest.
- **Sessions die on restart by design** — non-remember-me sessions are now immediately invalidated when the server restarts, as intended.
- **Bearer tokens win over stale cookies** — API scripts and Swagger tools stop getting blocked by an expired browser cookie when they send a valid `Authorization` header.

### 📊 Quick Visual
```text
v0.45.0-beta Snapshot
Classification reliability  [██████████] retry lineage, provider routing, second-pass
Policy correctness          [██████████] combination modes, weights, preset inputs
Operator visibility         [█████████░] second-pass scoreboard, history drill-down
Security posture            [██████████] auth hardening, session control, CORS
Upgrade effort              [█████████░] one migration (custom-preset backfill, auto-applied)
```

### ✨ Highlights
- **New: Second-Pass Evaluation in Statistics** — cohort cards for baseline vs pass2-ran vs pass2-adopted, with correction/retry rates per cohort and maturity-aware per-linked-outcome breakdowns so newer data does not look misleadingly clean.
- **New: Custom presets attach to policies** — migration `20260321_134500` backfills your existing custom presets into the shared catalog so the policy builder shows them alongside built-ins. A new "My Presets" label distinguishes them from system content.
- **Classification retry now carries its history forward** — retry lineage (media requests, webhook audit, source library) is preserved through retry and correction cycles instead of being erased when an item is requeued.
- **Second-pass conflict detection now actually blocks adoption** — when pass2 retrieval still shows a cross-library conflict, the candidate is rejected rather than logged as advisory metadata while still switching libraries.
- **Backfill modes now cooperate instead of stepping on each other** — manual, idle, and scheduled backfill coordinate through a shared advisory lock so they do not compete over the same pending embeddings.

### 🔧 Reliability Improvements
- Full library syncs now prune media/collection rows that disappeared from the remote server so stale cache entries stop appearing in reconciliation.
- Manual RAG backfill pause/resume now reacquires the advisory lock before processing resumes, and manual backfill start handling now goes through the same lock-aware lifecycle.
- Queue bulk actions now surface actual database failures instead of returning a misleading zero-count success.
- Startup circular dependency between the scheduler and queue service removed — `refillQueue is not a function` on first scheduler run is gone.
- CORS no longer reflects arbitrary origins when no allowlist is configured.
- Refresh token rotation no longer strands sessions when persistence fails mid-request.
- Very low-confidence policy matches now correctly fall back to manual review instead of being surfaced as guided selection.
- Pending policy questions are flagged as stale when their policy/library context changed after generation (carried forward from v0.44.2c).

### 👥 Who This Helps
- **End users:** classification is more accurate end-to-end — right AI provider, honest policy weights, working combination modes, and a second-pass that actually blocks bad adoptions.
- **Operators/admins:** second-pass scoreboard in Statistics, custom presets as real policy attachments, and session/auth behavior that matches the documented intent.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details including all service/file references, test additions, and migration details.

---

## v0.44.2c-beta
**Title: Smarter classification pacing and clearer setup state**

### 🎉 What You'll Notice
- **Active classification runs no longer overlap each other** — the queue now waits for the current classification process to finish before starting the next one, which prevents overlapping policy-question generation without blocking multiple pending questions.
- **Command Center stays truthful about queue state** — pending manual decisions no longer make the worker look paused, so you can have multiple policy questions open without the UI implying the queue is blocked.
- **Image embeddings no longer look broken when they are just not set up yet** — draft or effectively-disabled image embedding setups are shown as setup-pending instead of surfacing as a red system outage.

### 📊 Quick Visual
```text
v0.44.2c-beta Snapshot
Classification pacing       [██████████] one active classification at a time
Operator visibility         [█████████░] queue state and stale-question signals stay truthful
Image setup clarity         [█████████░] draft configs no longer look like outages
Upgrade effort              [██████████] safe for fresh and existing installs
```

### ✨ Highlights
- **Queued classification work now waits only for active classification processing** — the worker serializes active classification execution without treating `awaiting_decision` items as blockers, so multiple policy questions can exist at once.
- **Stale policy questions are flagged before you confirm them** — when policies, libraries, or preset attachments changed after a question was generated, Command Center now tells you to retry classification first.
- **Malformed one-option `CLARIFY` payloads fail safe** — the AI parser now converts them into deterministic contract violations instead of letting half-valid option sets drift into unstable behavior.

### 🔧 Reliability Improvements
- Duplicate/stale resolve clicks are treated as idempotent or explicit `409` paths instead of noisy internal failures.
- Image embedding health now distinguishes `disabled`, `not configured`, and truly unhealthy states.
- Queue stats now reserve `classificationPaused` for actual dispatch-check failures instead of normal pending-review state.

### 👥 Who This Helps
- **End users:** fewer overlapping active classification runs without losing the ability to work through multiple policy questions.
- **Operators/admins:** more truthful queue/worker visibility and less misleading system-health noise during image-embedding setup.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.44.2b-beta
**Title: Manual resolution fixes that actually complete cleanly**

### 🎉 What You'll Notice
- **Pending-question fixes are safer again** — choosing a library from a policy question now avoids a post-release database bind mismatch that could stop the confirmation from completing.
- **Manual corrections are more predictable** — the same clarification flow now has tighter test coverage around the exact SQL path used in production.
- **Regression risk is lower for this path** — the test suite now checks the full successful resolution flow instead of only mocked happy-path outcomes.

### 📊 Quick Visual
```text
v0.44.2b-beta Snapshot
Manual resolution stability  [██████████] bind mismatch removed
SQL path coverage            [█████████░] full resolve flow validated
Upgrade effort               [██████████] drop-in fix for existing installs
```

### ✨ Highlights
- **The `genre_pattern` learning step now uses the right bind lists for both update and insert queries** — this fixes the production-only failure that appeared when a real PostgreSQL connection enforced placeholder counts.
- **Clarification tests are stricter than before** — the suite now validates query placeholder counts during a full successful resolution transaction so similar mistakes are caught before release.

### 🔧 Reliability Improvements
- No schema migration required.
- Safe for both new installs and upgraded installs.
- Targets the exact production path that failed without broad behavior changes.

### 👥 Who This Helps
- **End users:** fewer failed manual resolutions when correcting a pending classification.
- **Operators/admins:** less risk of a release passing mocks but failing against real PostgreSQL.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.44.2a-beta
**Title: Safer manual fixes and a queue that stays fast under load**

### 🎉 What You'll Notice
- **Manual classification fixes are more reliable** — choosing the right library from a pending question now avoids a wider set of stale-row, duplicate-learning, and invalid-selection failures.
- **Queue stats stay faster as enrichment volume grows** — Classifarr no longer has to scan a mountain of finished enrichment tasks just to count live classification work.
- **Restarts recover more cleanly on busy servers** — finished queue history is trimmed more aggressively by default so high-volume installs do not keep drifting back to an oversized queue table.

### 📊 Quick Visual
```text
v0.44.2a-beta Snapshot
Manual resolution safety    [██████████] stale/invalid/conflicting paths hardened
Queue stats responsiveness  [█████████░] live stats query optimized + indexed
Restart cleanup behavior    [█████████░] finished-row cap reduced automatically
Upgrade effort              [██████████] safe for existing and fresh installs
```

### ✨ Highlights
- **Pending resolutions now fail safe instead of failing late** — stale questions, invalid library picks, and malformed `generate_rule` payloads are rejected cleanly before they can turn into deeper database errors.
- **Concurrent confirmations are handled more safely** — genre-learning writes now serialize per library/media/genre so two confirmations cannot race into duplicate learning rows.
- **Queue history is kept under tighter control by default** — the built-in finished-row cap drops from 50,000 to 10,000, which is a better fit for installs dominated by `metadata_enrichment` traffic.

### 🔧 Reliability Improvements
- Added an automatic `task_queue (task_type, status)` index for the live dashboard stats path.
- Reworked queue stats to use a filtered aggregate instead of grouping and sorting all classification rows.
- Kept the queue fix upgrade-safe: no manual SQL required for existing users.

### 👥 Who This Helps
- **End users:** fewer failures when resolving pending classification questions by hand.
- **Operators/admins:** less queue-table drift, fewer restart surprises, and more predictable dashboard performance on busy systems.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.44.2-beta
**Title: More trustworthy classifications, even when metadata arrives messy**

### 🎉 What You'll Notice
- **Manual choices are safer** — selecting the correct library from a classification question no longer trips a database typing error.
- **Classification stays consistent across more media sources** — mixed metadata formats from providers now resolve the same way instead of confusing different parts of the app.
- **The release version finally matches everywhere** — the app UI and package versions now agree on `0.44.2-beta`.

### 📊 Quick Visual
```text
v0.44.2-beta Snapshot
Manual-choice reliability   [██████████] pending-question resolution hardened
Metadata consistency        [██████████] mixed shapes normalized app-wide
Pattern/learning accuracy   [█████████░] fewer silent false negatives
Release consistency         [██████████] root/client/server versions aligned
```

### ✨ Highlights
- **Metadata is normalized once, then reused everywhere** — Classifarr now treats genres, keywords, tags, and collections consistently whether they arrive as plain strings, named objects, or JSON-style arrays from external providers.
- **Secondary paths now agree with the classifier** — queue refill, prompts, pattern mining, feedback analysis, profiles, embeddings, and question resolution all use the same normalization rules.
- **Bad request payloads fail cleanly** — invalid classification IDs or library IDs are now rejected early instead of surfacing as deeper service/database errors.

### 🔧 Reliability Improvements
- Fixed the PostgreSQL `$3` parameter typing error when confirming a pending classification into another library.
- Removed a broad class of silent false negatives where pattern discovery, matching, or prompt generation used different metadata parsing logic.
- Added repo-level guardrails so future server changes cannot casually reintroduce raw metadata parsing patterns.

### 👥 Who This Helps
- **End users:** fewer confusing failures when answering manual classification questions.
- **Operators/admins:** more stable behavior across different providers and older records with inconsistent metadata shapes.

### 📚 Want Technical Details?
See `CHANGELOG.md` for full technical details.

---

## v0.44.1a.beta
**Title: Honest preset suggestions, safer upgrades, and clearer policy questions**

> [!IMPORTANT]
> If you are upgrading an older install, Classifarr may automatically remove only legacy-incompatible preset attachments and ask you to reapply corrected presets. Fresh installs or servers with no affected presets will not see any banner or cleanup notice.

### 🎉 What You'll Notice
- **Preset suggestions are more trustworthy** — suggested presets no longer get inflated scores from meaningless word matches like `and` matching `Scandinavian`.
- **Policy questions are more honest** — when Classifarr is unsure, it now keeps the top-ranked library as the lead choice instead of centering the prompt on a lower-ranked conflict.
- **Upgrades are safer for existing policies** — only the narrow bucket of legacy-incompatible language/regional attachments is auto-removed, and only when they would be misleading under the new runtime model.

### 📊 Quick Visual
```text
v0.44.1a.beta Impact Snapshot
Preset suggestion honesty   [██████████] misleading substring scores removed
Prompt truthfulness         [██████████] top-ranked option stays first
Upgrade safety              [█████████░] targeted auto-drop, not a blanket reset
Fresh install cleanliness   [██████████] no banner or audit row when nothing changed
```

### ✨ Highlights
- **Language and regional presets are advisory by default** — they can influence score, but they no longer act like hidden routing rules unless you explicitly set them to `Strict`.
- **Malformed AI prose fails safe** — if the model ignores the response contract, Classifarr now falls back to deterministic clarification instead of inventing a confident destination from narrative text.
- **The policy builder explains what changed after upgrade** — if a legacy-incompatible preset was auto-dropped, the Policies UI shows a dismissible banner so operators know to reapply corrected presets.

### 🔧 Reliability Improvements
- Clarification options now preserve actual candidate ranking order.
- Multi-language conflicts are rendered honestly instead of collapsing to a single language label.
- Automatic preset cleanup is one-time, logged, and silent on fresh installs or untouched configs.
- Local production-like verification confirmed the migration applies once, writes no audit row when nothing is dropped, and leaves new installations clean.

### 👥 Who This Helps
- **End users:** fewer nonsense classification questions and more understandable prompts when the AI is uncertain.
- **Operators/admins:** safer preset semantics, explicit strict/advisory controls, and a cleaner upgrade path for older policy setups.

### 📚 Want Technical Details?
See `CHANGELOG.md` and `docs/implementation_plan_preset_semantics_and_suggestion_scoring.md`.

---

## v0.44.1-beta
**Title: Crash-free Discord, sessions that stick, and AI questions that always show up**

### 🎉 What You'll Notice
- **Discord buttons no longer leave "This interaction failed"** — slow Radarr/Sonarr responses occasionally pushed past Discord's 3-second deadline, crashing the bot process. All buttons now acknowledge instantly and complete in the background.
- **Logged-in sessions stay logged in** — expired access tokens were silently returning a hard-rejection code instead of triggering a silent refresh, so even a valid 30-day "Remember Me" session could drop unexpectedly after 15 minutes of inactivity.
- **AI clarification questions always appear** — the CLARIFY format now uses numbered options (same as all other AI response types), closing the loophole where hallucinated library names silently vanished.
- **Metadata enrichment no longer spins indefinitely** — a missing field caused every item without OMDb data to be re-queued on every cycle; fixed.

### 📊 Quick Visual
```text
v0.44.1-beta Patch Snapshot
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
