# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [October 2026 v0.49.3 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.3.md) | [October 2026 v0.49.2 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.2.md) | [October 2026 through v0.49.0](docs/changelog/CHANGELOG-2026-10-releases-through-0.49.0.md) | [October 2026 v0.49.1 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.1.md) | [October 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-10-pre-release.md) | [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Fixed

- **Purpose authority consistency** — Use the same declaration-provenance checks
  in specialized destination evidence and policy API projections. Inferred
  template or profile rules retain ranking and comparison roles without being
  presented as declared purpose or receiving specialized declared-purpose proof.
  Preserve native storage authority, explicit constraints and fresh learned-route
  checks; this does not rewrite saved policies or establish an accuracy rate.

### Changed

- **Server lint tooling** — Locally implement the reviewed updates from PR #572:
  pin `eslint-plugin-n` 18.5.0 and `knip` 6.42.1, retaining install-script policy
  and overrides. No provider PR merge or release is included.

### Security

- **Required next-release remediation** — Block the next release until npm's
  bundled `ip-address` finding is fixed and verified across local, CI and Docker
  tooling. The maintainer's acceptance applies only to v0.49.3-beta.
- **Runtime parser follow-up** — The existing `body-parser` 2.3.0 and `qs`
  6.16.0 audit findings remain before and after the lint-tooling update. Prioritize
  patched overrides and isolated HTTP regression checks before the next release;
  see the [tooling review](docs/architecture/server-tooling-pr572-outcome.md).

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
