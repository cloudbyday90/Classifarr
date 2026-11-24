# Changelog Archive: October 2026 v0.49.3 Release

> Preserved verbatim from revision `9634c39418755ac882d67d3212e017910e7a29ae` on
> 2026-11-24. Historical relative links are interpreted from the repository root.

[Root changelog](../../CHANGELOG.md) | [Release outcome](../architecture/release-0.49.3-beta-outcome.md)

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
