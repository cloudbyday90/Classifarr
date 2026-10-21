# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [October 2026 v0.49.2 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.2.md) | [October 2026 through v0.49.0](docs/changelog/CHANGELOG-2026-10-releases-through-0.49.0.md) | [October 2026 v0.49.1 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.1.md) | [October 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-10-pre-release.md) | [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

- Correct specific-VM SID and unconnected-adapter validation in the study VM
  creator, retaining strict target checks and exercising the real validators in tests.

- Restore Hyper-V's local machine identity inside the restricted study-VM child
  process without forwarding caller-provided hostnames or private environment data.

- Inspect hidden Windows parent folders correctly during study VM preflight,
  without changing folder attributes, permissions or existing-target safeguards.

- Recognize the reviewed Hyper-V parent create rule without trusting all VMs,
  and create private study folders with protected permissions from the start.
  Preserve existing-target refusal and leave shared parent permissions unchanged.

- Keep ordinary Windows PowerShell module-loading progress from obscuring study
  VM creation results, while retaining strict error handling and no automatic retry.

- Add an explicit administrator-run creator for a new, powered-off study VM,
  with reviewed local storage, fixed resources, restricted new directories and
  no automatic retries, existing-resource adoption or network/power operations.

- Check on-demand study VM startup/shutdown prerequisites and private UUIDv7
  handoff records with bounded read-only ESM tools. Keep authentication, real VM
  operations and study readiness explicitly unverified.

- Patch redirect-header handling in root/client dependencies and test both actual
  installed copies without changing the server transport or installation policy.

- Model on-demand study VM ownership, cancellation, bounded drain and graceful
  shutdown with simulation-only ESM tooling. Real VM operations remain disabled.

- Prepare a dedicated local Hyper-V study environment with a fixed VM profile,
  administrator setup guide and bounded read-only prerequisite checks. No VM
  provisioning, study execution or production changes are performed.

- Add an isolated sustained archiving on/off comparison with matched workloads,
  bounded minute-level latency evidence and strict treatment-specific recovery checks;
  retain completed correctness evidence when host changes invalidate timing.

- Guard local archiver timing studies with bounded host lifecycle observations;
  stop on interference after verified cleanup while retaining completed restore evidence.

- Update server lint tooling without changing lint rules or installation safeguards.

- Add a bounded local archiver pressure study with matched varied history, explicit
  accounting availability, repeated real restores and unchanged resource limits.

- Update isolated PostgreSQL test tooling, retaining strict installation policy
  and the reviewed HTTP-client security patches.

- Measure private catalog connections and observed transaction ages in the bounded
  synthetic co-load study, with coverage checks and verified idle cleanup.

- Update server configuration/validation dependencies and patch direct and
  Discord HTTP clients, retaining strict install policy and transport safeguards.

- Give catalog snapshots a private, bounded read-only connection and reuse base
  table hashes only within their transaction. Preserve byte-limit failure behavior,
  fresh safety checks and recovery budgets. Update client lint tooling.

- Add a source-bound local study of duplicate gateway reads within one active
  snapshot, with cancellation, lifetime and byte-limit checks. Keep production
  recovery unchanged. Update pinned Vue and Pinia runtime dependencies.

- Bind gateway scheduling and rotation rehearsals to sealed committed inputs,
  validate isolated verifier results and resource boundaries, and preserve all
  recovery checks and retry limits. Update pinned frontend test/build tooling.

- Bind gateway qualification and cleanup rehearsals to sealed committed inputs,
  validate child launch inputs and worker output, and verify exhaustive owned
  cleanup while preserving resource measurements and recovery limits. Update
  Markdown lint tooling without changing rules or production recovery behavior.

- Bind default gateway archive, catalog and retention rehearsals to sealed
  committed inputs, preserve UUID/receipt output, and verify all owned cleanup.
  Fix fresh-checkout gateway test setup and update pinned CodeQL/OSV actions
  without changing production recovery behavior or scanner permissions.

- Bind gateway inference, history, restore-memory and row-mode studies to committed
  fixture inputs and exact image identities. Keep test code read-only, separate
  generated results, and reject mismatches before fixture execution without
  changing production recovery behavior.

- Add a source-bound, isolated catalog row-mode comparison with counterbalanced
  memory/allocation measurements and exact integrity checks before considering
  runtime changes.

- Add an isolated repeated-large-restore memory study with separate natural and
  allocation-sampling lanes, strict receipt/source-preservation checks and bounded
  diagnostics. Keep production schedules, limits and verification unchanged.

- Keep gateway archive-history reads narrow before eligible full-row hashing,
  preserving complete metadata, fingerprints, limits and retry budgets. Add
  isolated query-plan/equivalence diagnostics and explicit fixed restore
  statements; repair CI contract expectations without relaxing security gates.

- Add a bounded 30-minute gateway load study with varied historical data,
  memory/cache and transaction observations, plus a separate real-restore rotation
  drill. Preserve production cadence, limits and retry rules; renew the narrowly
  reviewed v7 restore ownership records and pin the admission helper. Stop blocked
  studies automatically and retain explicitly incomplete observations.

- Keep gateway archive planning and export on one read-only snapshot while
  inference continues. Add a versioned catalog format that preserves its separate
  admission record, with explicit optional-schema upgrade and isolated restore
  verification; retain older archive formats and existing retry limits.

- Add an isolated gateway inference/archive soak with bounded synthetic HTTP
  traffic, latency and pre-claim timing, real scheduled exports and sandboxed
  restore checks. Preserve production limits, cooldowns and provider settings.

- Reduce gateway catalog dependency transfer by returning full job records only
  for required verified archives. Preserve complete history guards, file checks,
  restore verification and retention pins; add differential SQL and file-race
  rehearsals.

- Add bounded, local-only gateway catalog memory measurements and matched baseline
  rehearsals, separating observed process/cache usage from lifetime container peaks
  without changing production limits, retries or archive verification.

- Bound gateway archive-history reads before nested metadata reaches Node, with
  explicit resource-limit diagnostics and unchanged retry/protection rules. Add
  isolated catalog load and process-interruption qualification at deployed limits.

- Add optional automatic gateway recovery-catalog scheduling with UUIDv7 jobs,
  shared retry/storage limits, and isolated restore verification. Keep historical
  records and protected copies; release old file dependencies only after verified
  replacements. Existing deployments and live-history cleanup remain unchanged.

- Add a separate, UUIDv7-backed gateway catalog-retention registry with shared-file
  protection and restart-safe snapshot rotation. Preserve audit history and retry
  limits; automatic catalog scheduling and production activation remain disabled.

- Add verification-only capture and isolated restoration of gateway maintenance
  history alongside its matching inference snapshot, preserving retry state and
  checking required recovery files. Live scheduling and recovery remain unchanged.

- Restore optional gateway archives from a bounded, verified private copy, and
  add executable recovery-scheduling checks for preserved retry limits and
  backup feedback loops. Maintenance-catalog capture remains disabled.

- Document maintenance-catalog recovery risks and verification requirements,
  including matching snapshots, preserved retry state and isolated restores.
  This research update does not activate recovery or archive expiry.

- Add optional bounded gateway-history cleanup with fresh record checks, protected
  recovery copies, persistent retry limits and atomic completion records. Preserve
  inference counters and archive verification; existing deployments stay unchanged.

- Protect paired, restore-verified gateway recovery archives from rotation, with
  restart-safe publication and bounded second-copy creation. Preserve retry and
  storage limits; protection expiry remains disabled.

- Add exact, bounded cleanup-candidate evidence to automatic gateway archives
  and independently verify it during isolated restore; preserve legacy archives,
  retry limits and the prohibition on automatic live-history deletion.

- Bound gateway archive candidate selection before fetching record fingerprints
  to avoid query timeouts on large histories without weakening resource limits.

- Stabilize gateway archive fingerprints across database row ordering while
  preserving existing archive retry budgets and cooldowns.

- Add isolated gateway archive capacity and interruption rehearsals that check
  deployed resource limits, preserved retry counters and safe copy rotation;
  keep live-history deletion and existing deployment behavior unchanged.

- Add optional automatic online gateway archives with persistent UUIDv7 jobs,
  bounded retries and storage, isolated restore verification, and verified-copy
  rotation; leave live history, inference safeguards and existing deployments unchanged.

- Add the repository-local grill-me planning workflow for future features and
  changes, with pinned upstream instructions and its required grilling skill.

- Automatically assess optional Ollama gateway history at startup and on a bounded
  schedule, reporting capacity pressure, protected records and stale checks without
  page visits, provider calls, manual purge controls or changes to retry limits.

- Add archive-bound Ollama history review plans with exact request references,
  bounded record fingerprints and drift checks before future retention cleanup;
  keep deletion disabled and preserve existing archive verification.

- Add an offline, read-only Ollama gateway archive and retention report with
  time-based UUIDv7 references, private integrity-checked backups and isolated
  restore verification; preserve uncertain work, attempt limits and all history.

- Exercise optional Ollama gateway routing through a real isolated application,
  including authenticated history, bounded outages and preserved records across
  container replacement, without enabling routing on existing installations.

- Add an administrator-only Ollama gateway history view with task filtering,
  installation-scoped records and durable UUIDv7 completion receipts; retain
  unknown outcomes without replaying work or changing shared Ollama routing.

- Link optional gateway work to its originating Classifarr queue task and attempt
  using bounded diagnostic references, preserving concurrent-task isolation and
  interrupted records without changing retry authority or shared Ollama routing.

- Authenticate optional gateway HTTPS upstreams with pinned TLS identity and
  time-based UUIDv7 evidence recorded before dispatch; preserve uncertain work
  without enabling automatic provider recovery.

- Identify gateway-managed Classifarr work with unique request references and
  optional private fingerprints; keep unrelated shared Ollama activity outside
  Classifarr's task and recovery records.

- Add a reviewed, one-shot Docker provider stop with time-based UUIDv7 audit
  records; preserve interrupted work and attempts without automatic recovery
  or changes to shared Ollama.

- Preserve an optional gateway's configured provider container and start reference
  with each admitted request using time-based UUIDv7 records; retain uncertain
  work and legacy history without claiming automatic recovery is safe.

- Add an optional read-only Docker provider assessment with pinned container
  identity and bounded diagnostics; automatic recovery remains disabled.

- Add offline administrator-reviewed gateway recovery with time-based UUIDv7
  audit receipts, a durable maintenance hold and explicit resume; preserve
  uncertain request history, attempts and cooldowns without replaying work.

- Recover gateway slots cancelled before dispatch or after verified completion,
  preserving attempts, cooldowns and genuinely uncertain requests.

- Add opt-in application-wide Ollama gateway startup, verified TLS transport,
  and fail-closed shutdown without changing default routing or saved AI consent.

### Documentation

- **Shared Ollama planning** — Documented coordination options, transport coverage
  and restart-safety requirements for multiple Classifarr installations. This is
  a proposal only; no shared gateway or runtime behavior is enabled.

### Added

- **Scoped gateway application routing** — Ollama generation, embeddings, health
  checks, verification, studies and warming can use one explicitly bound gateway
  owner. Closing or replacing it cancels work without direct fallback or resetting
  attempts. Local-only testing; existing installations remain unconfigured.

- **Shared gateway provider context** — Generation, verification, embeddings,
  inspection and warming can share one bound client and cancellation lifetime.
  Warming uses normal admission and attempt accounting; invalid vectors cannot
  clear uncertain work. Direct routing remains unchanged pending activation.

- **Gateway credential rotation** — The optional local gateway can reload scoped
  credentials without restarting unaffected callers. Revocation cancels affected
  requests while preserving uncertain work and attempt history. Invalid reloads
  stop safely; production routing and shared Ollama remain unchanged.

- **Gateway generation integration** — Added explicit gateway support to the
  shared generation and saved-verification clients, with bound model checks,
  cancellation and strict completion rules. Live routing remains unchanged;
  this integration is for local testing, not production activation.

- **Gateway streaming and study clients** — Added bounded, authenticated streaming
  with durable completion before the final response, plus explicit gateway support
  for local study clients. Existing installations keep direct routing; uncertain
  requests remain blocked and memory safeguards are unchanged.

- **Optional Ollama gateway prototype** — Added a separately started, authenticated
  gateway for local-only testing of shared-provider admission, foreground priority
  and restart-safe uncertainty handling. Its dedicated ledger uses time-based
  UUIDv7 identifiers. It does not reroute existing clients, enable inference,
  change memory safeguards or deploy anything to Unraid.

- **Background AI evaluation** — Administrators can choose Off, When idle, or a
  daily UTC window in Command Center, with a request safety limit instead of
  token-budget calculations. Settings survive restarts; foreground work and
  configuration changes cancel local capture waits without resetting attempts
  or cooldowns. Memory safeguards remain unchanged. Controls apply to one
  installation, not every application using a shared Ollama server.

- **Classification recovery** — Command Center can check a failed movie or TV
  task's saved TMDb ID without retrying or remapping it, distinguish missing
  records from provider failures, and retain current check details for support.
  Eligible existing and new missing-record failures receive durable, spaced
  checks and can resume their original unrouted task once if that same record
  returns. Checks are bounded and cancellable, and reject stale results; no ID
  guessing, exhausted-budget reset or source-library change is performed. Explicit
  checks also compare saved external IDs when the record is missing, showing a
  candidate for review or the evidence gap. Administrators can preview and confirm
  a supported replacement with fresh evidence, retain a durable repair receipt,
  then separately retry the task without resetting its budget. Supported legacy
  and nested TMDb declarations are repaired together without losing request
  context. Administrators can also explicitly select up to five reviewed repairs
  for an atomic, restart-safe retry without extending approval to other requests.
  Read-only per-item readiness explains blocked repairs before selection, with
  current safety checks still enforced when submitting a retry.
  Repaired tasks remain excluded from automatic recovery and generic Retry All;
  original webhook evidence stays intact.

### Fixed

- Optional gateway archive maintenance now reads compact job history and validates
  full recovery evidence one record at a time, keeping large protected archive
  sets within the existing worker memory budget without relaxing cleanup checks.

- **AI readiness** — Missing first-time Ollama verification stays pending through
  busy periods and gets staggered background opportunities without an open page.
  Configuration-specific waiting reasons survive restart; status refresh and
  actual test times are distinct. Existing results are not automatically retested,
  and inventory, memory and ownership safeguards remain unchanged.
- **Classification identity and diagnostics** — Classification, webhook intake
  and failed-task checks consistently interpret supported legacy and nested IDs,
  reject conflicting declarations, and preserve original source evidence. Broader
  repair backfill remains gated. Metadata failure reports retain the typed lookup,
  safe provider outcome and shared reference; queue outcomes distinguish stopped
  retries from exhausted budgets without claiming a record is permanently gone.
- **Recovery testing** — Shutdown and queue-recovery drills retain safe failure
  diagnostics in CI, distinguish scenario failures from cleanup failures, and
  verify temporary resources are gone without weakening ownership checks.

## [v0.49.2-beta] - 2026-10-13

**TL;DR:** Review and recover unresolved media identities without rearranging your
libraries, understand why evaluation or background work is waiting, and see
health results that reflect the current settings. Database diagnostics,
bounded recovery, and safer local rebuilds improve operation without relaxing
ownership, memory, quota or routing safeguards.

The [complete development record](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.2.md)
preserves the original Unreleased entries, consolidated on 2026-10-13.

### Added

- **Media identity recovery** — Library-agnostic, administrator-reviewed mappings
  preserve Plex, Jellyfin and Emby grouping across whole works, seasons and
  individual episodes. Fresh provider checks, typed candidate lookup and
  read-only identity audits explain conflicting or missing IDs; metadata alone
  is not identity proof. Incomplete groups remain unresolved, and changed or
  revoked approvals are rechecked before owned sync/backfill can use them.
- **Mixed-media and scoped evidence** — Reviewed movie exceptions preserve TV
  placement without teaching that movies belong in TV libraries. Season-scoped
  descriptions support typed retrieval and optional vectors without inventing
  a parent identity or whole-work comparison. Upgrades never approve mappings
  or modify source media automatically.
- **Database and resource diagnostics** — Bounded startup, shutdown and runtime
  records correlate database readiness, timeouts, cancellation and supervisor
  events. Synthetic profiling follows description preparation/query plans,
  concurrent locks, workers, snapshots and caches across complete refresh cycles;
  measurements distinguish process, container and kernel accounting. This is
  investigation tooling, not a production heap dump or a leak-free guarantee.

### Changed

- **System health and information** — Concise system information separates
  pgvector startup compatibility from live database readiness. Health cards and
  tooltips share current status, check times and cadence; inactive, unconfigured,
  unknown and overdue states are distinct. Saved-settings changes invalidate old
  results, while unrelated usage counters do not.
- **Provider checks and recovery** — AI, media-server, Radarr/Sonarr, TMDb and
  OMDb checks validate current configuration and bounded responses instead of
  equating configuration with health. Concurrent probes are shared and stale
  completions rejected. OMDb health and TLS recovery share credential-specific
  quotas/pacing; persisted waits survive restart, and verified recent lookups
  retain their original timestamp instead of manufacturing fresh health.
- **Settings and web navigation** — Connection messages, configuration warnings
  and accessible dismissible notifications use clearer wording. Protected Vue
  navigation retains encoded return paths and legacy query/hash behavior;
  pgvector notices tolerate unavailable browser storage without claiming that
  startup compatibility establishes database health.
- **Local deployment and tooling** — Smart rebuilds retain and verify the exact
  running image before replacing a mutable tag, without taking the service down
  first. Image retention does not replace an app-data/database backup or prove
  downgrade compatibility. Build, test, dependency-analysis and Node 24 type
  tooling are refreshed with aligned browser/coverage versions; TypeScript major
  pins remain deliberate and Dependabot can propose eligible updates.

### Fixed

- **Classification recovery** — Metadata failures distinguish confirmed missing
  TMDb records from retryable conditions, with actionable Command Center context.
  Upgrade backfill repairs known legacy failure context without guessing an
  identity or replaying routing. Stale-work recovery atomically hands off queue
  and history state with bounded provenance instead of admitting duplicate work.
- **Library comparisons and description refresh** — Scheduler failures retain
  the failing database stage, error and incident timing. Matching comparison
  incidents close only after verified recovery under the same database ownership,
  model and configuration, including across restarts; historical/manual records
  stay untouched. Incomplete description vectors and memory pressure still defer
  optional comparisons rather than weakening admission checks.
- **Embeddings and inventory** — Coverage counts distinct classifications across
  overlapping libraries, applies deterministic artwork eligibility, and excludes
  inactive/conflicting evidence. Unresolved-ID diagnostics explain why provider
  metadata may exist while safe identity recovery remains blocked.
- **Evaluation visibility and independence** — Command Center distinguishes policy
  replay, saved comparison coverage, optional AI capture, current backfill progress
  and checkpoint references. Missing responses, stale results and ambiguous
  Ollama model identities have specific guidance; viewing diagnostics starts no
  AI work. Offline inferred-purpose replay uses held-out training folds and
  versioned results without altering live policies or AI budgets.
- **HTTP and configuration runtime** — Express response framing, downloads,
  request limits and sanitized errors retain regression coverage; oversized
  validation collections are rejected before parsing. Undefined optional
  environment-loader settings preserve defaults, quiet mode and precedence.

### Security

- **Scoped diagnostic access** — Short-lived local evaluation tokens now retain
  their endpoint restrictions on APIs that also support API keys. Normal user
  sessions and independently authorized API keys keep their existing behavior.
- **CI registry access and supply chain** — Trusted main-branch database checks use
  a dedicated read-only Docker Hub pull token, bounded retries, logout and
  sanitized diagnostics. PR jobs remain secret-free; authentication and quota
  failures block validation. CodeQL action pins and least-privilege permissions
  are updated without sharing publication credentials with verification jobs.
  Manual Docker Hub retention cleanup now requires an explicit cleanup dispatch
  from a v-prefixed tag; branches, including v-prefixed branch names, cannot run it.
- **Recovery boundaries** — Mapping approval remains explicit, complete and
  scoped; source metadata, library placement and training authority stay separate.
  Existing database ownership, memory, quota, credential and no-route safeguards
  remain enforced. No recovery warning authorizes deleting storage or keys.

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
