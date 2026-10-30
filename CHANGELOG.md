# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [October 2026 v0.49.3 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.3.md) | [October 2026 v0.49.2 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.2.md) | [October 2026 through v0.49.0](docs/changelog/CHANGELOG-2026-10-releases-through-0.49.0.md) | [October 2026 v0.49.1 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.1.md) | [October 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-10-pre-release.md) | [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Added

- **Optional frozen policy context** — Add `--include-policy-context` to the
  private purpose-case CLI. Inspect complete retained policy pools with exact
  item/time/leader/proof binding, distinct raw and ranked scores, and explicit
  optional evidence gaps. Keep current report bytes and eligibility unchanged
  without the option. Bound combined read-only input before transfer and omit
  whole cases at the output ceiling. No routing or learning changes.

- **Private purpose disagreement cases** — Add the exclusive read-only evaluation
  CLI mode `--prospective-purpose-cases`. List bounded eligible cases with
  separately named frozen policy/choice, original/choice and policy/original
  comparisons, preserving recorded confirmation/change meaning and independent
  History-review original references, including BIGINT IDs. Share whole-window
  validation and holdouts with the unchanged aggregate; cap private numeric
  output at fifty cases / 1 MiB with omissions and evidence gaps. Disagreement
  does not establish error, accuracy or cause; routing and learning are unchanged.

- **Prospective purpose-choice cohort** — Freeze new live purpose matches in
  immutable policy capture v2 and atomically associate existing explicit choices
  with the retained policy leader or a commit-time evidence gap. Preserve event
  deduplication, source expiry and replay tombstones. Add the bounded private
  aggregate CLI mode `--prospective-purpose`, with separate action/reference
  meanings and explicit historical gaps. Legacy statistics, inventory cohorts,
  scores, routing and learning authority remain unchanged; agreement is not accuracy.

- **Frozen policy evaluation evidence** — Preserve new retained live policy
  evaluations in immutable History-bound child records: the complete compatible
  pool up to 64 candidates, final policy ranking, closed exclusions, and separate
  storage authority, purpose provenance and runtime admission. Expire payloads
  after thirty days while retaining tombstones; keep evidence outside portable
  backups. Extend the bounded private disagreement CLI with validated context
  and explicit gaps. Classification survives capture failures; cohort scoring,
  routing and learning remain unchanged. Historical intent is not reconstructed.

- **Private prospective disagreement report** — Add the explicit evaluation CLI
  mode `--prospective-disagreements`. Compare frozen original references and
  experimental rankings against validated assessments through shared cohort
  eligibility, preserving existing aggregate results and connected holdouts.
  Bound read-only inputs and private numeric/ID output; show missing historical
  intent/policy evidence, abstentions and display omissions explicitly. No new
  routing, learning, saved report, API/UI or scheduled job.

- **Explicit History feedback review** — Assess a preserved original automated
  destination through an active-administrator, ten-minute server reference.
  Atomically record one existing feedback/statistics transaction and frozen
  confirmation/change evidence, with stale-state rejection and scoped receipt
  recovery after a lost response or expiry. Keep legacy selections and historical
  gaps explicit. This assessment does not move media, reclassify, create policy
  rules or add learning authority; it does not establish classification accuracy.

- **Frozen feedback selection provenance** — Capture exact classification binding,
  selection action and the server shortlist reference in new feedback receipts.
  Protect provenance and replay clocks against replacement while preserving
  expiry and feedback tombstones. Audit v2 separates selection-only diagnostics
  from unknown legacy actions; neither becomes a frozen prospective
  confirmation/change label. Existing retrospective statistics, calibration,
  routing and learning behavior remain unchanged.

- **Automatic comparison evidence audit** — Independently inspect bounded retained
  evidence with existing scheduler ownership, resource admission, cancellation and
  backoff. Save only a replaceable aggregate and show it in administrator
  Evaluation progress through a protected read-only status API. Separate capture
  exclusions from overlapping observation diagnostics; withhold failed or stale
  counts even while presentation is paused. Historical recovery remains
  unassessed; placement does not become a label, and routing/learning are unchanged.

- **Prospective comparison provenance** — Freeze typed identity in new ranking
  captures and recheck it before persistence. Read canonical authorized choices
  and provably bound correction snapshots through strict, modular adapters.
  Preserve legacy gaps, unknown action kinds, unavailable conflicts and connected
  holdouts before separate confirmation/change scoring. Exact BIGINT IDs and
  bounded overflow aliases cannot select a favorable retry. Current placements
  do not become confirmed labels; routing and learning remain unchanged.

- **Frozen authorized-outcome evaluation** — Atomically retain prospective typed
  identity, destination, action and decision context for successful authorized
  operator choices. Shared evaluation readers deduplicate event aliases, separate
  confirmations from changes, reject conflicts and report historical evidence
  gaps. Database observation times, thirty-day expiry and replay guards prevent
  late receipts from refreshing old evidence. Routing and learning authority are
  unchanged; this does not establish classifier accuracy or repair past labels.

### Fixed

- **Verified purpose explanations** — Distinguish declared, inferred, mixed and
  unknown purpose on pending and library-comparison evidence cards. Require a
  bound, server-derived declared-rule match with existing specialized/conflict
  checks before showing declared support. Preserve actual card versions and
  neutral numeric labels; isolate legacy correction/statistics heuristics.
  Historical gaps, scores, routing and learning authority remain unchanged.

- **Purpose authority consistency** — Use the same declaration-provenance checks
  in specialized destination evidence and policy API projections. Inferred
  template or profile rules retain ranking and comparison roles without being
  presented as declared purpose or receiving specialized declared-purpose proof.
  Preserve native storage authority, explicit constraints and fresh learned-route
  checks; this does not rewrite saved policies or establish an accuracy rate.

### Changed

- **Client build tooling** — Locally implement randomly selected PR #570 with
  exact PostCSS 8.5.31 and Vite 8.3.5 pins and the reviewed coupled lock changes.
  Preserve install-script policy and overrides; verify client coverage, types,
  production build and real browser route/asset checks. No PR merge or release.
- **Pinned CI actions** — Locally implement PR #569's Docker Login 4.7.0 and
  CodeQL 4.39.1 updates with full commit SHAs. Update the existing promotion
  allowlist and security contract assertion while preserving permissions,
  publication/event gates and failure checks. No PR merge or release is included.
- **Server lint tooling** — Locally implement the reviewed updates from PR #572:
  pin `eslint-plugin-n` 18.5.0 and `knip` 6.42.1, retaining install-script policy
  and overrides. No provider PR merge or release is included.
- **Server environment tooling** — Locally implement randomly selected PR #571:
  pin `dotenv` 18.0.9 and cover the empty `DOTENV_PATH` CLI fix with isolated
  synthetic environment and precedence checks. No provider PR merge is included.

### Security

- **Required next-release remediation** — Block the next release until npm's
  bundled `ip-address` finding is fixed and verified across local, CI and Docker
  tooling. The maintainer's acceptance applies only to v0.49.3-beta.
- **Runtime parser remediation** — Pin `body-parser` 2.4.0 and `qs` 6.16.1 to
  address trailing-byte decoder crashes and comma-serialization coercion errors.
  Add isolated process probes and actual normal/restore HTTP compatibility
  checks, retaining decoded limits, CSRF and maintenance restrictions. The parser
  also adds upstream Zstandard support on the pinned Node runtime; see the
  [design](docs/architecture/runtime-parser-security-design.md).
- **Development dependency follow-up** — The full server audit retains the
  unpatched `deepmerge` advisory through Jest. No remote production path was
  established; avoid the audit-suggested unsupported Jest major downgrade.

## [v0.49.3-beta] - 2026-10-23

**TL;DR:** Check and repair missing media identities with explicit review, control
this installation's background AI work, and retain safer recovery diagnostics.
Optional Ollama gateway/history/archive tools expand without changing existing
routing. The Node security baseline and dependency/tooling checks are refreshed;
gateway activation, VM operations and unfinished timing studies remain separate.

The [complete development record](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.3.md)
preserves the original Unreleased entries, consolidated on 2026-10-23.

### Added

- **Classification recovery** — Command Center can check a failed movie or TV
  task's saved TMDb ID, preview and confirm a supported identity repair, retain a
  durable receipt, and separately retry up to five explicitly selected reviewed
  repairs atomically. Ordinary administrator sessions and fresh evidence are
  required; API keys cannot authorize repairs. Original source evidence and retry
  budgets survive, repaired tasks stay outside automatic recovery and Retry All,
  and older writers must be stopped before shared-database repairs.
- **Missing-record checks** — Eligible existing and new failures receive durable,
  spaced same-ID checks and one requeue if that original record returns. Checks
  are bounded and cancellable; no replacement guessing, remapping, exhausted
  budget reset or source-library change occurs.
- **Background AI controls** — Command Center offers Off, When idle and daily UTC
  windows with persistent request safety limits. Fresh installs remain off;
  upgrades preserve existing opt-in ceilings. Foreground work or setting changes
  cancel local waits, not necessarily dispatched provider work. Controls cover
  one installation, not every application using shared Ollama.
- **Optional Ollama gateway** — Explicitly configured generation, embeddings,
  verification, health, warming and streaming share admission and cancellation,
  durable UUIDv7 request/task history, credential rotation and an administrator
  history view. Uncertain work stays blocked without direct fallback or reset
  attempts; existing installations keep direct routing.
- **Optional gateway recovery tools** — Separate offline reports, reviewed
  maintenance holds/resume, bounded provider assessment and one-shot provider
  stop preserve uncertain work and attempts. These do not enable unattended
  restart/replay, expose Docker to the application or change shared Ollama.
- **Optional gateway archives** — Separately configured archive, catalog,
  scheduling and bounded history-cleanup services retain verified recovery
  copies, protected records, legacy formats, retry budgets and audit history.
  Ordinary application startup does not enable these services or delete history.

### Changed

- **Gateway resource handling** — Bound history queries before large metadata
  reaches Node, read full dependencies only when needed, reuse hashes only
  inside the same read-only snapshot, and verify recovery evidence one record
  at a time. Limits, fresh safety checks, restore verification and retry budgets
  remain enforced.
- **Synthetic qualification** — Source/image-bound archive, inference, restore,
  memory, transaction and rotation studies verify owned cleanup and preserve
  incomplete observations. Shared-host interference invalidates timing; the
  isolated four-arm archiving comparison remains unfinished. These tools do not
  establish production latency, memory-leak or AI-accuracy guarantees.
- **On-demand study VM preparation** — Fixed 4-vCPU / 8-GiB / 64-GiB Hyper-V
  planning, explicit administrator creation and bounded read-only checks use
  protected paths and stricter local identity, SID, adapter and capture guards.
  Startup/drain/shutdown remains modeled or disabled; no always-on service or
  usable study guest is claimed. Retained fixtures and consumed cleanup authority
  remain unresolved; file-only journals and simulations do not authorize retries.
- **Runtime and dependencies** — Source installs require Node 24.22.1 and
  npm/npx 12.2.1; the container base is digest-pinned Node 24.22.1 / Alpine 3.24.3.
  Refresh Vue/Pinia, configuration/validation and direct/Discord HTTP clients,
  PostgreSQL test tooling, browser/build/coverage, lint and Markdown tooling while
  preserving strict lifecycle-script decisions and deliberate compatibility pins.
- **Repository and CI** — Source-sealed fixtures, bounded shutdown/recovery
  diagnostics, complete preflight contracts and pinned scanner actions retain
  failure propagation, cleanup, coverage and least-privilege gates. Repository
  change planning now uses the documented grill-me workflow.

### Fixed

- **AI readiness** — First-time Ollama verification remains pending through busy
  periods and gets staggered background opportunities without an open page.
  Configuration-bound waits survive restart; status refresh is distinct from a
  real test, and existing results are not automatically retested.
- **Identity and failure diagnostics** — Supported legacy/nested media identities
  are normalized consistently and conflicting declarations rejected. Metadata
  failures retain typed lookup outcomes and safe support references; queue status
  distinguishes stopped retries from exhausted budgets without declaring a record
  permanently gone.
- **Representative refresh reporting** — Fixed failure stage/category and incident
  references survive scheduler logging without raw SQL/provider errors, endpoints,
  descriptions or vectors. Better attribution does not establish or repair the
  original provider failure, reset retries or authorize live recovery.

### Security

- **Dependency patches** — Patch the server IPv6 parser to `ip-address` 10.7.4
  and root/client redirect-header handling, retaining bounded real-package
  regressions, quota compatibility and unchanged proxy trust.
- **Residual npm finding** — npm 12.2.1 separately bundles affected
  `ip-address` 10.7.2. Application overrides do not patch that CLI copy; zero
  workspace audit findings do not establish an advisory-free production image.
  The maintainer accepted this finding for v0.49.3-beta only; remediation is
  required before the next release. Release handling remains recorded in the
  [release outcome](docs/architecture/release-0.49.3-beta-outcome.md).
- **Gateway deployment boundary** — Gateway use requires explicit credentials,
  TLS identity and network isolation appropriate to its deployment. Private
  upstream HTTP is supported only within its documented boundary; TLS alone
  does not establish isolation. No existing provider route is activated by upgrade.

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
