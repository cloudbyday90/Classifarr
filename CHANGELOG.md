# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [October 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-10-pre-release.md) | [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Diagnostics

- Add isolated, repeatable cold comparison allocation profiles to distinguish
  construction costs from retained memory before tuning; production memory
  safeguards and refresh behavior are unchanged.
  Add opt-in allocation windows for concurrent build and warm-verification phases,
  correlated with real scheduled attempts and validated without saving raw profiles.
  Separate cached-vector parsing, validation and transport attribution, with
  bounded numeric batch counters that distinguish refresh work from overlap.
  Add a bounded, offline vector-validation reproduction across parsed and cloned
  input histories, with semantic regression coverage; no validator relaxation.

### Fixed

- **Inventory comparison:** reduce temporary allocation during snapshot fingerprinting
  with bounded binary hashing and isolate cached-vector validation from unrelated
  provider/worker array feedback while retaining all numeric checks.
  Check description-cache completeness before loading
  vectors and provide actionable coverage diagnostics. Whole-refresh retention
  profiling covers workers, snapshots and caches. Release comparison snapshots and
  fitting inputs before subsequent phases; memory safeguards remain unchanged.
  Read and decode representative/comparison vectors in bounded batches within
  one consistent snapshot, with cancellation checks between batches.
  Reuse exactly revalidated normalized vectors within comparison builds to avoid
  duplicate arrays while preserving corruption checks and numerical results.
  Reduce normalization callback allocations with shared dense numeric arithmetic,
  preserving exact results, signed zero and validation on every cache lookup.
  End representative fitting-snapshot and staged-callback lifetimes before fresh
  verification, retaining both reads and all publication safeguards.
  Stream comparison verification vectors in bounded batches while preserving exact
  source fingerprints and independent fresh-snapshot publication checks.
  Stream representative-profile verification without a second full vector map,
  preserving partial coverage, fresh observation metadata and backfill priorities.
  Revalidate unchanged cached comparison models without materializing a full vector
  snapshot, retaining both independent reads and invalidation safeguards.
  Stream warm representative preparation and centroid validation without retaining
  a full vector map; preserve corruption, coverage and fresh-publication checks.
  Separate bounded resource-deferral retries from representative and comparison fitting failures
  so temporary memory pressure does not accumulate long failure cooldowns.
- **Statistics & Analytics:** restore the RAG & Embeddings dashboard by consuming
  the unwrapped API response consistently, with regression coverage for errors and retry.
- **CI reliability:** verify provider-study quota reservations per UTC day so runs
  crossing midnight retain strict accounting without failing on a valid daily reset.

### Changed

- **Memory diagnostics:** add build-phase measurements, kernel memory high-water
  readings and real-time refresh-cycle profiling to the isolated synthetic study.
  Add matched control/concurrent ingestion-and-metadata scenarios with shared
  admission, overlap checks, sanitized failure traces and five-minute natural
  post-stop observation.
  Add natural scheduled-recovery checks that retain live refreshers and record
  exact admission budgets through deferral, recovery and revalidation.
  Exercise scheduled comparison refreshes alongside real import/metadata services
  in one isolated application catalog, separating workload completion from
  evidence of recovery after memory pressure.
  Preserve bounded numeric phase peaks when a study fails, without retaining raw payloads.
  Attribute resident memory to the study process, PostgreSQL and container cache,
  alongside committed V8 heap; retain explicit gaps when measurements are unavailable.
  Add opt-in, sanitized major-GC page-pool tracing to distinguish reusable runtime
  pages from live data across complete catalog refreshes.
  Include real shadow-comparison and neighborhood-readiness consumers in the
  isolated catalog study, with preparation/publication memory boundaries and
  verified warm-cycle completion and shutdown.
  Production admission limits and garbage-collection behavior are unchanged.

## [v0.49.0-beta] - 2026-10-05

**TL;DR:** Safer movie/TV imports and recovery, richer library learning and
classification review, and more reliable routing, notifications and restores.
The runtime, user interface, security controls and release checks have also
been modernized.

This is a system-level summary of the changes since v0.48.4-beta. The
[complete development record](docs/changelog/CHANGELOG-2026-10-pre-release.md)
preserves every original entry, including intermediate designs and PR references.
The development record was consolidated on 2026-10-05 without rewriting it.

### Added

- **Command Center and operational health** — Clear library recovery actions,
  metadata/profile progress, AI readiness and evaluation status, with optional
  details and bounded, read-only refreshes. Migration failures include sanitized
  diagnostic trails and GitHub reporting guidance for unknown cases.
- **Policy authoring and maintenance** — Revision-checked library-purpose
  declarations, grouped draft review, overlap/cohort previews and evidence
  digests. Inferred library traits remain suggestions, not declared policy;
  policy-change follow-up and calibration reports cannot automatically tune rules.
- **Quality evaluation and independent review** — Private, reproducible movie/TV
  studies compare policy, retrieval, library profiles and AI on frozen, held-out
  evidence. Independent-review packets, consensus, correction reports and bounded
  recurring evaluation retain missing evidence; AI capture is opt-in and budgeted.
  Experimental results do not grant routing authority or prove overall accuracy.
- **On-demand maintenance and database health** — Bounded background workers
  assess queue vacuum needs and repair eligible image-vector indexes when idle
  and within resource budgets. Read-only health summaries and durable attempt
  limits distinguish waiting, recovery and operator action without template changes.

### Changed

- **Plex, Jellyfin and Emby discovery/imports** — Shared outage recovery,
  validated pagination and resumable full scans preserve partial inventory.
  Pruning requires complete enumeration; missing libraries are retained and
  can be archived reversibly after review, not deleted by discovery.
- **Legacy import recovery and ownership** — Existing movie/TV libraries can
  recover automatically once database safeguards reject unmodified older writers.
  Recovery preserves inventory and resumes full import plus metadata backfill;
  optional embedding/AI work does not hold completion open. Missing safeguards
  produce specific repair guidance instead of unsafe takeover.
- **Metadata enrichment and source identity** — TMDb, OMDb and web-search work
  share durable cooldowns, quota accounting and credential-aware recovery.
  Fair, bounded backfill preserves valid metadata, rejects conflicting or
  cross-media identities, and provides reviewed ID repair with audit receipts.
- **Library observations and learned profiles** — Automatic metadata,
  description and production-company backfill feed revision-checked profiles,
  including eligible source-only items without TMDb IDs. Coverage, freshness,
  common traits and overlap reports distinguish missing data from measured absence.
- **Description, semantic and image retrieval** — Reuse bounded, current vector
  caches and learned context while excluding self-matches and stale evidence.
  Cancellable preparation recovers in the background with specific failure
  reasons; ordinary retrieval remains available when optional context is deferred.
- **Classification and AI readiness** — Learned library fit and description
  evidence improve bounded candidate comparisons. Structured proposals may abstain;
  automatic decisions still require fresh qualifying evidence, policy thresholds
  and existing confirmation rules. Saved Ollama readiness backfills on older
  installs, and provider outages pause AI retries without blocking deterministic work.
- **Queues, scheduling and resource control** — Durable scan-to-backfill handoff,
  per-claim write guards and atomic completion survive crashes and reject stale
  workers. Shared memory admission, non-overlapping tasks, enqueue wakeups and
  restart-safe retry timing bound work without dropping queued items.
- **Radarr/Sonarr routing** — Save destination decisions before provider calls,
  verify identity and destination before success, and reconcile uncertain outcomes
  through bounded read-only checks. Interrupted or ambiguous adds are not blindly
  replayed; optional background verification retains durable cooldowns.
- **Reclassification and file moves** — Restart-safe batches retain progress,
  pause/cancel intent and journaled movie/TV moves. Recovery reconciles exact move
  receipts rather than repeating file copies or deletions.
- **Discord notifications and interactions** — Durable send intent, delivery
  receipts and shared rate-limit recovery prevent unsafe retries. Administrators
  can review uncertain delivery; cancellation, transfer limits and cleanup bound
  requests while interaction replies remain independent.
- **Configuration backups and restores** — Consistent snapshots preserve
  destination mappings, preferences and optional learned evidence across changed
  IDs. Dedicated restore mode excludes normal workers, serializes attempts and
  blocks normal startup after incomplete verification until explicit recovery.
- **Docker, Unraid and Synology deployment** — Updated Compose/CA examples,
  optional media mounts, shutdown guidance and modern Synology compatibility
  preserve existing app-data, keys and legacy settings. Compatible maintenance
  works without a template change; full privilege separation and automatic
  protected-identity conversion remain gated, not generally activated.
- **Frontend and accessibility** — Calmer review summaries and progressive
  disclosure replace dense diagnostics. Shared dialogs, tabs, forms, tag editors
  and credential controls improve labels, keyboard/focus behavior, nested-modal
  handling, narrow layouts and stale-request cleanup.
- **Runtime and dependency tooling** — Refresh the Node 24.21.0 / Alpine 3.24.2
  image, npm/npx 12.2.0, Vue ecosystem, server libraries and test/build tools.
  Replace the affected Markdown/watch dependency chain with a bounded ESM lint
  runner and native Node watching; retain reviewed installers and lockfiles.
- **Architecture and developer workflows** — Continue modular ESM services,
  centralized client APIs and stricter Vue/API contracts. Dependency, recovery
  and release-evidence skills/runbooks document validation and authority boundaries;
  tests use bounded workers, isolated lint-contract scheduling and cross-platform
  process handling without relaxing assertions or coverage gates.
- **CI, upgrades and release assurance** — Verify fresh installs, pinned-release
  schema replay, crash/restore/routing recovery and resource limits on isolated
  images. Release evidence is bound to source and image digest, with native
  architecture checks; GHCR/Docker Hub `latest` promotion waits for verified
  publication. Published notes include the reviewed release narrative alongside
  verification evidence. Local tests and synthetic studies are not release approval.

### Removed

- **Unsupported music intake** — Remove unreleased music discovery and skip
  unsupported sync/webhook classification work; supported ingestion and recovery
  remain scoped to movies and TV.

### Fixed

- **History, feedback and learning** — Preserve original decisions, candidate
  evidence, typed media identities and recording times through retries and cleanup.
  Feedback and suggestions commit atomically, reject duplicate/conflicting
  submissions and stale application, and avoid treating unknown outcomes as accuracy.
- **Statistics and coverage reporting** — Correct denominators, percentage-point
  comparisons, UTC windows and incomplete-sample handling. Fair, incremental
  library sampling and focused queries improve large-library coverage without
  hiding gaps or conflating imported observations with evaluated outcomes.
- **Settings and preset mutations** — Recover lost creation/confirmation responses
  through saved receipts instead of automatic resubmission; preserve drafts and
  reject stale responses. Provider saves/restores consolidate equivalent legacy
  duplicates while retaining credentials, quotas and active configuration.
- **PostgreSQL startup, migrations and shutdown** — Bound readiness probes,
  validate process identity, coordinate clean shutdown and keep fresh/upgrade
  schemas consistent. Disabled import safeguards have a reviewed repair path
  requiring a verified private backup; changed definitions or insufficient
  privileges remain blocked rather than replaying an applied migration.
- **Transport and runtime reliability** — Repair custom TLS dispatch, broken
  database-client disposal, log delivery, retry timestamp precision and container
  heap-limit detection. Cancelled or incomplete transfers remain failures, not
  empty successful provider responses.

### Security

- **Administrative access and data minimization** — Restrict detailed Error Logs,
  exports and recovery actions to current administrators. Bound diagnostics,
  retention and aggregate reports; sensitive library evidence stays limited to
  trusted local AI endpoints, with aggregate-only context for other providers.
  Unexpected production server errors hide internal messages, and unknown API
  paths return a generic JSON 404 instead of falling through to the UI.
  Access logs, request diagnostics and API-key audit endpoints omit URL query
  values; legacy webhook query-key authentication remains compatible.
- **Network and supply-chain hardening** — Enforce response-size/deadline limits,
  cancellation and vector validation; retain TLS verification by default.
  Update vulnerable runtime/tooling dependencies and pgvector to 0.8.7
  (CVE-2026-103484), with portable builds, integrity checks and pinned CI actions.
  Patch proxy-address trust, indexed source-map bounds and CSS selector parsing
  with targeted compatibility and resource-work regressions.
  Update Markdown math and TOML tooling against inherited-option trust bypass
  and repeated parser scans, preserving lint and dependency diagnostics.
- **Recovery security boundary** — Compatibility safeguards contain unmodified
  legacy writers, not a database superuser deliberately bypassing them. Stronger
  OS/database privilege isolation remains separate work; recovery never silently
  regenerates keys, bypasses migration checks or authorizes media routing.

## [v0.48.4-beta] - 2026-08-29

### Added

- **Saved-model matrix coverage** — The Ollama compatibility matrix now explicitly states whether the saved primary model was among eligible locally installed models, with safe next-step guidance that does not expose provider configuration or change strict-verification authority.
- **Ollama compatibility matrix** — AI Settings can now run a bounded, serial, media-free strict-output check across up to six server-discovered local Ollama model builds, returning only advisory allow-listed results for the current response.
- **Ollama verification test history** — AI Settings now presents a fixed 30-day aggregate of saved Ollama verification-test outcomes, distinguishing intermittent results from recurring strict-output or availability failures without retaining configuration or test content.
- **Tested local Ollama verification** — AI Settings can now run a bounded, media-free JSON-Schema capability test for the saved primary Ollama configuration, present its current state, and admit only current successful results to candidate-bound verification.
- **Ollama runtime mismatch monitoring** — Classifarr now counts bounded strict-verification model-digest mismatches and records their last-observed time without storing provider text, media data, prompts, responses, or digests.
- **Ollama runtime operations panel** — AI Settings now provides an administrator-only, cached aggregate view of strict-Ollama digest mismatch count and last-observed time, without exposing model identity, endpoint details, errors, or event history.
- **Model-change remediation guidance** — When strict Ollama verification is invalidated by a model change, AI Settings now presents a contextual, administrator-initiated re-test of the saved configuration with aggregate-only runtime context.
- **Queue admission diagnostics** — The Command Center now separately explains unavailable classification-worker capacity and a saved Ollama model change that blocks only strict candidate verification, with an explicit path to AI Settings.
- **Queue decision-path telemetry** — When classification work is waiting, the Command Center now shows a cached, aggregate-only 24-hour summary of deterministic policy routes, AI attempts, AI-unavailable retries, and strict-verification abstentions.
- **Queue telemetry operational acceptance** — The integration suite now verifies the real queue telemetry path with transaction-scoped synthetic decision records that are always rolled back.
- **Queue telemetry HTTP acceptance** — The live-stats route now has transaction-scoped acceptance coverage that rejects unauthenticated requests before the queue service runs and confirms the authenticated response remains aggregate-only.

### Fixed

- **One-step Ollama verification** — Saving a changed primary Ollama target now automatically runs its bounded strict-verification test, visibly separates an unsaved selection from saved capability, and removes the redundant second save confirmation.
- **Qwen strict verification** — Fixed the documented top-level Ollama `think: false` control for bounded strict JSON-schema probes, allowing reasoning-model verification results to be validated from the response channel without changing normal classification behavior.
- **Ollama matrix type safety** — The server typecheck now validates the compatibility matrix's saved-configuration, probe, selection, and report contracts before CI can publish a release candidate.
- **Ollama matrix capacity selection** — Compatibility checks now keep the explicitly saved model but skip oversized, unknown-size, and clearly embedding-only alternative models before they can consume local inference resources; AI Settings shows only an aggregate skipped count.
- **Ollama verification fidelity** — Ollama generation now sends decoding controls in the documented runtime-options object, and AI Settings preserves and clearly reports completed-but-ineligible strict-verification results instead of showing them as untested or generically successful.
- **Ollama strict-output delivery** — Streamed Ollama generation now forwards strict response schemas and verifies the tested model digest before candidate-bound verification runs.
- **Ollama verification recovery** — A model digest mismatch now revokes only the matching saved strict-verification capability, explains the required re-test in AI Settings, and recognizes a current tested primary Ollama path in remediation readiness.
- **CI validation** — Removed an unused runtime-summary singleton that caused the server Knip quality gate and its dependent release-acceptance readout to fail.
- **Schema snapshot validation** — Regenerated the authoritative PostgreSQL 18 schema snapshot so container validation remains stable after the PostgreSQL 18.6 image update.

### Security

- **Ollama matrix capacity boundary** — Alternative probes now require a server-discovered, bounded artifact size and reject clear embedding indicators; no model-size, family, target, or provider output is returned to the browser.
- **Saved-model coverage privacy** — Matrix configuration coverage is an independently allow-listed boolean with no returned host, configured model name, prompt, raw provider output, or automatic configuration change.
- **Ollama matrix resource boundary** — The manual compatibility matrix accepts no browser-selected provider target or model list, excludes cloud-tagged models, caps and serializes probes, requests model unload, rate-limits administrator actions, rejects concurrent runs, and neither persists output nor changes strict-verification authority.
- **Ollama history privacy boundary** — Saved-test trend data is limited to three fixed daily counters and timestamps, pruned after 30 days, served through a parameter-free administrator-only rate-limited endpoint, and never affects capability authority or routing.
- **Local verification fail-closed controls** — Strict Ollama authority is bound to an explicit administrator test, current configuration fingerprint/revision, model digest, timeout-bounded preflight, and existing server-side candidate confirmation rules; fallbacks remain advisory.
- **Runtime re-tag containment** — A stale worker cannot invalidate a newer save or verification test, and a mismatch remains blocked even if runtime telemetry persistence is unavailable.
- **Runtime-observability access boundary** — The mismatch panel uses server-side administrator authorization, a dedicated post-authentication limiter, a parameterized fixed-dimension query, and an allow-listed response with no client-selected dimensions.
- **Ollama verification action boundary** — An administrator save of a changed primary target runs exactly one existing saved-target test; out-of-band runtime drift remains manually re-testable, and no path re-admits strict verification before a successful test.
- **Queue diagnostic privacy boundary** — Queue status exposes only fixed worker and strict-verification state IDs; it does not reveal provider configuration, model identity, digests, raw errors, media, or policy data.
- **Decision-path telemetry boundary** — Queue telemetry reads four fixed aggregate counters from existing history, is skipped without queued classifications, and never returns item, library, policy, provider, model, prompt, response, error, or decision identifiers.

### Changed

- **Ollama remediation guidance** — Added a safe, manual runbook for resolving compatibility-matrix outcomes through local inspection and explicit re-testing, without automatic pulls, deletions, provider targeting, or settings changes.
- **Client tooling** — Applied the locally tested dependency changes from open PR #520 (`@types/node`, ESLint, and `vue-tsc`); the pull request was not merged and no release was created.
- **Security automation** — Applied the locally tested pinned CodeQL Action update from open PR #518; the pull request was not merged and no release was created.

## [v0.48.3-beta] - 2026-08-28

### Changed

- **Second-pass candidate verification** — An adopted policy-recheck confirmation candidate now enters the same strict, candidate-bound AI verification admission path as a first-pass confirmation, while the policy engine remains the routing authority.
- **Client tooling** — Applied the Vite 8.2.2 development-dependency update from open PR #519 locally; no pull request was merged and no release was created.
- **Compatibility-policy maintenance** — Existing compatibility policies now provide a direct maintenance review action, and administrators can explicitly add a bounded library-profile purpose suggestion to an unsaved policy draft before normal review and save.
- **Release hygiene** — The product-language audit now recognizes the required fresh, empty `Unreleased` changelog section after a release is cut.

### Fixed

- **Policy recheck review safety** — AI-call budgets, resilience gates, and provider failures now retain the deterministic confirmation candidate for operator review rather than replacing it with an unrelated baseline result.

### Security

- **Verification boundary consistency** — Rechecked confirmation candidates use server-owned candidate binding, provider admission before generation, and bounded status-only outcomes.

## [v0.48.2-beta] - 2026-08-22

Detailed engineering history is retained in the [August 2026 release archive](docs/changelog/CHANGELOG-2026-08-releases.md).

### Added

- **Release evidence and provider-fault gates** — Tag publication now verifies bounded evidence provenance and a disposable provider-fault recovery receipt before publishing images or a GitHub release.
- **Local AI evaluation contract** — Reviewed fixtures, policy-context fingerprints, decision witnesses, and aggregate trend comparison make local classification evaluation reproducible without exposing raw local data.
- **Bounded policy maintenance** — Administrators can review purpose coverage, remediate unresolved policies, and safely resume an interrupted native-purpose change through narrow, receipt-backed controls.
- **Release and image assurance** — Added immutable image consumer smoke, release-attestation verification, installation-evidence assembly, and manifest-aware retention assessment.

### Changed

- **Policy-route delivery** — Split authoring, maintenance, and insight pages into independent production bundles and added a Chromium cold-load budget gate for every policy route.
- **Release metadata contract** — Package and lockfile versions, the UI label, README marker and badge, and top release-note heading now share a deterministic pre-tag validation.
- **AI evaluation access** — Local sweeps exchange narrowly scoped, short-lived tokens and preserve policy authority through direct and queued decision evaluation.
- **Toolchain maintenance** — Applied reviewed client/server dependency and pinned-workflow updates while retaining ESM, lint, test, coverage, and security gates.

### Fixed

- **Provider recovery safety** — Transient provider failures persist as retryable, no-route work rather than an unsafe destination decision.
- **Evaluation correctness** — Fixed scoped-route matching, API-key authentication, queued non-final grading, and temporary AI-settings ETag handling.
- **Policy and restore reliability** — Corrected native-purpose audit persistence, pending-decision replacement, backup/restore history protection, and schema-snapshot comparison noise.
- **Client test stability** — Isolated router initialization and bounded Vitest workers for reliable constrained-host test execution.

### Security

- **Policy and provider boundaries** — Preserved server-owned route authority, capability-gated AI verification, bounded recovery data, and explicit no-route behavior under provider failure.
- **Supply-chain verification** — Enforced provenance checks for release evidence and multi-architecture images before release publication.
- **Dependency remediation** — Updated audited client, server, and workflow dependencies, including current OSV and CodeQL action pins.
