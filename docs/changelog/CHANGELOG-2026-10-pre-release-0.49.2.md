# Changelog Archive: v0.49.2-beta development

> Original Unreleased entries preserved verbatim on 2026-10-13.
> The release-facing summary is in the root changelog; historical relative links
> below retain their original repository-root interpretation.

## [Unreleased]

### Changed

- **HTTP runtime** — Update Express response handling with regression coverage
  for valid response framing, downloads, request limits and sanitized errors.
  Refresh request validation to reject oversized collections before parsing their
  contents, retaining strict policy contracts and bounded client errors.
- **Web navigation** — Refresh Vue Router with regression coverage for protected
  navigation, encoded return links and legacy query/hash redirects.
- **Settings and notifications** — Preserve plain-text connection results alongside
  structured diagnostics, strengthen shared status/toast contracts, and name
  notification dismiss buttons for keyboard and assistive-technology users.
  Validate incomplete Arr configuration warnings, link only to the matching
  provider's settings, and discard responses that arrive after leaving the page.
  Make pgvector compatibility notices resilient to blocked browser storage and
  explain reported CPU/build constraints without promising a restart will fix them.
  Record pgvector startup reasons and scoped timestamps atomically, exposing
  current versus stale or mismatched evidence with specific, safe operator guidance.
  Separate pgvector startup compatibility from Database/RAG health and service
  totals; unknown or stale CPU evidence no longer becomes a healthy service.
  Make overall service-health summaries explicit about unknown and inactive
  services, and label retained results after failed checks instead of claiming
  current health. Expire cached health using actual check times and heartbeat
  cadence, showing overdue checks and specific refresh/clock/scheduler guidance.
  Distinguish failed configuration reads from absent settings, keeping unknown
  services visible with safe database/schema/access diagnostics and check references.
  Share overlapping health checks and reject results whose configuration changed
  during the check, preventing obsolete completions and stale aggregate results.
  Revalidate completed health caches in the background so committed configuration
  changes from other processes retire outdated results without extra provider probes.
  Ignore unrelated usage counters and cache timestamps when validating reviewed
  connection settings; retain credential, endpoint and active selection checks.
  Keep hover status current as health cards refresh.
  Correct AI/media-server probes to use current saved settings and authenticated,
  bounded reads. Failed connection-test results no longer appear healthy; cloud
  AI configuration is distinguished from a verified connection.
  Use one bounded Arr health request per instance, validate metadata-provider
  responses, and retain safe authentication/quota failure reasons without exposing
  provider data or changing richer settings-page connection tests.
  Include System-page OMDb health checks in the shared request budget and pacing,
  distinguishing skipped checks from provider outages without renewing old success.
  Apply the same budget and pacing to automatic OMDb SSL-recovery checks, rejecting
  stale credential results and retaining unfinished enrichment for retry.
  Share provider-requested waits from both OMDb probe paths with ordinary lookups,
  preserving cooldowns across restarts without applying old-key responses to new settings.
  Reuse briefly retained, verified OMDb lookups to avoid redundant health and SSL
  probes, preserving check times and discarding evidence after newer failures,
  overlapping requests or SSL pauses; current settings and request limits still apply.
  Keep database readiness and security safeguards unchanged.
  Simplify System Information to concise version, build and CPU facts, removing
  internal startup references and explanations while retaining actionable warnings.
- **Developer tooling** — Refresh Node 24 type declarations across frontend and
  backend and update dependency analysis, while preserving runtime versions,
  install restrictions and compatibility checks. Verify both uncached and cached
  analysis without weakening dependency rules.
  Preserve and verify exact rollback images before local Docker rebuilds and
  container replacement; failed builds leave the existing container in place.
  Keep database backups separate and reject missing or conflicting rollback evidence.
  Refresh Vue build and typechecking tools with positive and negative compiler
  contracts, retaining the supported Vue, TypeScript and Node runtime versions.
  Verify the installed Vue compiler API and exact lockfile alignment; retain the
  client TypeScript compatibility pin after reproducing the native-major blocker.
  Run the CSRF source contract before parallel UI tests without relaxing its checks.
  Refresh browser testing with matched Playwright and Chromium versions, and guard
  against dependency-chain drift while retaining runtime-aligned Node declarations.
  Keep frontend test and coverage tooling aligned and reject invalid test filters
  that previously could report success without running the intended checks.
  Add opt-in phase diagnostics for intermittent frontend test timeouts, retaining
  the original assertions, coverage, isolation and deadlines.
  Bound asynchronous source reads in the CSRF contract after diagnostics isolated
  blocking file I/O; preserve every scanned file and fail on unreadable sources.
  Align routine Node declaration update proposals with the deployed runtime major,
  retaining compatible updates, security-only eligibility and compatibility gates.
- **Security automation** — Refresh the shared CodeQL analysis and SARIF-upload
  action pins, preserving least-privilege permissions, scan coverage and failure
  gates with workflow regression checks.

### Added

- **Performance diagnostics** — Add an isolated, synthetic description-corpus
  profiler that separates client reads, preparation and database plans, samples
  owned-session waits, and verifies bounded concurrent reads and lock recovery.
  Reports retain only aggregates; production queries and safeguards are unchanged.
  Correct memory units in retry/profiling diagnostic containers and verify Docker
  plus kernel limits before fixture work, with cleanup checks after failures.
  Completed refresh-cycle reports now correlate cache occupancy, worker shutdown
  and memory reference points without changing application memory safeguards.
- **Catalog mapping and recovery** — Library-agnostic source/catalog checks and
  explicit administrator-approved whole-work or season mappings preserve Plex,
  Jellyfin and Emby grouping. Fresh, bounded evidence checks identify ambiguous,
  missing or reused episode IDs and distinguish catalog membership from identity
  approval. Owned library sync applies only complete verified mappings; partial
  mappings remain unresolved. Saved status, audit records and revocation separate
  approval from completion, and distinguish previously applied mappings being
  rechecked from repairs awaiting their first verification. Review shows the exact typed catalog works checked,
  actionable episode-level exclusions and durable, sanitized failure reasons;
  interrupted checks remain unconfirmed and cached-source failures retain cooldowns.
  On-demand candidate lookup explains declared-ID matches, missing records and
  other-scope results without guessing, selecting a draft or approving a mapping.
  A read-only identifier audit explains catalog agreement and remaining gaps;
  parent-ID agreement never substitutes for complete scope verification or consent.
  Mapping previews now combine fresh parent-ID and complete-scope findings in one
  rechecked report, exposing disagreement without granting automatic repair authority.
  Episode review distinguishes missing source identifiers from absent proposed
  catalog positions, with specific next steps and no guessed identity repairs.
  Explicit, human-confirmed episode mappings support missing IDs and alternate
  orders without changing the media server. Typed target review, separate consent,
  duplicate protection and source-change reapproval keep incomplete groups blocked.
  Review shows bounded source and catalog titles together, without treating titles
  as identity proof; changed review context requires a fresh confirmation.
  Reviewed standalone-movie exceptions preserve TV source grouping while keeping
  movie identities separate and excluded from TV-learning evidence.
  Season descriptions retain their typed scope for
  retrieval and optional vector backfill, without becoming arbitrary parent IDs
  or supplying whole-work-only comparison models. Existing conflicts are not
  automatically approved on upgrade; ownership and memory safeguards remain.
- **Container shutdown diagnostics** — Database liveness failures now include
  bounded stage timings, timeout and cancellation details, supervisor resource
  context, and a shared reference linking the last healthy check to recovery or
  shutdown. Ownership checks, deadlines and memory safeguards are unchanged.

### Fixed

- **Description refresh diagnostics** — Preserve bounded failure stages, database
  error categories, timings and shared incident references from background recovery
  through scheduler reports. Distinguish database cancellations from provider
  failures without exposing query contents or changing retry and memory safeguards.
- **Embedding inventory consistency** — Count each classification once across
  overlapping libraries and use one shared, deterministic artwork selection rule
  for statistics and backfill. Inactive or identity-conflicted inventory cannot
  supply fallback artwork; source grouping and unresolved identity safeguards
  remain unchanged.
- **Classification failure recovery** — Preserve safe metadata-failure categories,
  stop automatic retries for confirmed missing TMDb records, and explain the next
  check in Command Center. An upgrade backfill restores known failure-stage
  context on eligible legacy errors without changing identities or replaying work.
  Scheduled stale-decision recovery now commits a bounded queue/history handoff
  atomically, preserving task provenance and preventing partial or repeated
  admission without changing identities, routing consent or retry budgets.
- **Library identity recovery and diagnostics** — Independently verified catalog
  candidates can use exact alternative titles when the year and fresh source
  evidence agree, preserving retry and ownership safeguards. Unresolved-item
  details name the detected catalog provider and explain why artwork and descriptions do not establish a
  valid identity. Guidance distinguishes conflicting IDs from title/year checks
  and avoids rematching a correct title merely to clear a warning. Identity
  disagreements remain unresolved. An opt-in, read-only cross-reference diagnostic
  separates missing catalog mappings from contradictory matches, with bounded
  requests and aggregate-only IMDb/TVDB breakdowns. Missing series mappings and
  results for other media types do not authorize dropping an ID or rematching
  a correctly grouped series. Memory safeguards remain unchanged.
- **Runtime configuration** — Update environment loading so undefined optional
  settings preserve configured defaults and command-line quiet mode honors env
  files, while explicit options retain precedence.
- **Comparison incident tracking** — New comparison warnings close automatically
  after verified recovery, including across restarts when database ownership and
  the inspected configuration/model match. A bounded, atomic incident ledger
  retains original evidence and a recovery reference. Unrelated, manually resolved and
  historical warnings remain untouched; memory and completeness safeguards are unchanged.
- **CI image pulls** — Trusted main-branch tests use a dedicated Docker Hub
  read-only credential with automatic logout, bounded transient-login retries
  and sanitized connectivity diagnostics. Database checks compare Docker CLI
  and Testcontainers pulls without sharing publishing credentials or exposing
  secrets to PRs; quota and authentication failures remain blocking.
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
