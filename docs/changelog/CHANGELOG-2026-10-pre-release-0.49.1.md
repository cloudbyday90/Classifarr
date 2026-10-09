# Changelog Archive: October 2026 — v0.49.1-beta development

> Original Unreleased entries preserved verbatim on 2026-10-08 before
> system-level consolidation. Intermediate descriptions are historical records;
> the root changelog describes the final combined behavior.

## [Unreleased]

### Diagnostics

- **Memory-pressure reports:** correlate comparison pauses and recovery with a
  shared reference, exact admission budgets, refresh-stage readings and recent
  completed-cycle comparisons, without weakening memory safeguards or taking
  automatic heap dumps.

- Add isolated, repeatable cold comparison allocation profiles to distinguish
  construction costs from retained memory before tuning; production memory
  safeguards and refresh behavior are unchanged.
  Add opt-in allocation windows for concurrent build and warm-verification phases,
  correlated with real scheduled attempts and validated without saving raw profiles.
  Separate cached-vector parsing, validation and transport attribution, with
  bounded numeric batch counters that distinguish refresh work from overlap.
  Add a bounded, offline vector-validation reproduction across parsed and cloned
  input histories, with semantic regression coverage; no validator relaxation.
  Correlate post-stop model/cache weak-reference counts with natural major GC in
  an opt-in bounded study; distinguish collection evidence from an inconclusive
  timeout without forcing GC or changing production safeguards.
  Observe resident mapping categories through a bounded post-GC quiet window,
  without recording process addresses or changing allocation policy.
  Correlate those observations with natural major-GC traces and local page-pool
  readings, keeping ambiguous or missing evidence explicit.

### Fixed

- **Runtime networking:** update transport and IP-parsing dependencies to preserve
  usable connections after invalid close requests, bound heartbeat extensions,
  enforce compression negotiation and reject oversized reverse-address input
  early. Retain IPv4/IPv6 rate-limit boundaries and existing memory safeguards.
- **API documentation:** update YAML parsing so valid whitespace-only examples
  no longer cause schema annotations to disappear; retain malformed-input and
  merge-budget safeguards.
- **Inventory comparison:** reduce temporary allocation during snapshot fingerprinting
  and cached-vector validation without weakening numeric checks. Check
  description-cache completeness before loading vectors and provide actionable
  coverage diagnostics. Whole-refresh retention
  profiling covers workers, snapshots and caches. Release comparison snapshots and
  fitting inputs before subsequent phases; memory safeguards remain unchanged.
  Read and decode representative/comparison vectors in bounded batches within
  one consistent snapshot, with cancellation checks between batches.
  Reuse exactly revalidated normalized vectors within comparison builds to avoid
  duplicate arrays while preserving corruption checks and numerical results.
  Reduce normalization callback allocations with shared dense numeric arithmetic,
  preserving exact results, signed zero and validation on every cache lookup.
  Reduce temporary allocation during exact normalized-cache matching while
  retaining signed-zero, invalid-value and borrowed-output mutation checks.
  Reuse private representative-fingerprint byte storage instead of allocating it
  per vector, preserving exact v4 fingerprints and validation on every append.
  Validate representative centroids without temporary normalized-vector arrays,
  retaining exact arithmetic, injected normalizers and cancellation boundaries.
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
  Isolate queue-maintenance success fixtures from competing autovacuum and verify
  that skipped attempts retain their retry limits, with bounded failure diagnostics.
  Observe database session exit before restore-admission test transitions, with
  delayed-disconnect coverage; production restore exclusion remains unchanged.

### Changed

- **CI and release tooling:** refresh immutable Node-setup and artifact-transfer
  action pins, with regression checks for stale or floating references; preserve
  permissions, receipt identity checks and release approval gates.
- **Developer tooling:** improve unused-code and dependency detection with updated
  entry-point analysis and executable regression checks; existing quality gates
  and runtime safeguards are unchanged.
  Document pinned and transitive update gaps, intentional compatibility holds and
  separate runtime, frontend and CI upgrade priorities.
  Align frontend build/test dependency pins with their supported parent versions,
  update CSS parsing and bundling, and add executable file-access and parser
  regressions without relaxing install policies or production safeguards.
- **HTTP request protection:** update rate-limit middleware to avoid unnecessary
  debug allocations, with regression coverage for authentication quotas, retry
  headers, client-IP boundaries and fail-closed errors; limits are unchanged.
- **Runtime configuration:** update dotenv to preserve false-valued override/debug
  options correctly, with regression tests for environment precedence and quiet loading.
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
