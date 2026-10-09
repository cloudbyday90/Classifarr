# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [October 2026 v0.49.1 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.1.md) | [October 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-10-pre-release.md) | [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Fixed

- **Evaluation visibility** — Command Center separates completed policy replay
  from saved comparison coverage and AI-capture configuration. Unsupported
  selections, missing responses, disabled capture and stale results now have
  distinct explanations. Current-run backfill scan progress, queued work and a
  saved checkpoint reference explain inventory waits; viewing the summary does
  not start AI work or change routing, quotas or memory safeguards. Collapsed
  console guidance explains how to inspect and deliberately configure optional
  AI-response capture without changing deployment templates. A read-only provider
  diagnostic distinguishes ambiguous model identities and other inspection failures
  before enabling capture, with specific guidance for Ollama's converted-model
  listing issue, retaining model verification and quota safeguards. Operator
  guidance separates reserved calls, published responses and saved comparisons,
  with explicit trial cleanup and unchanged resource admission during replay.
- **Independent policy evaluation** — Offline replay rebuilds supported
  inferred-only library purposes from held-out training folds, preserving
  declared constraints and excluding tested items. Versioned results distinguish
  the new experiment from older coverage; live policies and AI budgets are unchanged.
- **Evaluation test isolation** — Database fixtures include current inventory
  readiness relations, restoring integration coverage without weakening runtime checks.

## [v0.49.1-beta] - 2026-10-08

**TL;DR:** Lower temporary memory costs for library comparisons, clearer
memory-pressure diagnostics and recovery, a working RAG statistics dashboard,
and updated runtime networking and development tooling. Memory safeguards,
classification rules and compatibility boundaries remain intact.

The [complete development record](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.1.md)
preserves the original Unreleased entries, consolidated on 2026-10-08.

### Added

- **Memory-pressure diagnostics** — Comparison pauses and recovery share a
  reference, exact admission budgets, refresh-stage measurements and recent
  completed-cycle comparisons. Reports contain bounded aggregate context,
  not automatic heap dumps or a claim that one sample proves a leak.
- **Isolated memory investigation** — Synthetic catalog studies profile complete
  refresh cycles, workers, snapshots, caches and real comparison consumers under
  concurrent import/metadata work. Opt-in allocation and natural-GC studies
  distinguish live data, runtime page pools and container residency, retaining
  inconclusive results without forcing collection or changing production policy.

### Changed

- **Comparison memory use** — Bounded snapshot decoding and streamed warm
  preparation, cache revalidation and publication verification avoid extra full
  vector maps. Earlier snapshot release and less temporary fingerprint,
  normalization and centroid storage preserve exact numeric validation,
  fresh-snapshot checks, cancellation and publication safeguards.
- **Runtime configuration and HTTP protection** — Updated environment loading
  honors false-valued options; rate limiting avoids disabled-debug allocations.
  Environment precedence, authentication quotas, client-IP boundaries, retry
  headers and fail-closed behavior remain unchanged.
- **Frontend and developer tooling** — Align build/test pins with supported
  parent versions; update CSS parsing, bundling and unused-code analysis with
  executable parser, file-access and entry-point regressions. Node 24.21.0 and
  npm 12.2.0 requirements remain unchanged; intentional dependency holds remain
  documented rather than bypassed.
- **CI and release verification** — Refresh immutable setup/artifact action pins
  without changing permissions or approval gates. Provider quota tests account
  for UTC midnight; queue-vacuum and restore-admission fixtures observe actual
  contention and database-session exit while retaining retry and exclusion rules.

### Fixed

- **Comparison readiness and retries** — Check current-model description-cache
  completeness before loading vectors and report actionable coverage gaps.
  Temporary resource deferrals no longer accumulate fitting-failure cooldowns;
  ordinary retrieval remains available while optional comparison work waits.
- **Statistics & Analytics** — Restore the RAG & Embeddings dashboard's API
  response handling, including error and retry behavior.
- **API documentation** — Preserve valid whitespace-only YAML examples so schema
  annotations do not disappear, while retaining malformed-input and merge limits.
- **Runtime networking** — Updated WebSocket/Engine.IO transport dependencies
  preserve connections after invalid close requests, bound heartbeat extensions
  and enforce compression negotiation.

### Security

- **IP parsing boundaries** — Reject oversized reverse-address input early
  while preserving IPv4/IPv6 rate-limit behavior. Memory limits, recovery
  ownership checks and the separate database privilege-hardening boundary
  are not relaxed.

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
