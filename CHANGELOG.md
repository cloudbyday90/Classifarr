# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Changed

- Rehearse fresh installs, published upgrades and interrupted recovery across
  unchanged deployment profiles using one frozen candidate image, with bounded
  resource checks and fail-closed, source-bound release evidence.
- Track reviewed import recoveries through owned scan retries and verified
  metadata completion. Show concise progress and next steps, preserve unknown
  historical outcomes, and exclude optional AI jobs without new deployment settings.
- Stop automatic network/authentication retries for explicit import recovery
  confirmations; retain receipt lookup and operator-controlled same-request retry.
- Add on-demand, administrator-scoped import recovery history backed by retained
  server receipts, so recorded requests can be found after navigation or a lost
  response without restoring approval or automatically retrying recovery.
- Harden interrupted-import recovery reviews against stale previews and late
  responses after navigation. Lock confirmation during refresh and preserve
  recorded recovery receipts if updating the progress display fails.
- Cancel abandoned image-retrieval queue entries, retry waits, poster downloads
  and embedding requests. Preserve successful visual evidence and provider health,
  with safe active-capacity cleanup and reusable cancelled recovery probes.
- Cancel timed-out semantic retrieval in PostgreSQL through bounded read-only
  execution, with server deadlines and safe connection disposal. Preserve ranking
  and image evidence, and prevent late results from being reported as success.
- Repair provider integration fixtures for current configuration columns and
  historical migration dependencies without weakening CI release checks.
- Preserve classification status in semantic retrieval results. Measure the actual
  text-first, image-reranked query during isolated index repair and recovery,
  retaining image evidence and existing resource limits without pausing classification.
- Stop abandoned embedded image-index builds promptly by checking worker
  connections within the maintenance session, without deployment-template changes.
  Add isolated mixed-ingestion/retrieval and mid-build cancellation/recovery checks.
- Give larger embedded image-index repairs a fixed, memory-checked workspace
  only when ingestion and backfill are idle. Preserve execution deadlines and
  retry budgets, distinguish safe capacity waits from classified failures, and
  add an isolated larger-memory validation profile without template changes.
- Add a disposable image-index repair capacity study with realistic vector sizes,
  resource and database-wait measurements, interrupted-build recovery checks and
  explicit incomplete outcomes, without changing production maintenance limits.
- Show read-only image-search repair status in System, with verified index counts,
  live build activity, automatic retry budgets and a clear next action. Checking
  status does not start maintenance or reset recovery limits.
- Automatically queue bounded image-index repairs only when configured image
  search needs a missing or invalid index and ingestion/backfill is ready. Keep
  repair budgets across restarts and queue cleanup, and report invalid indexes
  as unavailable instead of treating their names as proof of health.
- Run deferred image-index jobs in bounded on-demand workers on embedded
  deployments, without saved-template changes. Preserve queue ownership, restore
  exclusion and interrupted-build recovery, with fixed inputs and confirmed cleanup.
- Activate bounded, on-demand queue maintenance through the embedded supervisor
  without deployment-template changes. Preserve ingestion/backfill waits,
  autovacuum-first admission and retry limits; explicitly retain current shared
  permissions while keeping separate-identity safeguards intact.
- Validate embedded startup settings and forced-user compatibility before account
  or database changes. Add image-only upgrade coverage for unchanged saved
  standard, Community Apps-style and custom-user deployments, retaining existing
  maintenance behavior without activating production identity separation.
- Add a fixed-capability queue maintenance handoff for restricted runtimes,
  with independent admission, protected retry budgets and bounded child cleanup.
  Validate it in the separate-identity rehearsal; production identity remains unchanged.
- Explain unsuccessful queue recovery with on-demand, bounded database
  diagnostics and a clear next step. Report possible blockers and incomplete
  visibility without exposing query/session details or expanding repair authority.
- Replace unconditional queue vacuuming with autovacuum-first maintenance and
  logged, criteria-based recovery. Persist observation, cooldown and attempt
  limits; wait for ingestion/backfill and verify bounded repairs before reporting
  completion. Add a fixed maintenance command without deployment-template changes.
- Bound deferred image-index maintenance with resource limits, queue ownership
  checks and interrupted-build recovery. Add a fixed one-shot maintenance command
  and separate-identity validation without changing deployment defaults.
- Add resumable offline database identity migration components and real legacy
  cold-copy/crash-recovery coverage, preserving original data and rejecting old
  application credentials in the candidate without changing installed databases.
- Protect packaged application and database extension code from runtime writes;
  validate and verify embedded account setup before changing data ownership.
  Add bounded supervisor maintenance handoff with separate-identity restore tests
  and Unraid startup coverage, without changing existing deployment credentials.
- Add bounded one-shot configuration restore maintenance with encrypted-backup
  compatibility, worker exclusion, interruption quarantine and explicit recovery.
  Avoid unnecessary application-secret initialization and overlapping restore
  verification queries; preserve existing UI, credentials and deployment defaults.
- Update the test tooling's gRPC dependency to fix certificate-identity and
  error-disclosure advisories, with security and compatibility regression tests.
  Production configuration, credentials and deployment templates are unchanged.
- Supervise embedded application/database shutdown in order, detect database
  process loss, and allow a bounded graceful-stop window in Compose examples.
  Preserve existing credentials, upgrade paths and legacy recovery safeguards.
- Add a disposable embedded-database isolation drill covering separate OS/SQL
  identities, denied privilege escalation, maintenance handoff, restored-schema
  readiness and ordered application/PostgreSQL shutdown. Keep live credentials,
  recovery safeguards and deployment defaults unchanged.
- Isolate delayed queue performance metrics from completed ingestion scopes,
  serialize optional writes and stop collection during shutdown; retain ownership
  safeguards and report sanitized persistence failures without retry storms.
- Wait for disposable PostgreSQL fixture backends to exit before role cleanup,
  preventing intermittent ownership-rehearsal teardown failures.
- Separate explicit one-shot schema maintenance from opt-in runtime readiness
  checks, with exclusive maintenance admission, restricted-role checks and
  fail-closed schema validation. Preserve embedded startup behavior and legacy
  recovery safeguards while production credential isolation is completed.
- Add an isolated database-writer fencing rehearsal with separated roles,
  legacy-session retirement, scoped recovery and stale-write rejection tests;
  preserve current live recovery safeguards pending production credential migration.
- Measure successful provider recovery in isolated resource studies with bounded
  HTTP faults, real retry cooldowns, unique-item completion and explicit waiting
  work; require natural drain without changing live resource limits or settings.
- Retain recoverable OMDb outcomes for quota waits and incomplete active settings,
  keep unconfigured providers idle during refill, and reject mismatched media types
  consistently in initial and retry enrichment with durable fallback handling.
- Respect existing provider retry decisions during metadata refill and queued-task
  execution, preventing repeated optional enrichment while preserving local analysis,
  independent TMDb work, retry recovery and budgets. Isolate AI readiness coordination
  from the existing refill/restore advisory lock.
- Backfill never-run Ollama AI readiness checks on older installations once
  ingestion and backfill settle. Preserve existing verdicts, wait for resource
  headroom, and protect concurrent manual tests and configuration changes.
- Extend isolated mixed-workload resource studies with concurrent retry discovery
  and rollback-verified claim exercises, credential-recovery checks and versioned
  aggregate reports. Keep live limits, providers, routing and library data unchanged.
- Avoid full enrichment candidate scans when no due or credential-recoverable
  work exists, using a narrow pending-wait index and statement-local checks.
  Preserve recovery, ordering and claim safeguards; extend isolated benchmarks
  with sparse/skewed waits, deadline changes and index write-cost comparisons.
- Refactor enrichment retry pages with statement-local provider context and
  exact source-conflict lookups. Preserve claim and provider
  safeguards, fix nullable-timestamp pagination, and compare query costs against
  the previous shape in isolated PostgreSQL benchmarks.
- Add an isolated PostgreSQL retry-query benchmark with representative backlog
  scenarios, correctness checks and rollback-verified claim measurements. Compare
  index costs before changing production; leave scheduling and library data untouched.
- Resume eligible enrichment after credential repair by tying new retry waits to
  the provider configuration that caused them. Preserve quotas, same-key pacing,
  unknown legacy waits and worker/source safeguards; keep status views read-only.
- Update brace-expansion, Engine.IO and ip-address to patched dependencies and
  add bounded compatibility/security regressions. Restore the OSV dependency
  gate without suppressing advisories or changing release versions.
- Share OMDb request pacing and provider wait windows across workers, restarts
  and recovery probes. Defer without spending credits or retry attempts, resume
  title lookups after an IMDb miss, and show waiting work through existing status
  views while preserving source and credential safeguards.
- Bound retry maintenance and commit retry outcomes with item state atomically.
  Resume legacy cleanup through the scheduler, preserve active/unknown claims,
  and keep statistics read-only. Prevent later backlog pages from being failed
  before existing metadata or monthly-quota recovery can be applied.
- Check OMDb availability before claiming enrichment retries. Keep blocked work
  untouched, resume through normal scheduling after setup or quota recovery, and
  preserve atomic request accounting and source/worker ownership safeguards.
- Extend visual retry readiness to OMDb with local quota, credential and setup
  guidance. Use one pausable provider view, preserve retry safeguards and keep
  observation read-only without spending requests or promising reserved quota.
- Add a visual, read-only web-search retry summary with ready/waiting/setup counts,
  bounded coverage, status timing and a relevant next action. Preserve worker
  safeguards and provider settings; use memory-only, pausable status updates.
- Apply PR #554 locally: update Markdown tooling to the security-patched 14.3.2
  parser, restore its compatible ESM linkifier dependency, and add bounded CPU-work
  and rendering regressions to CI. No PR merge or release.
- Update the root Markdown tooling's YAML dependency to fix empty-merge CPU
  budget bypasses. Add bounded security and compatibility regressions to CI;
  leave application dependencies and runtime behavior unchanged.
- Keep cached enrichment moving during provider waits with bounded read-only
  retry planning and coalesced wake-ups. Preserve cache entries across health
  updates while retaining credential, quota and source-ownership checks, and
  preserve retry usage telemetry for text trace identifiers.
- Pace automatic web searches and recovery probes across workers and restarts.
  Honor validated provider wait windows without spending credits on deferred
  requests, and prevent stale responses from delaying replacement credentials.
- Reserve web-search credits atomically across routed searches, enrichment retries
  and recovery probes. Preserve uncertain costs across crashes, keep cache hits
  free, account for advanced Tavily requests, and clarify automatic budget limits.
- Automatically verify rejected provider access with demand-driven, quota-accounted
  recovery probes. Resume eligible enrichment after account repair, preserve item
  retry budgets, and fence stale checks across restarts and configuration changes.
- Pause enrichment for rejected provider credentials without consuming item retry
  budgets. Resume after relevant settings changes, fence late failures against
  key rotation, and show corrective actions in existing provider settings.
- Persist enrichment retry due times and dependency cooldowns across restarts.
  Bound automatic batches, wait for provider readiness without spending item
  attempts, avoid nested OMDb retries, and correct legacy monthly-quota recovery.
- Add administrator-reviewed recovery for legacy movie/TV enrichment retries with
  unknown workers. Requeue exact reviewed batches with atomic audit receipts;
  preserve metadata, attempt limits and quota deferrals, and reject stale reviews.
- Claim independent enrichment retries atomically and reject expired or replaced
  workers' results. Save metadata, fallback handoffs and retry outcomes with item
  state in one transaction; bound crash recovery and preserve active claims.
- Fence metadata enrichment writes against expired or replaced queue claims.
  Save final metadata, history, completion and item state atomically; preserve
  source-identity checks and schedule fallback retries only after commit.
- Add reviewed recovery and automatic full-import/backfill continuation for
  enabled Plex, Jellyfin and Emby movie/TV libraries with interrupted legacy
  imports. Preserve inventory, settings, retry limits and stopped-writer
  confirmation; explain import ownership and retain maintenance-only recovery.
- Fence queue completion, retry and requeue by per-claim ownership so stale workers
  cannot overwrite replacement claims. Scope shutdown recovery to local claims
  and retain execution capacity until live work actually settles.
- Extend opt-in installation-budget checks with a real crash during movie/TV
  backfill. Verify recovery of original queued and claimed work after the normal
  visibility lease, sibling-library progress and single durable completions on
  both fresh and upgraded data, without altering production scheduling.
- Extend isolated resource studies with settled idle observation, scoped memory
  trends and queue-progress reports. Add an opt-in sustained CI profile while
  preserving recovery deadlines, production limits and short default gates.
  Include secret-free effective-limit diagnostics when budget verification fails.
- Correct resource-study validation for host-default PID limits on cgroup v2;
  record effective ceilings and reject drift across startup, restart and workload.
  Keep explicit CPU/PID budgets, memory limits and recovery checks enforced.
- Stabilize inventory recovery trigger definitions across upgraded and fresh
  databases, preserving null-safe recovery resets and existing item state.
  Keep strict schema replay checks and add real-database regression coverage.
- Update the server's IP-address dependency to resolve IPv6 link-local and NAT64
  classification advisories, with regression coverage preserving rate-limit quotas.
- Add a manual Linux CI installation-budget profile for isolated fresh/upgrade
  recovery under CPU, memory and PID limits. Report actual cgroup versions and
  recovery timings; preserve default release gates and upload only bounded evidence.
- Explain published-upgrade verification failures with secret-free credential-source
  diagnostics and specific recovery steps, preserving pinned provenance checks and
  existing authentication precedence without automatic credential fallback.
- Extend isolated installation acceptance with opt-in CPU/PID limits, bounded
  database connection exhaustion and real restart/backfill recovery. Keep fresh
  and published-upgrade evidence distinct; leave live limits and releases unchanged.
- Add an isolated CPU/PID-budget comparison with independently verified limits,
  fresh-start checks, process-denial detection and unchanged recovery deadlines.
  Compare matched workloads through an opt-in CI profile without changing live
  resource limits or creating a release.
- Wake queue dispatch after durable enqueue and task completion while preserving
  concurrency, memory admission, provider limits and retry cooldowns. Retain
  fallback polling and safely serialize worker stop/start without losing
  in-flight capacity accounting.
- Gate resource safety in isolated CI with real queued-work preservation and
  bounded recovery under admission pressure. Exercise 768-dimensional vectors
  and an opt-in larger evaluation corpus without changing production limits.
- Add a disposable mixed-workload resource study with bounded movie/TV ingestion,
  metadata backfill, evaluation, outage recovery and admission-pressure checks.
  Report scoped CPU/memory, backlog and recovery evidence for cgroup v1/v2 without
  changing production limits, routing or release version.
- Share a bounded memory-admission budget across library ingestion, queued
  backfill/classification and inventory evaluation. Defer new work under pressure,
  preserve in-flight ownership, and resume through existing retry mechanisms.
  Show concise memory/capacity waiting status without changing routing or limits.
- Apply open PR #553 locally: update Vitest and its V8 coverage provider to 5.0.2.
  No PR merge or release.
- Document local CPU/memory limits, worker concurrency and restart observations,
  distinguishing early-startup memory use from sustained resource headroom.
- Verify automatic backfill after a real container crash at the committed
  ingestion boundary, preserving original inventory and run identities. Require
  explicit crash evidence in full installation acceptance receipts.
- Apply open PR #549 locally: update Vite to 8.3.1 and eslint-plugin-vue to
  10.11.1 with local validation. No PR merge or release.
- Verify fresh-install and upgraded runtime progress using the real startup
  scheduler, including ingestion/backfill deferral, metadata completion, current
  movie/TV profiles and music exclusion. Keep partial local evidence distinct
  from provenance-verified full installation acceptance.
- Apply open PR #552 locally: update Socket.IO to 4.8.4 and test its timeout
  acknowledgement cleanup and namespace validation. No PR merge or release.
- Make the library scan-to-metadata-backfill handoff durable across restarts.
  Commit bounded queue pages with generation-fenced progress, resume legacy
  completed scans, and keep background evaluation waiting for unenqueued work.
- Apply open PR #550 locally: update dotenv to 18.0.3 and Undici to 8.11.2.
  No PR merge or release.
- Verify Jellyfin outage recovery across abruptly terminated ingestion processes,
  including retained partial inventory, durable waits, exclusive ownership,
  complete movie/TV replay, music exclusion and metadata-to-profile handoff.
- Apply open PR #551 locally: update Knip to 6.38.0 and Supertest to 7.3.0 with
  unchanged production dependencies. No PR merge or release.
- Report safe startup causes, stderr signals and container exit/OOM state in
  isolated schema and upgrade checks. Bound readiness probes and diagnostic
  capture, stop promptly after exits, and preserve concurrent verification runs.
- Apply open PR #548 locally: update Markdown lint tooling to 0.23.3 and refresh
  its lockfile. No PR merge or release.
- Coordinate content-import recovery across libraries sharing a Jellyfin, Emby or
  Plex server. Persist outage waits, honor server retry delays, and admit one
  bounded media-and-collection recovery check before resuming imports. Preserve
  inventory, library ownership and learning readiness; show clear shared-wait status.
- Apply open PR #547 locally: update CodeQL scanning and SARIF upload actions to
  verified v4.38.2 commit pins. No PR merge or release.
- Regenerate the fresh-install schema snapshot from an isolated current database
  to keep catalog and recovery definitions consistent with canonical drift checks.
- Recover library discovery through the existing watchdog with durable retry
  timing, jitter and sparse probes during prolonged outages. Serialize manual and
  automatic scans, honor server retry delays, and wait for configuration changes
  on access failures. Show recovery timing without bypassing ingestion or learning
  safeguards for Jellyfin, Emby or Plex.
- Show actionable library-discovery status for Jellyfin, Emby and Plex, including
  the last successful scan and a clear recovery step. Preserve inventory on failure,
  exclude music, and reject stale diagnostic results after connection changes.
  Keep status refresh read-only and avoid storing provider secrets or raw errors.
- Correct the production-naming check to distinguish normal workflow states from
  temporary numbered roadmap names, without renaming runtime fields or loosening
  the zero-debt threshold.
- Unify frozen-policy capture storage with the guarded private-study writer and
  production data directory; retain exclusive files and cleanup of failed captures.
- Support Emby's current paginated library catalog with a bounded legacy fallback,
  keeping Jellyfin's catalog contract separate. Validate every page before discovery
  writes; preserve existing data on incomplete, inconsistent or failed responses.
- Preserve local library data when discovery returns a reduced or empty catalog;
  reject malformed catalogs before changes and share the safe merge path across
  manual and scheduled discovery. Add reviewed, reversible library archiving with
  administrator confirmation, import-owner checks and audit receipts. Archived
  libraries stay disabled until explicitly restored and separately enabled.
- Automatically adopt populated legacy libraries into controlled full backfill,
  not only empty libraries. Keep learning waiting through unfinished imports,
  preserve unknown-owner safeguards, and expose backfill/recovery status with
  direct library links. Use the same recovery path across supported movie and
  TV libraries without changing routing or enabling music ingestion.
- Check bounded media and collection pagination samples before starting imports.
  Preserve inventory on failed checks, retry through existing recovery, and show
  safe causes and next steps in library status. Reuse validated samples without
  bypassing full-scan completion checks or starting unnecessary background services.
- Require validated, complete provider enumeration before pruning media or
  collections and declaring ingestion ready for learning. Preserve records on
  malformed, repeated, truncated or inconsistent pages; follow actual page sizes,
  retain safe diagnostics, and retry incomplete scans through durable recovery.
- Extend live ingestion ownership to capture creation, page writes and identity
  recovery callbacks. Keep the complete capture lifecycle on its owning database
  connection, prevent pending work from being retargeted, and preserve controlled
  maintenance, rollback, restart recovery and fresh-setup deferral.
- Require live, library-bound ingestion ownership before pruning inventory or
  completing source captures. Keep destructive helpers on the owning database
  connection, reject unowned and wrong-library calls, and preserve coordinated
  maintenance, interrupted-import recovery and ordinary read access.
- Gate CI on reviewed inventory-write changes across imports, capture state,
  sync status and recovery checkpoints. Preserve visible unresolved paths,
  require review of ownership-helper and SQL changes, and reject unreadable or
  malformed audit inputs without accessing live data.
- Add an administrator-reviewed recovery path for unverifiable legacy import
  records. Require a disabled library, stopped-worker confirmation and a fresh
  preview; preserve imported media and commit an audit receipt atomically.
  Recover lost confirmation responses through read-only receipt lookup, and
  leave full replay to normal ingestion after explicit library re-enabling.
- Recover interrupted library imports with database-owned sessions, durable
  retry checkpoints and replay from page zero. Preserve partial imports, fence
  disconnected workers, and commit pruning with capture completion atomically.
  Keep learning deferred through recovery and show concise live/retry/unknown-owner
  states using non-persistent SWR. Limit concurrent imports and reject malformed
  pages before they can authorize deletion; leave unverifiable legacy owners intact.
- Associate shared input labels with their controls for assistive technology,
  including editable library settings preserved during background status updates.
- Add visual, durable metadata-recovery progress with measured timings and clear
  next steps. Defer scheduled inventory learning until configuration, inventory
  and foreground-work prerequisites are ready; keep ingestion and recovery active.
- Automatically verify saved TMDb credential changes and release older
  authentication-blocked inventory cases in restart-safe, deduplicated batches.
  Preserve provider throttling, source/lease guards and unrelated 404 cooldowns;
  actual recovery continues through the existing enrichment queue.
- Add an administrator Metadata recovery view with bounded movie/TV case counts,
  actionable diagnoses, honest retry timing and on-demand Plex links. Protect
  reads with current-admin checks, non-persistent SWR and source/configuration
  fencing; viewing cases never changes identity, routing or retry schedules.
- Diagnose inventory TMDb 404s using bounded, exact external-ID checks. Retain
  no-match, disagreement, provider-failure and corroborated-candidate evidence in
  source-fenced recovery cases with actionable, deduplicated reports. Preserve
  stored identities and routing; candidates remain review-only.
- Persist typed TMDb observation recovery cases with failure-specific cooldowns,
  restart-safe attempt leases, stale-source protection, and atomic metadata
  backfill. Report new/changed failures and successful recovery without repeating
  unchanged warnings; retain unresolved identities without guessing replacements.
- Transfer automatic and quality evaluation vectors in acknowledged, lossless
  bounded chunks so larger movie/TV inventories no longer fail the whole-payload
  handoff limit. Preserve complete evidence, memory admission, worker deadlines,
  cancellation and routing isolation; expose safe scheduler failure reasons.
- Gate release acceptance on isolated fresh-install and published-upgrade checks,
  including interrupted restore recovery and movie/TV learning. Upload bounded,
  revision-bound results without production data or publishing credentials.
- Repair the missing initial restore-admission gate on eligible older snapshot
  installations without reopening interrupted or previously verified restores.
  Include the seed in fresh snapshots and add a digest-verified, isolated
  published-release upgrade drill covering container interruption, explicit
  recovery, and movie/TV recovery-to-learning with music excluded.
- Add a disposable recovery drill that kills an in-progress configuration restore,
  proves movie/TV configuration rollback and blocked startup, then verifies an
  explicit retry and controlled normal restart. Use isolated containers, synthetic
  data and bounded pass/fail evidence; leave live installations unchanged.
- Require dedicated restore mode for configuration imports. Keep normal workers
  out of the maintenance runtime, coordinate cooperating instances with database
  admission locks, and block normal startup after incomplete restore verification.
  Add an authenticated restore screen, explicit restart guidance, and isolated
  concurrency/recovery tests. No automatic routing resume or release is introduced.
- Serialize configuration restores on a dedicated database session and recover
  interrupted session-owned attempts on explicit retry. Reject stale-owner writes,
  preserve original failures, and keep legacy restore gates closed for investigation.
  Add isolated crash/rollback tests and document the remaining worker-drain boundary.
- Preserve Radarr/Sonarr destinations, policy-linked preferences and library labels
  across configuration restores with changed database IDs. Include library fallback
  mappings in backups, reject invalid references before configuration writes, and
  remove stale restored destinations without discarding completed history. Add
  isolated recovery and rollback tests; document remaining recovery boundaries.
- Capture configuration backups and optional learned evidence from one bounded,
  read-only database snapshot. Correct media-server ID mapping during restore,
  reject missing or ambiguous server references, and add isolated movie/TV
  recovery tests. Document configuration-backup coverage and recovery limits.
- Verify the movie/TV recovery-to-learning handoff with isolated integration
  coverage for provider return, interrupted enrichment and profile publication,
  mixed-library identity isolation, repeated syncs, and music exclusion. Preserve
  existing orchestration, retry limits and routing behavior.
- Give source identity recovery fair access across library pages by retrying
  never-attempted and oldest-attempted items first. Preserve the eight-attempt
  limit, daily cooldown, and identity safeguards; incomplete scans do not spend
  fresh retry budget. Add movie/TV outage, race, and database-restart coverage.
- Isolate Command Center loading from unrelated routes to retain production
  page-size budgets. Make disposable upgrade rehearsals use stdout logging
  before application imports, avoiding container-only filesystem assumptions
  on CI runners. Add navigation and startup-order regression checks.
- Record bounded source-recovery outcomes so metadata issues explain provider
  failures, insufficient evidence, and identity disagreements with appropriate
  next steps. Preserve retry safeguards and timestamp successful repair receipts;
  stale attempts cannot overwrite newer diagnostic evidence.
- Replace the dense Command Center library summary with a visual freshness ring,
  clear issue/decision counts, and one suggested next step. Metadata drill-downs
  now use the counted source population and show item-level retry evidence and
  source-review guidance without changing routing or starting recovery work.
- Add protocol-bound independent review worksheets and consensus export for up to
  300 movie/TV quality cases. Preserve missing and disputed judgments, validate
  third-review bindings, and safely resume identical private output without
  generating labels, invoking AI, or changing routing.
- Add a private, read-only quality coverage audit with actionable schema, study,
  backfill, blocker, and reference-review guidance. Distinguish unavailable evidence
  from zero coverage without starting AI capture, changing budgets, or routing media.
- Retain opt-in movie/TV quality evidence across bounded AI cache windows and
  restarts, with fixed expiry, deduplicated usage, and fail-closed drift/conflict
  handling. Add private blinded review packets and accumulated reports without
  increasing inference budgets, enabling routing, or creating a release.
- Add a private, cache-only movie/TV quality experiment with frozen evidence,
  separate reference labels, paired correctness and abstention metrics, and
  explicit missing/conflicting evidence. Preserve read-only execution, count
  shared historical usage once, and distinguish synthetic tests from measured
  quality. No new inference, routing permission, deployment or release.
- Prioritize missing movie/TV AI responses that can complete comparisons within
  the existing capture allowance. Preserve interrupted checkpoints, balance
  equal-cost opportunities, and avoid spending calls on known blocked pairs.
  Rejected output stays visible; budgets and routing permissions are unchanged.
- Survey the frozen movie/TV evaluation cohort in bounded, restart-safe windows
  even when early items lack cached evidence. Keep diagnostic progress independent
  of unfinished AI capture, retain explicit gaps, and atomically fence stale or
  duplicate updates. No inference, routing permission, or music support is added.
- Advance completed movie/TV evaluation windows without requiring an AI capture
  allowance. Save progress atomically with evidence, preserve interrupted capture,
  and fence stale or duplicate advancement across restarts. Missing evidence stays
  explicit; inference budgets, routing permissions and live data remain unchanged.
- Complete mixed movie/TV evaluation using validated automatic policy decisions
  directly and cached AI only where needed. Separate deterministic, mixed and
  AI-only coverage, preserve older history, and avoid provider initialization for
  empty capture plans. Inference budgets and routing permissions are unchanged.
- Explain incomplete movie/TV AI comparisons with bounded, private reason codes
  and clear recovery guidance in the Command Center. Preserve legacy history,
  distinguish cache backfill from rejected output and missing labels, and retain
  existing inference budgets and routing safeguards.
- Retain bounded, deduplicated movie/TV evaluation history across restarts, with
  distinct-item and reference-label coverage kept separate by evidence/model
  revision. Add a protected, read-only Command Center summary with nonpersistent
  stale-while-revalidate fetching and pause controls. No inference or routing
  permission is added by the summary.
- Add opt-in recurring local AI evaluation capture with durable daily allowances,
  restart-safe response checkpoints, and movie/TV window rotation after replay.
  Automatic inference stays disabled until configured; routing is unchanged.
- Add bounded, exact-response AI adjudication replay to automatic movie/TV
  evaluation, with explicit local capture budgets, restart-safe seven-day cache
  retention, and separate proposal quality, deferral and historical usage metrics.
  Cache misses never trigger inference; live routing remains unchanged.
- Extend automatic cached movie/TV comparisons through deterministic policy
  scoring, with paired decisions, review/deferral counts and conservatively graded
  correction outcomes. Reuse the frozen cohort and retry checkpoint, support
  source-only identities, and prevent evaluation workers from loading local
  credentials or accessing the database. No AI generation or routing changes.
- Run cached movie/TV retrieval comparisons automatically on a frozen cohort of up
  to 300 cases. Reuse background scheduling and restart-safe retries, isolate CPU
  work with memory/deadline controls, and expose private aggregate status without
  provider calls or routing changes. Exclude music and keep unknown labels distinct
  from measured improvements or regressions.
- Evaluate changed retained movie/TV decisions automatically in the background,
  with coherent bounded reads, restart-safe retry timing, and one private aggregate
  checkpoint. Reuse the existing scheduler, exclude stale/invalid results, and keep
  missing labels, review, and retry separate from agreement. No extra AI calls,
  routing changes, or user acknowledgement is required.
- Recover missing intake decision snapshots automatically from exact retained
  movie/TV originals during existing queue maintenance. Use bounded, retryable
  batches that preserve concurrent writes, skip locked receipts, and leave absent
  or malformed evidence unknown without replaying classification or routing.
- Retain genuine movie/TV feedback outcomes with their original saved decisions
  and extend intake receipts with bounded decision context. Separate explicit
  agreement from queue label coverage, preserve evidence through history cleanup,
  and expire snapshots without weakening feedback replay protection. No new user
  steps, routing changes, or success inferred from silence.
- Preserve the original saved movie/TV destination decision alongside retained
  corrections, including review and retry states. Add a private, read-only
  correction report that survives history cleanup, excludes conflicting feedback,
  and distinguishes measured decisions from missing historical context without
  changing routing or treating corrections as overall accuracy.
- Explain correction-labeled retrieval misses in the paired movie/TV evaluation:
  distinguish missing training evidence, retrieval misses, shortlist displacement,
  and ranking misses. Separate completed coverage checks from measured quality,
  without changing routing, learning, or approval thresholds.
- Rediscover saved reclassification batches in a compact Command Center activity
  view after closing or reloading the browser. Show bounded, active-first progress
  and recovery summaries, reuse existing controls, and prevent duplicate control
  requests without automatically starting or resuming work.
- Run reclassification batches through a restart-safe background coordinator,
  preserve pause/cancel intent, and reconcile exact interrupted move receipts
  without replaying file moves. Acknowledge execution immediately and keep
  progress refreshed independently of the browser connection.
- Reconcile recovered movie/TV moves with their exact batch attempts and show
  safe recovery status in batch and history views. Derive batch counts from
  item outcomes, preserve pause/cancel/skip intent, and keep status refreshed
  during background recovery without adding another approval step.
- Journal movie/TV reclassification moves before filesystem changes and recover
  verified moves after interruptions without repeating file copies or deletions.
  Reject missing or mismatched provider identities, preserve ambiguous recovery
  evidence, deduplicate retry warnings, and fix post-move Plex scan lookups.
- Automatically preserve bounded movie/TV correction outcomes for evaluation,
  including verified source-only identities, across history retries and cleanup.
  Make Discord and reclassification persistence atomic, fix reclassification's
  invalid history-column update, and expire captured evidence after 30 days.
  Keep routing authority, deployments, and releases unchanged.
- Add a private, read-only 300-case movie/TV comparison of TMDB-linked and
  source-aware retrieval evidence, with transitive duplicate holdouts, explicit
  cache/label shortages, and correction-only quality metrics. Keep routing,
  approval calibration, and releases unchanged.
- Automatically backfill and use eligible movie/TV source descriptions without
  TMDB IDs in live retrieval and learned library profiles. Preserve music and
  source-conflict exclusions, duplicate holdouts, checkpointed recovery, and
  existing approval calibration; clarify the narrower coverage counters.
- Ignore music and unsupported content during library sync and webhook intake,
  prevent unknown source items from being treated as movies, and complete existing
  unsupported classification tasks as skipped. Remove unreleased music discovery.
- Extend per-library evidence coverage with provider-neutral, source-anchored
  description counts, including items without TMDB IDs. Keep source conflicts
  blocked, provider IDs observational, and current retrieval/routing unchanged.
- Add administrator-only, per-library movie/TV evidence coverage: scoped source-ID
  exclusions, distinct description readiness, and recently verified retrieval
  cache/retry counts. Keep the endpoint read-only, privacy-bounded, and explicit
  that placement quality remains unmeasured; leave routing and releases unchanged.
- Replace dense top-level Command Center purpose and process-local evaluation
  cards with a compact, read-only library profile/recovery summary; retain
  advanced diagnostics and explicitly leave placement accuracy unmeasured.
- Add a bounded, label-blind frozen inventory-evidence replay for held-out
  correction cases, with explicit retrieval coverage and lockfile-difference
  diagnostics; keep routing and release promotion unchanged.
- Add a private, read-only correction-cohort capture and v2 frozen-evidence
  replay for paired published/current policy scoring. Preserve score-only
  replay and keep incomplete classifier paths explicitly unmeasured.
- Add an offline, no-network, read-only pinned-release policy-decision replay
  that pairs bounded movie/TV decisions on one private frozen input. Keep
  scoring, retrieval, AI, and full-pipeline accuracy explicitly unmeasured.
- Screen operator-correction replay cases against policy-source edit
  provenance and add an offline, pinned-release pair-comparison boundary that
  reports aggregate differences without granting routing authority.
- Add a private, read-only operator-correction policy replay with grouped
  description holdout and aggregate movie/TV agreement diagnostics; keep
  full-pipeline accuracy unmeasured and routing unchanged.
- Gate release acceptance on an isolated mixed movie/TV profile-upgrade canary
  with multi-library backfill, retry recovery, and synthetic held-out profile
  probes; report real classification quality as unmeasured and leave routing
  unchanged.
- Gate CI on a disposable replay of the last pinned release snapshot through
  current migrations, compare its catalog with fresh-install schema, and
  reconcile review-history primary-key names; no release is created.
- Correlate overdue library-profile recovery with a durable, privacy-bounded
  worker check-in and claimable queue count in the Command Center; preserve
  existing retry and routing behavior.
- Diagnose active, dirty libraries whose profile refresh planning, queue claim,
  or expired lease recovery is overdue after scheduler grace. Show bounded
  reasons in the Command Center without changing retries or routing.
- Add an administrator-only, all-library, count-only upgrade assessment in
  the Command Center, with current profile recovery and scoped unresolved
  source-identity coverage; keep routing and background work unchanged.
- Add a disposable, pinned last-release schema rehearsal for library-profile
  migration, backfill enrollment, retry recovery, inactive pause, and
  revision-verified movie/TV profile publication; leave live data untouched.
- Show a bounded, read-only library profile refresh summary in the Command
  Center with per-library recovery states and accessible disclosure; keep
  routing unchanged and create no release.
- Verify the exact inventory revision before publishing learned library
  profiles; superseded refreshes yield to newer work without a retry delay.
  Queue a one-time provenance refresh for existing profiles. No release is
  created.
- Queue post-upgrade library profile regeneration durably per library through
  the existing revision/outbox worker, including inactive libraries, and
  remove the competing whole-library startup rebuild. No release is created.
- Serialize post-upgrade task replay across processes, skip legacy automatic
  log clearing while retaining scheduled/manual cleanup, preserve pending
  work on failure, and avoid duplicate startup
  profile rebuilds; add a read-only upgrade-task manifest for release planning.
- Retain short-lived, redacted classification intake receipts across queue
  cleanup, with fixed comparison reason codes and a bounded read-only report;
  keep routing unchanged and defer release/deployment.
- Distinguish quiet movie/TV classification intake from live events lacking a
  complete prospective comparison using a bounded, read-only same-window count;
  leave routing and ranking promotion unchanged.
- Explain whether prospective library-ranking evidence is waiting for live
  comparisons, exact-event outcomes, or correction/company coverage without
  changing routing, confidence, provider traffic, or promotion safeguards.
- Stop image builds on pgvector download, integrity, compilation or installation
  failures; limit the tolerated cleanup failure to `make clean` itself.
- Report current production-company coverage separately from older keyword and
  language captures, including empty and withheld observations, inside existing
  library health details without changing routing or requiring manual review.
- Locally apply PR #546's server dotenv patch and verify its ESM configuration
  behavior without merging the PR or creating a release.
- Automatically preserve bounded description/company ranking comparisons before
  feedback, and evaluate later exact-classification outcomes without new AI calls
  or changes to routing. Keep corrections eligible while their move/sync is pending.
- Locally apply PR #545's client ESLint and Node type-definition updates without
  merging the PR, changing runtime versions, or creating a release.
- Add a read-only, grouped operator-feedback benchmark for the existing organic
  profile and a fixed diagnostic production-company contribution. Report
  correction/confirmation coverage and paired regressions without enabling routes.
- Locally apply open PR #542's server dotenv and js-yaml updates, validating the
  ESM runtime APIs and lockfile without merging the PR or creating a release.
- Retain production-company sets during inventory enrichment and automatically
  backfill missing or expired observations with bounded retries. Learn a separate,
  library-agnostic company profile without changing routing scores or safeguards.
- Add a read-only, grouped movie/TV company benchmark that reports coverage and
  placement agreement without presenting existing placements as verified accuracy.
- Locally apply PR #539's pinned CodeQL action update; preserve workflow permissions
  and security gates without merging the PR or creating a release.
- Preserve distinct studio and production-company observations through
  classification, retries and reprocessing; refresh older enrichment tasks from
  current identity-checked inventory and keep conflicting organization claims neutral.
- Locally apply PR #541's client DOM test-environment update with its compatible
  focus-fix patch, without merging the PR or changing application runtime versions.
- Preserve age-certification metadata in live learned-library comparisons using
  the same bounded feature projection as inventory training; keep conflicting
  ratings neutral and all routing and confirmation safeguards intact.
- Evaluate a disjoint movie/TV cohort through the existing live review path, and
  locally apply PR #544's server test/lint tooling updates without merging the PR.
- Start AI recovery trial timing when a worker reaches provider admission, so
  queue delays cannot repeatedly expire unused trials. Preserve automatic
  rescheduling, item identity and retry budgets after an active trial expires.
- Preserve timezone offsets when storing classification retry deadlines, and
  verify delayed recovery and durable history through the disposable Compose test.
- Update Vue to 3.5.43 and VueUse to 15.0.0 from PR #540 locally, with online/offline
  SWR and browser regression coverage; no PR merge or release.
- Verify automatic movie and TV queue recovery across an isolated AI provider
  outage, successful generation probe and fresh worker, with no duplicate retry
  tasks or media routes; locally apply and validate the open Knip 6.37.0 tooling
  update without merging its PR.
- Wait automatically during known AI provider outages without spending each item's
  retry budget. Persist provider-specific pauses across restarts, verify recovery
  with a small trial batch, and restore normal backlog processing after success.
- Keep deterministic classification available during AI outages and reject stale
  recovery results without weakening routing safeguards or adding user setup.
- Resume eligible exhausted classifications automatically after a verified AI
  generation check. Persist cooldowns and a one-cycle recovery budget across
  restarts and replacement jobs, while retaining manual retry and routing safeguards.
- Reject incomplete or empty Ollama generation probes instead of treating an HTTP
  success alone as model readiness.
- Restore History retry recovery for exhausted, unrouted AI classifications.
  Recheck eligibility under a database lock, preserve bounded automatic retries,
  and show clear inline queue results without replaying unrelated failures.
- Explain live library-evidence holds with privacy-safe reasons in the Command
  Center's existing details. Separate unusual items from unavailable familiarity
  checks while preserving confirmation settings, freshness checks and routing rules.
- Allow weak-evidence overlaps to reach the existing bounded AI comparison.
  Preserve explicit review holds, confirmation settings and fresh-evidence
  routing checks instead of stopping supported cases before evaluation.
- Distinguish intentional policy exclusions from missing scorer evidence in
  offline evaluations. Preserve specific, privacy-safe validation reasons and
  recovery guidance without unnecessary retries or changes to live routing.
- Share frozen-snapshot verification across offline policy and content evaluations.
  Retain historical measurements during metadata enrichment, keep safety-relevant
  drift invalidating, and check source validity before optional inference.
- Add an opt-in, pinned local cross-encoder for held-out library-content evaluation,
  with bounded inference, repeat/order checks, private-network isolation and a
  shadow-only stale-while-revalidate cache. Preserve current routing and keep
  relevance scores separate from confidence.
- Evaluate semantic fit with bounded example references, explicit contradiction and
  insufficient-evidence outcomes, and separate repeat/order stability checks. Keep
  local comparison results private and separate from automatic routing.
- Evaluate ambiguous destinations with bounded, local AI comparisons of item metadata
  and anonymous library examples. Reject order-sensitive suggestions, preserve complete
  candidate scopes, and keep experimental results separate from live routing.
- Bind offline calibration evidence to its item, snapshot and retrieval scope;
  automatically test corrupted evidence and library-withheld content probes without
  adding user setup or changing live routing safeguards.
- Compare full eligible-library nearest examples with sampled references during
  offline classification evaluation. Reuse bounded similarity calculations across
  held-out folds, preserve provenance exclusions and keep live routing unchanged.
- Measure missing nearest-library examples during held-out classification evaluation
  and compare a bounded, content-representative reference sample with the existing
  baseline. Share snapshot memory, retain safe fallback and preserve live routing.
- Evaluate small-library familiarity using description-excluded cross-fitting,
  retaining minimum evidence requirements and comparing it with the existing
  split baseline. Keep provenance exclusions, cancellation and live routing
  safeguards intact without adding user configuration.
- Evaluate proposed library changes against each library's learned matching patterns
  and calibrated distinctions. Share provenance-clean held-out evidence, report
  raw versus accepted results per library, and preserve all live routing safeguards.
- Evaluate content-supported challenges to provisional policy leaders, including
  small candidate pools, with shared provenance-clean evidence and paired outcome
  diagnostics. Distinguish manual-review blockers from weak content matches;
  preserve live routing safeguards, reject changed snapshots and avoid new UI work.
- Add a bounded, read-only learned content-ranker benchmark using existing
  description vectors. Compare it with nearest-item and organic metadata matching,
  exclude retained classification decisions from training, and measure placement
  noise sensitivity without changing live routing or adding user controls.
- Add a read-only comparison of independent library content-fit assessments with
  the existing raw-evidence AI baseline. Bound and validate each assessment, abstain
  on ties, and measure repeatability and cost without changing live routing.
- Compare compact, query-relevant and nonredundant inventory evidence against
  unchanged raw examples in the local held-out AI benchmark. Version the experiment
  and report evidence coverage, order stability and cost without changing live routing.
- Coordinate heavy library discovery and description evaluations across processes.
  Defer work when memory is scarce, cancel safely under pressure, and retry live
  refreshes automatically while preserving ordinary retrieval and metadata backfill.
- Reduce retained discovery scratch data and avoid full vector copies during cache
  hits and background revalidation. Release completed benchmark folds sooner and
  verify paired AI comparisons against the content they actually consume, without
  changing fitting, recovery limits or routing authority.
- Contain checked-out database connection failures without replaying transactions.
  Discard broken clients, keep failure logs private-safe, and move inventory model
  fitting and vector decoding after read-only snapshots close while preserving
  source consistency and automatic background recovery.
- Add a read-only, library-agnostic local AI comparison of nearest examples with
  and without additional library context. Measure held-out movie/TV choices,
  order sensitivity and inference cost without changing routing, and invalidate
  results when their source data changes. Reject incomplete discovery before
  model calls and report non-sensitive discovery failure categories.
- Automatically prepare bounded library-description context for local ambiguous
  destination comparisons. Preserve nearest examples, exclude self-placement
  evidence, redact remote-provider details and recover stale or failed context
  in the background without new controls or routing permissions.
- Add a bounded, snapshot-cached retrieval context that preserves raw matches and
  broad library coverage while adding deduplicated local examples. Retry failed
  optional discovery without caching failures, validate source-bound reuse, and
  measure held-out movie/TV coverage without changing routing or adding controls.
- Add bounded, library-agnostic local content-community discovery and a paired,
  source-verified movie/TV evaluation. Preserve shared evidence and ungrouped
  items explicitly, reuse control validation, and keep live routing, automatic
  recovery and the UI unchanged while measuring representation quality.
- Add content-only adaptive group discovery with validation-gated splits, bounded
  work and explicit small-group retention diagnostics. Compare cached movie/TV
  vectors in a source-verified offline benchmark without inference, new controls
  or changes to automatic routing and recovery.
- Add a bounded, local-only comparison of learned content groups using anonymous
  descriptions and observed metadata. Evaluate overlapping movie/TV candidates
  with reversed-order checks and source verification; preserve live routing,
  stable decisions and existing automatic recovery without new UI controls.
- Reduce unnecessary promise overhead in learned-group fitting while retaining
  cancellation checkpoints and identical fit results. Identify changed source
  components when a read-only benchmark is invalidated.
- Diagnose learned-group evidence gaps separately from common or overlapping
  vocabulary. Automatically prioritize already-due metadata backfill within the
  existing fair queue, with expiring source-checked hints and unchanged routing.
- Apply client-tooling PR #538 locally and validate its dependency updates with
  client, browser and production-build checks; no PR merge or release.
- Evaluate learned content-group terms against existing library evidence on
  source-verified movie/TV samples. Keep the experiment offline because it did
  not recover additional ambiguous cases; no new prompts or routing changes.
- Apply client-tooling PR #532 locally, reconcile dependency overrides, and repair
  browser fixtures and development/production test isolation. Reference the direct
  YAML dependency in its override to prevent future Dependabot update conflicts.
- Recover uncertain policy-creation responses by checking current policy state
  immediately instead of automatically resubmitting the admission request.
- Add a read-only, candidate-local library evidence evaluation using distinct
  nearby items, learned content groups and metadata checks. Compare ambiguous
  cases and stable controls without changing live routing or adding user prompts.
- Apply server-runtime updates from PR #536 locally, including patched Morgan
  and Undici, and reconcile Discord's separate Undici overrides. No PR merge,
  product-version bump or release is included.
- Reject library-profile comparisons that only appear stable when unrelated
  fitting starts are paired. Add source-verified, read-only movie/TV hold-out
  comparisons with unusual-description diagnostics; no routing changes or new
  user prompts. Existing Library learning summaries remain compatible.
- Update SHA-pinned Docker and OSV actions from PR #537, applied locally without
  merging the PR; retain least-privilege scan jobs and tag-only publication.
- Preserve validated content-group memberships separately from outliers so all
  supported library groups can participate in automatic recovery. Unassigned
  descriptions still backfill normally; malformed profiles rebuild with bounded,
  deduplicated diagnostics. No routing changes, new controls or extra model calls.
- Update server Node type definitions from PR #535, applied locally without
  merging the PR; the supported Node runtime and product version are unchanged.
- Prioritize automatic description backfill for underrepresented content groups
  learned from validated library profiles, while preserving ordinary progress,
  retry delays and provider cooldowns. Stale or unknown references use normal
  recovery; no new controls, inference budget or routing changes.
- Update SHA-pinned CodeQL analysis and SARIF upload actions from PR #531,
  applied locally without merging the PR, with workflow contract regression tests.
- Add read-only, held-out coverage stress tests for learned library profiles,
  comparing random gaps, concentrated gaps and missing content groups across
  movie and TV libraries without changing live routing or adding review steps.
- Update server development tooling from PR #534 (Node type definitions, ESLint
  and Knip), applied and validated locally without merging the PR.
- Publish sufficiently covered library profiles while missing descriptions backfill,
  retaining all candidate libraries and withdrawing under-covered profiles safely.
  Track partial-data comparisons separately in existing Library learning details;
  no extra inference, controls or live routing changes.
- Isolate repeatedly rejected inventory descriptions with durable, bounded retries
  so healthy descriptions can continue backfilling. Preserve validated checkpoints,
  retry failed batch members individually, and retain provider-wide cooldowns.
- Diagnose rejected description-provider responses with actionable, deduplicated
  logs. Preserve retry backoff across busy passes and automatically backfill missing
  validated descriptions from existing checkpoints after provider recovery.
- Diagnose malformed query/profile data with actionable, deduplicated warnings.
  Rebuild invalid private profile caches with scheduled backoff, resume pending
  comparisons after validated recovery, and prevent stale query reuse.
- Distinguish unfinished, sparse, inconsistent and tied library-profile comparisons
  from excluded observations. Show unseen comparison coverage and plain-language
  causes in existing expandable, auto-refreshing Library learning details.
- Recover unfinished library-profile fits automatically by continuing their existing
  progress within bounded work limits. Preserve completed fits, reject stale
  evidence, and retain safe fallback when recovery is exhausted; no new controls,
  model calls or live routing changes.
- Compare cached library profiles with existing candidate decisions automatically
  for unseen items, reusing query vectors without extra inference. Batch and
  deduplicate comparisons, reject stale/self-matching evidence, and summarize
  agreement and skips in Library learning without changing live routing.
- Refresh source-versioned library representative profiles automatically in a
  bounded background worker. Reuse cached embeddings, retry after interruptions
  and reject changed inputs before publishing; no new controls or routing changes.
- Add bounded multi-start representative learning with convergence diagnostics,
  training-only fit selection and fallback when starting points disagree. Compare
  against the existing learner on the same inventory snapshot without adding model
  calls, user controls or live routing changes.
- Learn bounded, library-agnostic content groups from cached inventory descriptions,
  retaining real representatives and reporting training coverage, convergence and
  held-out ranking results. Reuse existing metadata fusion and baseline fallback
  without model generation, new settings or live routing changes.
- Add a read-only, library-agnostic semantic pair-grading pilot using cached
  descriptions and the installed local model. Require complete bounded responses
  and agreement across reversed example order, preserve baseline fallback, and
  report actual inference separately from sample preflight without changing live routing.
- Add a bounded, library-agnostic neighborhood metadata matcher and compare it
  against existing ranking on 600 movie/TV descriptions. Preserve consensus cases
  and live routing; keep the experimental matcher offline after broader regressions,
  with documented results for the original metadata conflicts.
- Add a library-agnostic, nested held-out reranking experiment that learns how
  to combine description and metadata evidence. Preserve live scoring and routing
  after the 600-item comparison found regressions; retain field-level attribution
  and reproducible, aggregate-only results for the next matching improvement.
- Complete the focused movie/TV AI comparison and distinguish insufficient
  familiarity evidence from rejected matches in fallback benchmark reports.
  Report strict-control coverage explicitly without changing live routing.
- Repair cross-platform CI tests with native path expectations and ESM syntax
  validation that accepts timed tests while still detecting truncated modules.
- Preserve PostgreSQL timestamp precision when capturing learning feedback, so
  newly committed evidence is not skipped by a rounded analysis cutoff.
- Repair CI dependency and copyright checks, and include both in local CI
  preflight so test-only runs do not hide those failures.
- Recover verifiable Plex metadata identity conflicts automatically, retry
  unresolved cases with durable backoff, and resume existing metadata backfill
  without discarding completed enrichment on repeat syncs.
- Deduplicate unchanged library-sync warnings across rebuilds while retaining
  changed-state and daily reminders. Existing warning details now show affected
  Plex titles and repair steps, automatically retrying missing item links when
  Plex comes back online without creating another warning.
- Show a compact, automatically refreshed Command Center library-evidence summary
  that separates passing checks from confirmation holds, keeps technical details
  optional, and uses memory-only SWR with safe request deduplication and cleanup.
- Continue cached library-evidence evaluation when routing confirmations are
  required, distinguishing qualified evidence from approval holds while preserving
  fresh routing checks, bounded work and zero additional inference.
- Shadow-test calibrated neighbor overlap against current library evidence and
  existing AI proposals, with bounded cached fitting, no extra inference and no
  new routing authority, user settings or acknowledgement steps.
- Evaluate calibrated description matching as a selective fallback for ambiguous
  neighbors, reusing fresh AI and learned-metadata checks while preserving strict
  matches, bounded local inference and unchanged live routing safeguards.
- Calibrate small-library description matches with group-excluded cross-fitting
  in the read-only benchmark, reusing existing examples while preserving
  per-score evidence minimums, bounded resource use and unchanged live routing.
- Compare strict, mean and library-calibrated description-neighbor checks in a
  grouped, read-only movie/TV benchmark. Report sparse-library coverage and
  placement disagreement without AI generation, new settings or routing changes.
- Load historical synopsis fallback only when inventory text is unavailable,
  reducing corpus sorting and database work while preserving library evidence,
  metadata precedence and fresh routing checks across live and background reads.
- Scope live library-description reads to the requested movie or TV type while
  preserving all same-media memberships, conflict checks and query exclusions.
  Avoid unrelated-media retrieval work and corpus-limit failures without changing
  global refresh jobs, learned scoring or routing safeguards.
- Reuse learned library profiles and description-match baselines when their exact
  training inputs remain current, refreshing automatically on use after changes.
  Bound in-memory reuse while preserving fresh inventory, vector expiry, query
  exclusion and routing checks without adding user settings or AI calls.
- Allow fresh AI, description and learned-library agreement to resolve ordinary
  soft-evidence reviews automatically, using a library-specific familiarity check
  and short-lived server routing authority without inflating policy scores.
  Preserve explicit restrictions, administrative confirmation, ambiguous matches
  and drift checks without adding another settings panel or AI call.
- Keep profile-inferred library traits as ranking evidence instead of admission
  requirements, allowing description retrieval to compare eligible destinations
  with incomplete metadata. Preserve explicit restrictions, media boundaries
  and zero scores without introducing new settings or routing authority.
- Learn per-library description-match baselines automatically during held-out
  evaluation, distinguishing familiar matches from merely the closest candidate.
  Keep calibration separate from test items, report sparse-library coverage,
  and compare review qualification without changing live routing or scores.
- Preserve frozen evaluation inputs when background metadata refreshes during
  preparation, while continuing to reject policy, library, vector and
  configuration drift and clearly reporting that the snapshot is not current.
- Add a paired, read-only learned-evidence review evaluation using full-pool
  description neighbors, contrastive library metadata and the existing AI
  proposal. Distinguish soft evidence reviews from hard policy conflicts and
  report potential review reduction without changing live routing or scores.
- Add a read-only fresh policy and AI evaluation across grouped movie/TV samples.
  Rebuild library observations and description evidence without held-out items,
  report placement agreement separately from accuracy, and preserve existing
  routing safeguards without adding settings or user acknowledgements.
- Align bounded AI comparison prompts, provider schemas and parsing around a
  minimal proposal-or-abstention JSON response. Remove generated confidence and
  clarification fields and the second-model repair step from this mode, while
  preserving policy thresholds, candidate boundaries and routing safeguards.
- Add a read-only comparison of metadata-only and description-preserving
  shortlists using production AI prompts, parsing and routing-eligibility checks.
  Reuse identical comparisons, report actual inference cost and review blockers,
  and distinguish retained policy cases from independent benchmark samples.
- Preserve the strongest usable library-description candidate when learned
  metadata would exclude it from AI comparison, while retaining the policy leader
  and three-candidate limit. Reuse same-snapshot retrieval and learned profiles,
  with local candidate-recall reporting and no additional user settings.
- Add a selective, library-name-independent inventory-conflict recheck to local
  evaluation, reusing learned metadata and description evidence with at most one
  extra comparison. Report gains, regressions and actual inference cost without
  adding user settings or changing live routing safeguards.
- Add a bounded full-cohort comparison of named and content-first library
  evidence, with paired per-library gains and regressions and canonical snapshot
  component fingerprints. Reuse local inference services without changing live
  routing or requiring additional user settings.
- Add bounded local investigation of classification disagreements, with matched
  agreeing controls, anonymous-library comparisons and contrastive description
  examples. Keep findings separate from verified labels and live routing, and
  require no new user declarations or settings panels.
- Add library-aware grouped evaluation folds and sequential cohort exclusions
  for 300 additional local benchmark items. Preserve small-library training
  coverage, isolate held-out description copies, and report per-library results
  without changing live routing, model settings or release versions.
- Make weak-evidence score discounts responsive to fresh, library-agnostic
  description comparisons and learned metadata. Preserve original policy scores,
  exclusions and thresholds; require existing local consensus checks for newly
  qualifying automatic routes. Explain retained scores within the existing UI.
- Allow fresh local AI and learned-library evidence to resolve threshold-qualified
  policy ambiguity automatically. Preserve manual-review vetoes and configured
  thresholds, revalidate before granting routing authority, restore expired
  decisions to review, and prevent automatic placements from becoming trusted
  history labels. No new settings or release.

- Use fresh learned library fit before the live three-candidate AI shortlist
  cutoff. Preserve hard eligibility, the policy leader, scores and routing rules;
  rerank alternatives automatically with safe fallback and no new UI controls.

- Feed organically learned library patterns into live AI candidate comparison,
  refreshed from current inventory without manual purpose declarations. Keep
  fit distinct from confidence, exclude the item's current and stored synopsis
  copies, and preserve routing constraints and provider privacy boundaries.

- Add library-agnostic profile learning to local candidate benchmarks, using
  contrastive inventory patterns without manual purpose declarations. Exclude
  held-out examples, downweight shared observations, and preserve live routing.

- Add a local metadata-aware candidate-selection benchmark using held-out genre
  and studio evidence alongside synopsis ranking, with coverage and shortlist
  comparisons. Preserve default selection and live routing pending evaluation.

- Add bounded local investigation of benchmark disagreements, including omitted
  destinations and blind content re-checks. Keep case evidence private and
  distinguish technical gaps from unresolved semantic differences without
  changing routing or creating labels from model agreement.

- Add a seeded 100-title, local-only description benchmark comparing 9, 30,
  and 100 retrieved examples. Report actual evidence counts, abstentions,
  latency, tokens, and observational agreement without changing live routing
  or treating existing library placements as verified correct answers.

- Feed maintained inventory descriptions into live AI candidate comparison,
  including competing libraries. Reuse cached vectors, report incomplete
  coverage, keep snippets local, and omit adjudication response excerpts from
  diagnostics without changing routing thresholds or adding user settings.

- Keep the inventory description cache current automatically after library sync
  and through periodic catch-up. Reuse unchanged descriptions, checkpoint small
  local-only batches, yield to queued work, and back off on failures without
  changing routing thresholds or adding user settings.

- Add inventory-wide description retrieval in shadow mode, with a separate
  versioned vector cache that reuses unchanged descriptions and resumes verified
  batches. Search current-library contents independently of historical embedding
  neighbors without changing live routing or adding user review screens.

- Add a local, label-free description comparison for the inventory sampler.
  It re-embeds sampled items and their fixed neighbors in bounded batches,
  verifies model consistency, and reports ranking changes without changing
  live routing or adding manual policy declarations.

- Add a read-only inventory semantic sampler that compares current-library
  neighbors without requiring manual policy declarations. It reuses stored
  embeddings, excludes the sampled cohort from retrieval, and reports coverage
  separately from correctness without provider calls or routing changes.

- Add one explicitly confirmed, fail-closed local command that completes a
  private retrieval evaluation after independent reviewer labels are ready. It
  chains consensus, the admitted scorer, paired artifact construction, and an
  aggregate report without adding browser state, learning, policy changes, or
  routing authority.

- Automatically prepare two distinct, content-free independent-review
  worksheets when a protected held-out study packet is captured, and reduce the
  Command Center semantic-evaluation card to its current status, one plain
  language explanation, and a details link. The workflow remains offline and
  cannot learn, change policy, or route media.

- Add a bounded private RAG retrieval-representation scorer that creates
  paired label-included and label-free evidence from the same held-out cohort.
  It requires verified self-hosted structured output, persists only a
  categorical study submission, and cannot route media, change policy, or
  learn from library contents.

- Replace the repetitive profile-derived purpose-declaration worklist with a
  compact, automatically refreshed proposal summary. Compatible drafts can be
  applied with one revision-pinned, all-or-nothing administrator action;
  mixed and unverified provenance remains in the individual exception queue.
  The flow neither calls AI/RAG nor changes routing.

### Performance
- Bound direct backend coverage runs to the existing two-worker, 512 MB idle
  recycle settings so local coverage verification cannot create an unbounded
  Jest worker fan-out.
- Add passive event-loop-delay observations that persist only a fixed p99
  bucket, aggregate count, and freshness timestamp; no raw performance value,
  process, operational, media, library, provider, configuration, policy, AI,
  decision, error, or routing data is retained.
- Bound backend CI coverage workers to the established 512 MB idle-memory
  recycle limit, preventing a long-running coverage process from accumulating
  unbounded worker memory.
- Prevent same-process scheduled work from overlapping by applying node-cron
  non-overlap protection to every core scheduler registration and guarding
  recurring, delayed-start, and direct invocations by task name.
- Add passive, coalesced scheduler execution receipts with fixed task-class,
  outcome, and duration buckets. They retain no task name, schedule, error,
  query, identifier, media, library, provider, configuration, policy, AI,
  decision, or routing data.
- Add an administrator-only, parameter-free database-health summary that reads
  fixed PostgreSQL aggregates and returns only bucketed I/O and table-health
  observations with reset-aware freshness. It cannot expose operational
  dimensions or trigger maintenance, policy, AI, or routing work.
- Add passive, coalesced queue-startup performance receipts with fixed duration
  and count buckets. They retain no query, media, library, provider,
  configuration, policy, AI, or routing data.
- Bound metadata-refill scans by stable item IDs before loading large item payloads, so ineligible pages progress automatically without repeated full-inventory scans.
- Split queue-worker health aggregation into active and recent-completion reads backed by focused indexes.

### Fixed

- Isolate local inventory benchmarks from the live app's memory budget and wait automatically for temporary discovery contention, with bounded cancellation, owned-container cleanup, and unchanged routing safeguards.

- Allow retrieval evaluations to retry after a provider failure by verifying
  an unchanged reviewer reference set, while preserving conflicting outputs.
  Correct cross-platform completion tests and reject equivalent input/output
  paths before study work begins.

- Preserve the intentional `not_applicable` exact-contrastive state in
  held-out semantic studies as a neutral offline-evaluation abstention instead
  of rejecting an otherwise valid redacted study bundle.

- Update the root documentation-lint dependency override to a non-vulnerable
  `smol-toml` release, removing the high-severity malformed-TOML
  denial-of-service advisory from repository and CI tooling.
- Configure the workspace ESLint language server to use the system Node runtime
  directly, avoiding Node DEP0190's unsafe shell-argument launch warning in
  current VS Code installations.
- Reconcile the policy-authoring component inventory with the native-purpose
  bootstrap surface so the repository inventory audit covers every component.

- Let a weak manual policy decision use one bounded, advisory AI/RAG
  comparison when the policy engine already owns two or three eligible
  destinations. Hard manual-review safeguards and insufficient candidate sets
  remain provider-free; every recommendation still requires operator
  confirmation before routing.

- When strict candidate-bound verification abstains (or the selected provider
  cannot satisfy its strict structured-output contract), make one bounded,
  advisory comparison among the same two or three policy-eligible libraries.
  The comparison cannot route media and still requires operator confirmation.

- Prevent a candidate-scoped semantic comparison from retrieving the incoming
  item's own same-media historical identity as current-library corroboration.
  The versioned v3 retrieval protocol now compares only other eligible
  library items and remains advisory; it cannot change policy or route media.

- Corrected source-identity replay-observation retention so its inclusive UTC
  date range contains exactly the documented 120 days.
- Automatically retain one bounded, aggregate-only daily source-identity
  evidence replay receipt after application readiness. Its database selection
  uses a short read-only repeatable-read transaction before external evidence
  calls, has no startup replay, and cannot select an identity, modify source
  metadata, invoke AI, or route media.
- Bound the source-identity external-evidence replay to a deterministic,
  daily rotating active-library window. The read-only aggregate study now
  reports its selected scope and shares the repair worklist's ESM selector,
  avoiding unbounded observation scans and permanent low-ID selection.
- Add a bounded, provider-neutral source repair worklist for current,
  complete-capture identity conflicts. It exposes only local repair context
  and a source-match-then-resync action; it cannot choose an ID, modify source
  metadata, persist an identity, invoke AI, or route media.
- Add a bounded, read-only replay of current conflicting source identities.
  It reads one source item per selected observation through a provider-neutral
  ESM adapter and reports aggregate evidence outcomes only; it cannot correct
  source metadata, persist an identity, invoke AI, or route media.
- Record repeated source-identity conflicts as one bounded, post-capture sync
  summary while retaining the existing strict identity guard and controlled
  unresolved-observation view.
- Expose the strict TMDb external-ID evidence decision through a
  source-independent ESM service, while preserving the queue compatibility
  export; it still rejects contradictory and incomplete evidence.
- Route every core delayed scheduler startup task through the cancellable
  scheduler lifecycle and stop local event-loop sampling before queue drain on
  controlled shutdown.
- Remove the Node 24 DEP0190 source from the cross-platform workspace test
  launcher by using explicit, allowlisted `cmd.exe` arguments with Node shell
  mode disabled on Windows.
- Restore backend dependency-declaration validation by removing an unused
  compatibility re-export, and make the source-inventory scanner report a
  staged deletion as a coverage gap instead of failing its scan.

### Added

- **Paired retrieval-representation artifacts** — Added an ESM-only,
  aggregate-only artifact producer for a historical-classification-label
  ablation. It pins both conditions to one held-out cohort, rejects raw source
  material and confounded non-history changes, and cannot invoke AI/RAG,
  learn, change policy, retry, or route media.

- **Low-touch purpose proposal workflow design** — Documented a revision-pinned,
  all-or-nothing grouped review model to replace repeated profile-derived
  purpose-declaration actions. It keeps profile evidence as a draft, refreshes
  readiness automatically, and reserves manual work for genuine exceptions.

- **Retrieval-representation study** — Added an ESM-only, aggregate-only
  comparison of media description, declared library purpose, and nearest-item
  history against the same independently labelled held-out cohort. Its strict
  fingerprint-bound artifact rejects raw context and partial variants; the
  local workflow cannot invoke AI/RAG, learn, change policy, retry, or route
  media.

- **Private reviewer aggregate results** — Added an ESM-only local handoff
  that combines the packet-bound redacted evaluation bundle and a completed
  independent reference set into the existing content-free semantic-study
  report. It writes only on valid independent evidence and cannot invoke
  AI/RAG, learn, change policy, retry, or route media.

- **Private reviewer evidence continuity** — Authorised private reviewer-packet
  creation now automatically writes a fingerprint-bound, content-free sibling
  semantic-evaluation bundle. The packet is withheld if that companion cannot
  be written, allowing later aggregate measurement without exposing private
  review context or granting AI/RAG, learning, policy, or routing authority.

- **Packet-bound reference-set completion** — A new ESM-only local study command
  now composes two finalized, content-free reviewer submissions into a
  packet-bound reference set without a manual identifier. It writes only after
  complete consensus, requests adjudication on disagreement, and cannot call
  AI/RAG, learn, change policy, or route media.

- **Bound reviewer submissions** — Private held-out review packets can now
  produce separate incomplete, content-free local worksheets and packet-bound
  finalized submissions. Expired, altered, incomplete, or malformed worksheets
  fail closed before existing independent consensus; no AI/RAG output, policy
  change, learning, or routing authority is added.

- **Controlled private reviewer packets** — Added an explicit, read-only local
  ESM workflow that creates a short-lived, content-minimized held-out review
  packet only after the aggregate capture handoff is current. Packets stay
  outside HTTP APIs under exclusive `.tmp` files, omit semantic/RAG output and
  current placement, and feed only the existing fingerprint-bound independent
  review path; they cannot learn, change policy, or route media.

- **Semantic evaluation results summary** — Added a content-free, offline ESM
  report for a fixed semantic snapshot and independent human reference set. It
  reports aggregate and stratum coverage, disagreement, precision/recall,
  abstention coverage, reviewer consensus, and 95% Wilson uncertainty; it
  explicitly does not claim calibration for a scoreless categorical signal and
  cannot call AI/RAG, learn, change policy, or route media.

- **Automatic private-capture handoff** — The existing passive, aggregate
  eligibility audit now recognizes a complete balanced cohort frame and
  exposes a compact, auto-refreshing readiness state. It neither selects nor
  retains media, calls AI/RAG, creates labels, changes policy, or routes
  content; the protected capture workflow remains separately controlled.

- **Prospective independent-review consensus** — Added a private ESM-only
  composer that turns two separately supplied, opaque, fingerprint-bound
  reviewer submissions into the existing offline reference-set format, while
  requiring a third bounded adjudication for every disagreement. It accepts no
  media/library or reviewer data, writes only a fresh `.tmp` artifact, and
  cannot invoke AI/RAG, learn, alter policy, or route media.

- **Command Center semantic-evaluation readiness** — Added an
  administrator-only, auto-refreshing, no-store summary of the existing
  protected semantic-evaluation prerequisite. It reports only the next
  aggregate evidence stage, links to detailed review, and cannot collect
  labels, invoke AI/RAG, tune learning, change policy, or route media.

- **Outcome-backed purpose quality** — Purpose health now includes a compact,
  no-store aggregate that compares repeated, policy-authorized manual outcomes
  with an already declared, distinct genre purpose. It exposes no identities or
  terms, fails closed on unavailable evidence, and only prioritizes review; it
  cannot change policy, AI/RAG, learning, or routing.

- **Command Center purpose health** — Added an administrator-only,
  auto-refreshing aggregate summary of declared library purpose and structural
  exceptions. It is bounded, no-store, identity-free, and links to the
  existing detailed review; it cannot invoke AI/RAG, learn, or change routing.

- Add a compact, accessible library-purpose bootstrap for profile-derived
  identity terms. Current contents are explicitly shown as suggestions, while
  the existing revision-checked server writer records only operator-selected
  purpose terms; advanced policy rules remain available separately.

- **Outcome-backed purpose drafts** — Native purpose maintenance now loads one
  compact, read-only suggestion from repeated, operator-originated genre
  outcomes. The suggestion is optional, excludes profile and self-reinforcing
  policy-pattern evidence, and still requires the existing revision-checked
  coverage review and purpose-change workflow; it cannot invoke AI, route
  media, or write a policy on its own.

- **Held-out study gate reconciliation** — Documented the current passive
  readiness and private-audit observations, including their intentionally
  separate authority boundaries. Existing automation remains library- and
  configuration-agnostic and cannot synthesize lifecycle or declared-purpose
  evidence, capture a cohort, invoke AI, or route media.

- **Current-intent evidence recovery** — A native purpose declaration and its
  matching durable lifecycle receipt can now restore passive evidence
  eligibility even when the policy has an older profile-derived receipt. The
  aggregate-only observation remains library-agnostic and cannot capture a
  cohort, label media, invoke AI, select semantic evidence, or route media.

- **Truthful bounded declaration review** — The purpose-declaration worklist
  now distinguishes a complete no-review result from an incomplete report
  window. It never claims that omitted active policies need no declaration;
  the read-only, redacted review still cannot change policy, select a cohort,
  invoke AI, or route media.

- **Server-generated purpose declaration worklist** — The existing
  administrator purpose-coverage review now groups matching profile-derived
  stored-purpose drafts without returning rule values. Each item opens the
  existing revision-checked declaration form; the worklist cannot mutate
  policy, select a cohort, invoke AI, or route media.

- **Governed native-purpose declaration provenance** — Native purpose
  maintenance now distinguishes declared, profile-derived, mixed, and
  unverified stored-purpose provenance using a fixed, private v2 contract.
  Profile-derived terms remain a review draft until an administrator records a
  revision-checked native declaration; the existing passive lifecycle
  re-audit observes that durable change without selecting a cohort, invoking
  AI, or routing media.

- **Measured held-out study readiness** — The administrator-only aggregate
  readiness contract now identifies one fingerprint-current, fixed next
  prerequisite from the existing lifecycle audit without exposing its receipt
  or operational data. It cannot create declared purpose, capture a cohort,
  collect labels, invoke AI, change policy, or route media.

- **Non-pending held-out decision partition** — The private eligibility audit
  now explains each non-pending policy-only comparison through a fixed,
  aggregate evaluator stage. It reconciles to the existing comparison count
  without exposing media, policy, library, provider, or configuration data and
  cannot create evidence, select a cohort, collect labels, invoke AI, change
  policy, or route media.

- **Declared-purpose provenance gate** — Policy-purpose evidence now accepts
  only server-recorded native declarations, keeps inferred profile observations
  descriptive, and fails closed for unknown sources. Versioned aggregate
  screens expose bounded unverified counts without creating policy evidence,
  selecting a cohort, collecting labels, invoking AI, changing policy, or
  routing media.

- **Held-out eligibility explanation partitions** — The private policy-only
  audit now reports fixed, mutually exclusive aggregate partitions for policy
  source provenance and candidate comparison availability. A zero-ready result
  is explainable without exposing library, policy, configuration, provider, or
  media identity; it cannot capture a cohort, collect labels, invoke AI,
  change policy, or route media.

- **Restore-safe held-out lifecycle state** — Every merge and replace backup
  restore now atomically clears the aggregate-only lifecycle source checkpoint
  and audit receipt. The passive re-audit therefore observes restored durable
  evidence without exporting stale cursors, creating study evidence, running
  AI, changing policy, or routing media.

- **Held-out source-transition checkpoint** — The passive held-out re-audit
  now stores changed aggregate source states independently of audit receipts.
  A temporary absence of lifecycle or declared-purpose evidence therefore
  cannot hide a later return to the same eligible source. Deferred states do
  not scan candidates, create a cohort, label media, invoke AI, change policy,
  or route media.

- **Prompt passive held-out re-audit** — The aggregate-only lifecycle gate now
  rechecks every five minutes instead of fifteen, matching the bounded visible
  readiness refresh. It still requires a source fingerprint change before the
  private audit can run, preserves the advisory lock and failure budget, and
  cannot create evidence, collect labels, invoke AI, change policy, or route
  media.

- **Automatic held-out study status refresh** — The reconciliation page now
  refreshes only the existing count-only study-readiness report every five
  visible-page minutes and after a visibility return. It retains no new data,
  cannot start study work or routing, and ignores stale reads.

- **Passive held-out study readiness** — Administrators and future automation
  can read a rate-limited, no-store, aggregate-only report explaining whether
  normal lifecycle receipts or complete declared-purpose evidence still defer
  the private eligibility audit. It exposes no library, policy, configuration,
  or media identity and cannot create evidence, capture a cohort, label media,
  invoke AI, change policy, or route media. Authorization precedes the
  per-IP limiter to preserve administrator availability.

- **Purpose-evidence re-audit preflight** — Receipt-triggered held-out
  eligibility re-audit now waits for fixed aggregate evidence that at least one
  current policy retains declared purpose and complete normal lifecycle
  provenance. This prevents a futile population scan while keeping the process
  library- and configuration-agnostic; it cannot capture a cohort, label media,
  invoke AI, alter policy, or route media.

- **Receipt-triggered held-out re-audit** — The private eligibility audit now
  rechecks automatically after aggregate verified normal policy lifecycle
  evidence changes. A durable count-only cursor, three-attempt failure budget,
  and advisory lock keep the work bounded across instances; it cannot capture a
  cohort, collect labels, invoke AI, alter policy, or route media.

- **Held-out source provenance terminology** — The private semantic-study audit
  now versions its receipt and distinguishes observed, profile-only, retained,
  and absent policy-purpose evidence. The aggregate remains library- and
  configuration-agnostic and cannot select a cohort, collect labels, invoke AI,
  change policy, or route media.

- **Passive verified rebuild lifecycle evidence** — The administrator-only
  policy-purpose review now counts an existing terminal library-rebuild
  replacement only when its execution gate, immutable verification run, event,
  and intent-revision bindings agree. The aggregate remains library- and
  configuration-agnostic; it exposes no configuration and cannot select a
  cohort, label media, invoke AI, or route media.

- **Library-agnostic policy evidence inventory** — The administrator-only
  policy-purpose review now reports fixed aggregate availability of current
  authoritative native intents, retained declared purpose, and matching normal
  lifecycle evidence without returning library identity or configuration. A
  stale receipt cannot qualify a newer unreceipted intent; semantic selection,
  labels, AI, and routing remain disabled.

- **Policy-linked lifecycle source readiness** — Held-out semantic-study source
  availability now requires current retained declared purpose and complete
  normal lifecycle evidence for the same active policy. The administrator-only
  aggregate distinguishes qualified, missing, and review-required evidence
  without exposing policy values or enabling cohort selection, labels, AI, or
  routing.

- **Policy-purpose lifecycle provenance receipt** — The administrator-only
  purpose review now measures whether durable normal policy establishment and
  change receipts retain declared specialized purpose, remain profile-only, or
  cannot be verified. The bounded aggregate exposes no rule values or receipt
  details and cannot select a cohort, collect labels, alter policy, or route
  media.

- **Cross-library common trait evidence** — Libraries now reports bounded,
  conflict-excluded trait values that recur across selected same-type libraries.
  Administrator-only aggregate purpose provenance provides context without
  exposing policy values or affecting policy, cohort selection, or routing.

- **Held-out policy-source readiness** — The administrator-only policy-purpose
  review now reports full-population aggregate availability of retained declared
  purpose for the private eligibility audit. It excludes inferred
  library-profile evidence and cannot select a cohort, collect labels, or
  affect routing.

- **Automatic library trait prevalence** — Libraries now compares bounded
  observed trait frequencies with same-type selected peers, names local and
  peer denominators, and excludes current source-identity conflicts before any
  trait analysis. The read-only view cannot change policy or routing.

- **Policy-purpose provenance review** — The administrator-only purpose
  coverage report now distinguishes profile-only, retained, and absent
  specialized purpose with fixed aggregate counts, without exposing policy or
  profile values.

- **Held-out policy source screen** — Corrected the study boundary to retain
  operator-declared native purpose rules and added a private aggregate receipt
  that explains inferred-profile exclusions without exposing policy or media
  data.

- **Held-out policy eligibility audit** — Added a private, read-only,
  configuration-bound canonical-population audit that reports only aggregate
  broad-policy decision availability before a semantic study cohort can be
  captured. It excludes source conflicts, detects source truncation and
  configuration drift, and cannot change policy, route media, or collect
  labels.

- **Prospective held-out semantic cohorts** — Added a private, read-only,
  broad-policy-first cohort capture that excludes source conflicts, freezes
  balanced candidate comparisons before semantic retrieval, and emits only
  opaque study artifacts and aggregate eligibility receipts. Independent human
  labels, readiness, and frozen-study preflight remain required; routing stays
  disabled.

- **Unresolved source visibility** — Automatically retain bounded source conflict
  observations and library membership, with capture coverage and recent examples
  in Libraries, without assigning IDs or adding operator steps.

- **Original candidate comparison** — Show how captured classifier proposals compare
  with recorded libraries in the recent UTC window, retaining missing evidence
  and unknown placements without implying accuracy or adding operator steps.

- **Original observation types** — Automatically distinguish imported membership,
  manual actions, classifier workflows and unknown origins within library UTC
  coverage, with complete totals and no additional operator input.

- **UTC capture by recorded library** — Automatically show recent provenance
  coverage and excluded recording times for bounded library groups, with complete
  global totals and accessible keyboard scrolling.

- **UTC provenance coverage** — Show a bounded daily view of known recording
  times, with unknown legacy times explicitly excluded and today marked partial.
  Shared accessible tables keep UTC and stored-calendar views distinct.

- **Reliable history recording times** — Automatically preserve an immutable
  recording instant for new history and show known/unknown coverage. Legacy
  timestamps stay unknown, with existing calendar reports preserved.

- **Daily provenance coverage** — Automatically show a bounded daily history
  window, including partial today, with captured/missing provenance, explicit
  date exclusions and database-calendar labels.

- **Original and recorded method attribution** — Automatically show how original
  classification methods and candidate sources relate to current history methods,
  with bounded library groups and explicit missing provenance.

- **Original candidate provenance** — Automatically retain bounded candidate
  proposals and their original method before routing, with visible missing-reason
  counts and explicit evidence coverage versioning.

- **Passive history lifecycle coverage** — Show completed, pending-decision,
  retry-pending and other observations by library and method, with reconciled
  totals and accessible labels. No operator input is required.

- **Suggestion evidence provenance** — Automatically capture complete analysis
  cohorts and revalidate policy, destination and feedback before application.
  Stale suggestions are preserved as superseded history during normal analysis;
  threshold and weight suggestions now retain their supporting feedback.

- **Retained request and feedback references** — Extended the bounded cleanup
  assessment to preserve request and feedback records with immutable library
  snapshots, transactional checkpoints and guards against late writes or
  reattachment. Added populated index measurements and recovery tests.

- **Inventory dependency planning and cleanup** — Added automatic foreign-key
  discovery and a disposable cleanup assessment that shares one mutation budget
  across items, dependents and retained history updates. Item reservations and
  schema checks protect interrupted cleanup from moves and uncounted cascades.

- **Bounded inventory cleanup prototype** — Added resumable pruning and parent
  removal assessments with complete-manifest checks, bounded transactions and
  database admission guards. Local tests verify concurrent writes, moves and
  interruption recovery; broader dependency validation still gates production use.

- **Inventory writer compatibility** — Added automatic source and cascade-writer
  discovery, read-only deployed catalog checks, and an isolated sync assessment
  that preserves identity and metadata retention through ordered transactions.
  Production adoption remains gated on bulk, cascade and restore compatibility.

- **Per-library repair prototype** — Added bounded row-count pages and ordered
  library locks to preserve single-visit coverage for sparse small libraries.
  Local assessments verify concurrent writes, automatic invalidation and recovery;
  production adoption remains gated on writer compatibility.

- **Repair lifecycle assessment** — Added read-only inventory range measurements
  and reproducible contention, reconnect and storage checks. The isolated repair
  prototype now reclaims idle and empty cache entries automatically and avoids
  the reader/truncate lock cycle.

- **Bounded page-repair prototype** — Added a local change-journal evaluation
  that reuses unaffected coverage summaries, repairs changed or expired ranges,
  and withholds complete counts when continuity or capacity cannot be established.
  Production adoption remains gated on contention and lifecycle evidence.

- **Scan recovery benchmark** — Added a reproducible local comparison of capped
  extra visits and frozen coverage projections, with explicit completion,
  consistency, storage and work-limit results. Production recovery remains gated
  on measured evidence.

- **Automatic scan diagnostics** — Libraries now explains retained complete
  measurements, repeated scan resets and active libraries without recorded
  visits. Prioritized summaries distinguish missing evidence from failure and
  require no additional collection steps.

- **Incremental large-library coverage** — Automatic sampling now resumes bounded
  pages across visits and publishes complete coverage for stable large libraries.
  Changed inventory or observation timestamps restart scans automatically, with
  partial progress and measurement times clearly shown.

- **Fair automatic library coverage** — Background sampling now visits active
  libraries in turn, including those beyond the first 12. Each library has its
  own capacity limit, so oversized inventories no longer hide smaller libraries'
  history. Accessible, paginated summaries show actual visit times and preserve
  earlier hourly history separately.

- **Per-library coverage trends** — Automatic hourly history now shows metadata
  progress by library, with explicit inventory changes, gaps and unchanged
  coverage intervals. Bounded samples avoid misleading comparisons when the
  population changes, including replacements with the same row count.

- **Automatic acquisition history** — Libraries now shows captured and unavailable
  metadata attempts alongside hourly coverage samples, with bounded seven-day
  history, explicit populations and no manual capture steps.

- **Automatic library observation health** — Libraries now explains metadata
  coverage, freshness, missing identities and retry backoff using attributable
  observations and existing clocks. Queue activity stays separate from capture
  success, with bounded, authenticated reads and no per-item setup.

- **Cross-library inventory comparison** — Libraries automatically shows shared
  movie and TV identities and common traits, with explicit coverage and overlap
  denominators. Duplicate placements count once, conflicting traits stay unknown,
  and bounded reads disclose limits without adding provider calls or routing.

- **Automatic inventory metadata observations** — Identified items now gain
  attributable TMDb keywords and original language through background enrichment,
  with cached reuse and bounded retries. Source tags stay separate, missing
  language stays unknown, and changed identities invalidate previous traits.

- **Library metadata coverage** — Library profiles and new history snapshots
  show known and missing trait counts with clear percentage denominators.
  Existing profiles refresh automatically after upgrading.

- **Administrator media-ID review** — Libraries now offers a filtered review
  queue for unresolved identities, with TMDb previews and explicit confirmation.
  Expiring previews, current account and source checks, and atomic audit receipts
  protect ID updates. This workflow does not trigger classification or routing.

- **Held-out semantic study capture** — A private offline runner freezes the
  complete cohort before preparing policy candidates and excludes every cohort
  identity from RAG comparisons. Versioned provenance binds the cohort and
  configuration to existing study gates; legacy inventory captures cannot pass
  held-out readiness. Study execution remains advisory with no routing or
  learning authority.

- **Private real-inventory study runner** — A local stdin-only ESM command can
  now execute one 24–32-case candidate-scoped semantic study without writing
  raw media metadata to the checkout. It verifies the same media-type and
  metadata prerequisites as the live retriever, accepts no file arguments,
  emits only the existing redacted snapshot document, and cannot change AI,
  policy, learning, retries, or routing.

- **Bounded real-inventory semantic-study capture** — Classifarr can now
  prepare one 24–32-case, candidate-scoped RAG study cohort sequentially in
  memory and immediately reduce it to the existing redacted snapshot format.
  Invalid requests make no retrieval call, per-case failures become study
  abstentions, and the output excludes media/library content, provider/model
  data, prompts, vectors, normal persistence, browser exposure, learning, and
  routing authority.

- **Real current-inventory semantic-study snapshots** — The offline AI/RAG
  study path can now evaluate a redacted leading-versus-strongest-alternative
  snapshot from Classifarr's real, candidate-scoped current-library retrieval,
  rather than synthetic vectors alone. The snapshot has strict bindings and
  excludes titles, descriptions, library/media IDs, prompts, vectors, provider
  data, and model output; it cannot change a policy, invoke AI/RAG, learn,
  retry, or route media.

- **Calmer pending-review evidence** — The review card now leads with a
  plain-language recommendation and reveals source checks, current-library
  comparison, and score/safeguard mechanics in separate, accessible
  disclosures. Existing-library wording now describes it as a useful clue, not
  proof that a new item belongs there.

- **Frozen candidate semantic-study preflight** — A new offline, aggregate-only
  CLI binds a complete independently labelled study bundle to one opaque
  candidate-scoped AI/RAG proposal cohort and a maximum 31-day review window.
  It detects document/configuration drift before a human study and cannot call
  AI/RAG, retain data, learn, modify policy, retry, or route media.

- **Complete redacted semantic-study bundles** — The offline semantic readiness
  command can now safely evaluate a complete 24–32 case, fingerprint-bound
  fixture/snapshot/manifest/independent-label bundle from project-contained
  JSON files. It rejects partial or escaping inputs, emits aggregate-only
  evidence, and remains unable to call AI/RAG, retain study data, learn, edit
  policy, retry, or route media.

- **Independent-label evaluation oracle** — Offline semantic readiness now
  measures the separately bound, independently reviewed reference decisions
  rather than requiring them to repeat a synthetic fixture baseline. Exact
  fixture binding, content minimization, aggregate-only results, and the
  existing no-routing/no-learning authority boundary remain in force.

- **Outcome-calibrated semantic evaluation** — Candidate Retrieval Monitoring
  now automatically compares later operator alignment for outcome-calibrated
  versus otherwise comparable semantic current-library matches within the
  latest opaque AI/RAG cohort. It keeps no-match and legacy records separate,
  retains only fixed aggregate state, and cannot tune RAG, change policy, learn,
  retry, or route media.

- **Authenticated outcome-weighted semantic retrieval** — Candidate-scoped RAG
  now gives a small, capped advisory boost only to already-relevant current
  library matches backed by an append-only authenticated final-outcome receipt.
  It does not change policy scores, thresholds, policy editing, or routing.

- **Automatic exact-item outcome learning** — An authenticated operator's
  successful runtime confirmation or destination change now records eligible
  stable item-to-library memory automatically through the existing locked,
  audited, idempotent learning command. Learning never rewrites a policy and a
  rejected or unavailable learning attempt cannot reverse routing.

- **Bound semantic reference-set artifacts** — Offline semantic readiness now
  requires a separate, SHA-256-bound, content-free reference-label artifact
  declaring independent double-blind review before it can reach human-review
  readiness. Synthetic or absent labels remain an explicit non-ready state;
  malformed or content-bearing input fails closed. The local read-only CLI and
  artifact cannot call AI/RAG, persist study data, change policy, learn, retry,
  or route media.

- **Frozen semantic-adjudication cohorts** — Candidate Retrieval Monitoring now
  automatically separates bounded AI and current-library semantic-retrieval
  comparisons by an opaque server-generated proposal fingerprint, then
  evaluates only the latest unchanged cohort against later validated operator
  destinations. The compact auto-refreshing disclosure retains no item text,
  library, model, prompt, response, embedding, or cohort identifier and cannot
  change AI, policy, RAG, learning, retries, or routing.

- **Semantic-context outcome evaluation** — Candidate Retrieval Monitoring now
  automatically distinguishes bounded AI comparisons where current-library
  semantic context was available, unavailable, or not retained by legacy
  records. It shows aggregate proposal, abstention, rejection, and subsequent
  operator-alignment outcomes behind progressive disclosure, without retaining
  titles, descriptions, prompts, responses, embeddings, libraries, models, or
  providers and without affecting AI, policy, RAG, learning, retries, or
  routing.

- **Automatic score-band calibration review** — Security Settings now turns
  the redacted future-corpus aggregates into a compact, continuously refreshed
  calibration report. It uses fixed 95% Wilson bounds to identify only
  human-review prompts for close-candidate boundaries or higher-margin
  evidence; it cannot alter policy thresholds, AI, RAG, learning, retries, or
  routing.

- **Automatic future-corpus evaluation** — Security Settings now shows one
  compact, auto-refreshing aggregate status for the redacted future operator
  corpus. It measures per-score-band baseline coverage for a later
  human-approved AI/RAG evaluation without exposing rows or affecting policy,
  AI, RAG, learning, retries, or routing.

- **Automatic redacted reviewed-corpus capture** — Eligible authenticated
  operator confirmations and corrections now create a future-only,
  time-limited evaluation row with only fixed outcome/evidence categories from
  a safe 30-day default. The optional acknowledgement selects a different
  bounded retention period and enables the separate historical-snapshot
  workflow; it is not required for capture or normal Classifarr operation.
  The data is automatically expired, audited, and has no policy, AI, RAG,
  learning, or routing authority.

- Added an offline-only semantic counter-evidence readiness gate that measures
  corpus coverage, precision, recall, abstention, and false positives before
  RAG could be considered for a future broad-policy review path. The gate is
  pinned to committed redacted artifacts and cannot change policy or routing.

- **Candidate-scoped current-library semantic retrieval** — Advisory AI
  comparison can now use bounded similarity to descriptions of current items
  in only the policy-eligible libraries, reusing stable current-inventory
  embeddings without changing policy scoring or operator routing authority.
- **Pull-request synthetic policy-candidate replay** — A separate
  least-privilege CI job now runs the fixed, aggregate-only candidate replay
  against each pull request without installing dependencies, reading live
  data, invoking AI/RAG, using secrets, retaining artifacts, or routing media.
- **Progressive pending-review summary** — Pending classification review now
  puts the recommended destination, review reason, and required operator action
  first, with deterministic evidence, score mechanics, inventory comparison,
  and advisory AI verification behind one accessible disclosure; it does not
  change policy, AI, RAG, or routing authority.

### Fixed

- **Policy evidence maintenance inventories** — Restored complete ownership for
  the read-only purpose-evidence and lifecycle-provenance components so the
  policy presentation audit tracks every current component and test. Regenerated
  the fresh-install schema snapshot so it tracks every current migration.

- **Profile-derived purpose maintenance** — The administrator native-purpose
  editor can now prepare profile-derived stored purpose as a clean typed draft
  without passing profile provenance through the browser or blocking an
  explicit declared-purpose change.

- **Backend test reliability** — Full and unit server tests now use bounded
  Jest workers with memory recycling, while database integration stays serial,
  preventing the former single-worker heap exhaustion.

- **Source-conflict authority** — Fresh unresolved source conflicts now suppress
  automatic existing-media evidence, awaiting-decision reconciliation and
  metadata/TMDb enrichment until valid source evidence clears the conflict or
  the existing retention period expires.

- **Inventory TMDb diagnostics** — Distinguish missing provider items from network,
  throttling and access failures, preserving safe correlation details and existing
  observation data without exposing credentials or changing retry behavior.

- **Embedding integrity** — Reject malformed vectors before success accounting or
  storage, and preserve stored embeddings when provider dimensions do not match.
- **Media sync diagnostics** — Explain rejected source identities with bounded,
  privacy-limited conflict details while retaining protection against ambiguous IDs.

- Bound text and image embedding responses during transfer, including compressed
  failures and warmup requests, while preserving cancellation and rejecting
  oversized responses before parsing or immediate retry.

- Buffered HTTP requests and embedding retry waits now honor caller cancellation,
  stopping cancelled work promptly while retaining request deadlines and response
  limits. Cancellation no longer enters transient retry handling.

- Stop oversized OMDb responses and image downloads while reading them, before
  buffering or parsing the complete body. Preserve interrupted JSON transfers as
  errors so unavailable evidence cannot appear as an empty response.

- OMDb lookups and health checks now distinguish missing titles from credential,
  quota and malformed-response failures, preserving reliable enrichment evidence
  and accurate service health without additional operator steps.

- **Atomic OMDb quota admission** — Reserve local quota before each lookup attempt,
  including retries and failures, so concurrent requests cannot overrun the limit.
  Reset accounting together at the UTC day boundary and preserve usage during
  configuration changes without adding operator steps.

- **Reliable metadata provider configuration** — Use consistent provider selection,
  prevent duplicate active settings on concurrent saves and repeated restores,
  preserve OMDb usage, and apply TMDb credential rotations immediately. Equivalent
  legacy duplicates consolidate automatically while retaining stored credentials.

- **Faster inventory summaries** — Reduce repeated metadata processing in library
  health, overlap and automatic sampling reads while preserving freshness,
  source validation, unknown states and existing capacity limits.

- **Local runtime reliability** — Restore Pino log delivery to multiple targets,
  exclude private runtime data from Docker build contexts, and isolate transport
  and router tests from queued mocks and unrelated page compilation.
- **Original observation capture** — Record trusted origin metadata for new
  source-library and manual queue history, replacing caller-supplied candidates.

- **Candidate evidence loss** — Preserve policy and signal context through AI
  retry/fallback paths, keep empty ranking positions from promoting later
  candidates, and retain original provenance after manual resolution.

- **Policy comparison accuracy** — Rate changes now use percentage points, and
  missing or invalid values remain N/A instead of becoming zero. Comparisons use
  a dedicated accessible table with explicit units and keyboard scrolling.

- **Custom TLS transport** — Fixed self-signed-server requests failing because
  the custom HTTP dispatcher used an incompatible fetch interface. Per-request
  connections are now disposed after use, with certificate verification enabled
  unless explicitly disabled.

- **Statistics reporting scope** — Replaced inactive date buttons with clear
  descriptions of retained feedback and recent activity windows. Policy details
  now label the 30-day breakdown and rolling seven-day periods accurately, and
  dashboard cards fit narrow screens while retaining automatic loading. Detail
  comparison text and evidence descriptions remain readable on the light modal.

- **Evidence coverage visibility** — Policy Statistics now separates imported
  library observations, recorded candidates, linked feedback and evaluated outcomes.
  The read-only breakdown loads automatically, preserves unknown states and reports
  when rows are capped. Leaving the dashboard now removes its visibility listener.

- **Feedback retry protection** — Standalone feedback now uses stored classification
  evidence and records each source event once. Matching retries return the saved
  result; conflicting submissions and duplicate prompt feedback are rejected.
  Source receipts preserve retry protection through history or feedback cleanup.

- **Feedback accuracy and coverage** — Accuracy now uses evaluated candidate
  evidence and reports unknown results as unavailable. Observations remain intact,
  evaluated coverage appears in policy statistics, and live metrics reflect current
  library eligibility. Older suggestion cohorts require regeneration; prompt
  timestamps are normalized to UTC for consistent feedback windows.

- **Prompt feedback persistence** — Pattern choices now use current database
  fields and commit with feedback, learning statistics and prompt completion.
  Counts reflect distinct saved patterns; invalid actions and repeated responses
  cannot leave partial or duplicate feedback. Prompt reads use persisted candidate
  metadata, and native-intent policies retain their legacy-write protection.

- **Feedback pattern confidence** — Repeated metadata values count once per
  feedback record, preventing inflated pattern support and confidence. Old
  suggestion cohorts require fresh analysis, and applying regenerated pattern
  suggestions now uses the correct database fields.

- **Suggestion review lifecycle** — Apply and reject now allow one terminal transition
  from pending, preserving review history during retries and concurrent requests.
  Application metadata and policy changes commit together; stale dashboard actions
  refresh the list after a conflict.

- **Duplicate policy suggestions** — Equivalent pending suggestions now share a
  structural configuration comparison and serialized storage per policy. Concurrent
  analysis runs avoid duplicate inserts, and failed batches roll back together.

- **Feedback suggestion eligibility** — Excluded detached, inactive and mismatched
  library references from policy suggestion evidence. Pattern, weight and threshold
  analysis now share the requested feedback window and count only eligible samples.

- **Feedback confidence eligibility** — Detached, unresolved and inactive library
  destinations no longer count as automatic-learning rejections. Confidence reads
  preserve historical feedback, validate candidate IDs and require positive evidence
  before learning can apply.

- **Bounded coverage reads** — Sampling uses indexed library ranges and item
  lookups to avoid reading unrelated inventory while measuring a page.

- **Sampling initialization** — Fresh installations and upgrades initialize the
  automatic library sampling cursor without resetting existing progress.

- **Observation validity in summaries** — Missing language fields remain distinct
  from explicitly unknown language, preventing malformed captures from inflating
  health, profile and overlap coverage. Affected profiles refresh automatically.

- **Automatic observation repair** — Background enrichment now repairs malformed
  or mismatched metadata observations after cooldown, including records with
  recent fetch timestamps. Bounded inventory passes reach later repairs, preserve
  valid empty captures and prevent overlapping refill work in the same process.

- **Stale enrichment cannot overwrite changed source items** — OMDb ratings,
  metadata observations, and source-library history now verify captured source
  fields when writing. Concurrent source changes produce a skipped result,
  while unrelated bookkeeping and valid enrichment continue normally.

- **Resolved inventory IDs survive source omissions** — Background and confirmed
  media identities now retain their provenance across matching source syncs.
  Changed or conflicting source identities invalidate stale enrichment, and
  concurrent updates or malformed provider IDs cannot silently replace them.

- **Automatic inventory profile refresh** — Synced inventory and observed
  metadata changes now refresh active-library profiles through the existing
  background worker, including libraries without policies. Unchanged syncs
  avoid extra refreshes, empty libraries lose stale profiles, and failed work
  can recover automatically without another inventory change.

- **Consistent library observations** — Stored profiles and AI statistics now
  use the same item-based prevalence calculation. Duplicate traits count once
  per item, missing data stays unknown, and observed absence no longer produces
  profile exclusion penalties. Refreshes clear empty profiles and protect
  newer observations from delayed writes.

- **Media-ID confirmation recovery** — A lost save response now recovers the
  original administrator's audit receipt without repeating confirmation.
  Recovery survives a page reload in the same tab, explains unknown outcomes,
  and offers an explicit receipt check. Confirmation retries are disabled and
  historical receipt reads remain bounded and read-only.

- **External-ID ambiguity requires review** — Queue enrichment now requires
  unique typed TVDB/IMDb results and agreement between supplied identifiers.
  Conflicting, malformed, duplicate, or unavailable evidence retains an unknown
  TMDb ID and a review reason; title search cannot override that uncertainty.

- **Conservative TMDb title resolution** — Queue enrichment now requires a
  unique exact title/year match from a complete bounded response before
  assigning an ID. Weak, ambiguous, incomplete, or unavailable matches retain
  an unknown ID and a review reason in item metadata. This adds no media routing.

- **Server quality gate** — Removed an unused corpus-capture version export
  reported by the dependency and export check, with no runtime behavior change.

- **Source identity through queue enrichment** — Refill now uses the item's
  movie/TV type, and provider lookups reject missing or conflicting types.
  IMDb resolution selects the matching media category and supports normalized
  OMDb IDs. Conditional ID/rating/metadata writes prevent stale enrichment from
  crossing types; skipped work no longer reports successful enrichment.

- **Typed source-library history** — Duplicate checks and inserts now share an
  explicit movie/TV identity, including the no-TMDb title fallback. Missing or
  conflicting media types and malformed IDs skip history creation instead of
  producing guessed movie records. Captured inputs keep lookup and insertion
  consistent across asynchronous checks.

- **History scoring respects media identity** — Movie and TV records sharing
  a TMDb ID no longer contribute to each other's history scores or consume
  each other's result limit. Missing or invalid identities contribute no
  history evidence, and valid matches retain the existing confidence cap.

- **Production query-string parser advisory** — Raised the server's ESM
  dependency override and lockfile resolution for `qs` to 6.16.0, eliminating
  the published moderate denial-of-service advisories in the previous 6.15.2
  resolution.

- **Container heap-cap detection** — Ignore unbounded cgroup memory sentinels
  rather than passing an invalid, impractically large heap cap to Node.js at
  startup.
- **Schema snapshot CI parity** — Refreshed the authoritative PostgreSQL 18
  schema snapshot so the containerized drift gate recognizes the current
  `classification_history.method` constraint.
- **Server CI dependency-declaration gate** — Removed three stale, unconsumed
  ESM exports from correction-review contracts so the Knip CI gate can run to
  completion without changing runtime behavior, policy, AI/RAG, or routing.
- **Offline synthetic policy-candidate replay** — A fixed, opaque fixture
  corpus now exercises the shared deterministic calibration, ranking,
  weak-evidence, ambiguity, and score-band projection before a proposed scope
  or calibration code change is accepted; it is CLI-only, aggregate-only, and
  cannot read live data, invoke AI/RAG, mutate policy, persist evidence, or
  route media.
- **Broad declared-policy review recommendation** — Correction Analytics now
  turns two comparable, review-ready 28-day aggregate correction periods for
  contextual declared-policy evidence into one human-only policy-scope review
  recommendation, with progressive disclosure of aggregate uncertainty and no
  policy, AI, RAG, learning, or routing authority.
- **Operator-first evidence review** — Pending classification review now leads
  with a plain-language decision summary and keeps bounded source evidence,
  exact-library cross-checks, and advisory AI candidate comparisons inside one
  labelled disclosure; it does not change AI, RAG, policy, or routing
  authority.
- **Progressive capability-telemetry details** — AI Settings now groups safe
  failure categories, completed-window coverage, and warning recency behind
  one automatically refreshed disclosure while keeping the current health
  state and protected Error Logs handoff visible.

- **Policy-scoped evidence digest** — Policy maintenance now opens a
  read-only, administrator-only digest of declared intent, stored-profile
  provenance, and fixed-window authorized evidence without exposing raw media,
  rule values, profile payloads, or model output.

- **Route-safety policy-maintenance handoff** — AI Settings now offers a
  read-only link to policy review only when a policy-owned route-safety gate is
  stable and representative across two completed aggregate windows.

- **Route-safety readiness** — AI Settings now automatically summarizes the three most frequent deterministic primary route safeguards from a fixed completed UTC-day aggregate, keeping provider capability separate from policy/routing follow-up.
- **Capability telemetry health** — AI Settings now automatically summarizes
  the administrator-only 24-hour aggregate of successful capability-metric
  streams and bounded persistence warnings, without exposing raw logs or
  affecting AI, policy, RAG, classification, or routing.
- **Capability telemetry health trend** — AI Settings now automatically
  compares three fixed completed UTC-day capability-telemetry aggregates,
  distinguishing persistent, newly observed, cleared, recurring, and no-data
  warning states without exposing raw diagnostics or affecting AI, policy,
  RAG, classification, or routing.
- **Capability telemetry Error Logs handoff** — Active, validated telemetry
  persistence-warning trends now offer one user-initiated route to a
  reason-code-filtered Error Logs view, without carrying provider, model,
  media, policy, raw diagnostic, or routing detail.
- **Capability telemetry safe failure categories** — AI Settings now
  automatically shows a compact administrator-only 24-hour aggregate of fixed
  metric-write and database-condition categories while persistence warnings are
  active, without exposing raw SQLSTATEs, diagnostics, provider, model, media,
  policy, or routing detail.
- **Capability telemetry category coverage** — AI Settings now automatically
  compares three completed UTC-day aggregates to show whether retained
  persistence warnings carry the fixed safe category contract, without
  exposing raw diagnostics or affecting AI, policy, RAG, classification, or
  routing.
- **Capability telemetry warning recency** — AI Settings now automatically
  distinguishes retained warnings in the latest completed UTC day, a newly
  cleared completed day, and older-only context through fixed aggregate bands,
  without exposing raw timestamps or affecting AI, policy, RAG,
  classification, retries, or routing.
- **Offline fixed-band calibration** — A versioned synthetic default-band corpus now verifies manual, selection, confirmation, and automatic-candidate boundaries before the calibration review packet can be prepared; it remains offline and human-gated.
- **Bounded candidate adjudication** — Ambiguous policy selections can now receive an AI advisory comparison of two or three server-selected eligible destinations, using observed library-profile and relevant historical evidence while retaining operator confirmation.
- **Current-library candidate retrieval** — Candidate adjudication now uses a bounded read-only lookup over the synchronized current library inventory, recognizing exact identifiers, title/year, and plain-text catalog matches without changing routing authority.
- **Current-library retrieval telemetry** — Statistics now reports aggregate lookup availability, fixed latency bands, catalog-match presence, and bounded AI-proposal/operator agreement without collecting media, provider, prompt, response, or destination detail.
- **Candidate-set outcome attribution** — Candidate Retrieval Statistics now distinguishes bounded candidate selections from an operator's validated outside-candidate choice, making policy candidate-set gaps measurable without retaining destination identity.
- **Candidate-set policy-review readiness** — Candidate Retrieval Statistics now marks when a representative attributed-decision cohort supports reviewing deterministic candidate eligibility, scope, and ranking evidence; it remains advisory and cannot alter policy or routing.
- **Deterministic policy-score explanation** — Pending classification review can now explain the contributing evidence categories, normalized weighting, corroboration adjustment, and evidence-safety calibration behind its displayed policy score.
- **Policy confirmation evidence readiness** — Candidate Retrieval Statistics now aggregates the fixed deterministic evidence categories behind recent confirmation-band candidates, advising declared-scope maintenance only after a representative cohort and without changing AI or routing behavior.
- **Policy-scope review handoff** — A declared-scope evidence review can now lead administrators to the existing read-only purpose-coverage review, with no policy, library, item, provider, or routing identity carried in the navigation.
- **Pending score explanation comparison** — Operators can compare two or three already-visible deterministic policy-score explanations locally, including bounded evidence contributions and calibration mechanics.
- **Policy confirmation-evidence uncertainty** — Aggregate policy-maintenance readiness now distinguishes a conclusively weak declared scope from a borderline sample using a fixed 95% Wilson interval.
- **Candidate evidence cards** — Pending policy confirmation now separates item identity, declared policy, contextual library-profile evidence, similar-item retrieval, and confirmed outcomes, flagging contextual-only support and deterministic conflicts without changing routing.
- **Library evidence profile** — Pending review can now compare up to three policy-eligible libraries by policy-score margin and fixed declared-intent, observed-content, metadata-identity, RAG, and confirmed-outcome evidence states.
- **Contrastive inventory evidence** — Pending policy confirmation and selection now compare a retained exact TMDb identity across up to three policy-ranked current libraries, showing fixed supporting, counter, shared, or neutral evidence without changing routing.
- **Contrastive outcome monitoring** — Statistics now aggregates the fixed cross-library identity-check status with later server-validated operator candidate-set outcomes, making counter-evidence observations measurable without retaining media or destination identity.
- **Offline candidate-evidence evaluation** — A bounded, versioned fixture corpus now compares deterministic candidate scope, exact contrastive evidence, and a proposed semantic-retrieval signal using review precision, recall, abstention, coverage, and agreement metrics before any semantic evidence can reach an operator workflow.
- **Pinned semantic snapshot evaluation** — A fixed-path, offline-only adapter now evaluates a redacted synthetic embedding snapshot across an expanded eight-case reviewed corpus and reports status-only semantic precision, recall, abstention, agreement, and provenance.
- **Policy correction analytics** — Statistics now associates fixed original policy-score margin bands and evidence states with later server-validated operator outcomes, so administrators can identify a policy-evidence area for review without changing routing.
- **Correction-analytics uncertainty readiness** — Statistics now applies a fixed minimum cohort and 95% Wilson intervals to aggregate changed-selection rates, distinguishing insufficient, inconclusive, review-worthy, and low-signal score/evidence buckets without auto-tuning policy, AI, RAG, or routing.
- **Correction-signal temporal stability** — Statistics now compares adjacent completed UTC-day aggregate windows and distinguishes persistent, emerging, diminishing, low-signal, and insufficient-data correction patterns before any policy-maintenance review; it remains advisory and cannot tune or route media.
- **Correction cohort-composition context** — Statistics now compares fixed score-margin and evidence-state mixes across adjacent completed windows, flagging material aggregate cohort shifts before a recurring correction signal is interpreted as policy behavior; it remains advisory and cannot tune or route media.
- **Long-horizon correction trend** — Statistics now compares two server-defined adjacent 28-day aggregate periods, requiring representative readiness and comparable cohort composition before showing a sustained correction-review or low-signal pattern; it remains advisory and cannot tune or route media.
- **Representative correction-review handoff** — A sustained, comparable 28-day correction signal now exposes one clear navigation link to the existing Needs Attention workflow, without selecting a record or triggering a policy, AI, RAG, learning, retry, or routing action.
- **Historical review-corpus preflight** — Sustained correction signals now clearly distinguish current decision review from a future historical corpus, with a fixed sample-frame proposal and explicit authorization, redaction, retention, and operator-audit safeguards.
- **Historic review-corpus control plane** — Administrators can now acknowledge the fixed future corpus purpose, safeguards, and retention limit through an automatically loaded Security Settings card, with revision protection and bounded recent audit history; historic records remain unavailable.
- **Redacted policy evaluation snapshot** — Administrators can now create a server-selected, expiry-bound representative correction sample that exposes only fixed margin, operator-outcome, and evidence-state categories for offline policy evaluation.
- **Offline correction evaluation report** — Security Settings now automatically summarizes the active redacted snapshot by completed period, score margin, and evidence state with fixed outcome counts and 95% Wilson intervals; refreshes are non-auditing and it remains descriptive without policy, AI, RAG, or routing authority.
- **Policy-change outcome follow-up** — Administrators can now start one receipt-bound, content-free before/after observation after an approved native policy change; Security Settings refreshes its fixed aggregate 28-day follow-up automatically and presents descriptive rates with 95% Wilson intervals.
- **Reviewed policy-change decision record** — After a bounded follow-up completes, administrators can automatically load, explicitly confirm, and record or revise one expiry-bound aggregate conclusion with a fixed rationale. It has no policy, routing, AI, RAG, learning, retry, or classification authority.
- **Policy-change review activity** — Security Settings now automatically summarizes recorded and materially revised reviewed conclusions across up to three completed fixed 30-day periods, retaining only coarse conclusion counts with no individual decision, policy, media, actor, outcome, provider, prompt, response, or RAG history.
- **Policy-change review-process consistency** — Security Settings now derives a fixed, aggregate-only consistency state from three completed review-activity periods, requiring a minimum cohort and remaining descriptive with no policy, AI/RAG, learning, or routing authority.
- **Policy-change calibration readiness** — Security Settings now retains only the bounded aggregate window needed to identify six complete, sufficiently active review periods and automatically states when a human threshold review may begin; it cannot calculate or apply a threshold, policy, AI/RAG, or routing change.
- **Offline policy-change calibration protocol** — Security Settings now automatically describes the fixed aggregate-and-synthetic human-review procedure only when bounded aggregate readiness and review-process consistency are both satisfied; it cannot export a snapshot, generate a proposal, change a threshold or policy, invoke AI/RAG, or route media.
- **Offline calibration evidence pack** — A checked-in synthetic status corpus now guards the fixed policy-change calibration protocol and produces a versioned, content-free human approval-packet format only after the suite passes; it remains offline and cannot approve or change policy, invoke AI/RAG, or route media.
- **Offline route-safety calibration** — A checked-in synthetic matrix now verifies that a high policy candidate remains behind provider recovery, evidence, AI-advisory, provenance, confirmation, fallback, low-confidence, and clarification safeguards before the human-only calibration packet is available.

### Changed

- **Client development tooling** — Adopt PR #528's Vitest 5, coverage, PostCSS,
  globals and Node declaration updates locally with full client test validation.

- **Client routing maintenance** — Adopt Vue Router 5.3.1 locally from PR #527,
  with auth/setup navigation and browser regression checks.

- **Server development tooling** — Adopt PR #530's Jest, Knip, globals and Node
  declaration updates locally, with ESM, database and container validation.

- **Pinned QEMU action maintenance** — Adopt the verified v4.3.0 action revision
  locally from PR #526, retaining the existing release trigger and full SHA pin.

- **Server runtime dependencies** — Locally applied and tested the
  express-rate-limit, Undici and Zod updates from PR #529, including a transport
  compatibility fix identified during validation.

- **Policy score-band resolution** — The ranker now uses a pure shared resolver for its existing ordered score actions, making the default 40/60/85 boundaries directly testable without changing route-safety authority.
- **AI readiness controller** — AI Settings now leads with one server-owned, self-updating readiness state; visible-page refreshes are pausable, while runtime evidence, history, compatibility checks, receipts, and preflight observations are lazy diagnostics.
- **AI evidence minimization** — Candidate adjudication sends bounded profile distributions and limited historical titles only to a syntactically trusted local Ollama endpoint; all other providers and hosts receive aggregate availability, size-band, and match facts.
- **Catalog evidence minimization** — Current-library lookup sends at most three title/year matches per candidate only to a syntactically trusted local Ollama endpoint; other providers receive aggregate retrieval facts only.
- **Comparison coverage precision** — Destination competition now distinguishes complete active-competitor coverage from a genuinely capped comparison, including the exact-cap case, without exposing an active-policy total or identity.
- **Shared-eligibility explanation** — Destination competition now explains possible overlap through allow-listed, anonymous declared-purpose category aggregates without exposing policy terms or changing routing authority.
- **Destination competition preview** — Existing-policy maintenance can now compare a proposed draft against bounded, anonymous active same-media-type competitors and report aggregate deterministic eligibility overlap before saving.
- **Policy cohort preview** — Existing-policy maintenance can now compare a saved policy and unsaved draft against a bounded recent deterministic cohort, returning aggregate native-eligibility deltas before the draft is saved.
- **Policy overlap precision** — Current-policy coverage and draft preflight now flag a shared `require_any` purpose alternative even when a sibling term is unique, preventing broad fallback matches from being presented as safely distinct.
- **Offline evaluation coverage** — The semantic evidence corpus now covers declared-scope conflict, semantic overreach, clear series, and low-margin uncertainty cases rather than only the original four examples.
- **Dependency maintenance** — Applied and locally tested the Axios 1.20.0 update from open PR #521 without merging the pull request or creating a release.
- **Dependency maintenance** — Applied the server-tooling updates from open PR #525 locally for validation without merging the pull request or creating a release.
- **Dependency maintenance** — Applied and locally tested the Morgan 1.12.0 runtime update from open PR #524 without merging the pull request or creating a release.
- **Dependency maintenance** — Applied the client-tooling updates from open PR #523 locally for validation without merging the pull request or creating a release.
- **Dependency maintenance** — Applied the client runtime updates from open PR #522 locally for validation without merging the pull request or creating a release.

### Fixed

- **Error Logs authorization** — Detailed Error Logs, exports, and log
  mutations now require administrator authorization in addition to
  authentication and rate limiting.

- **AI capability metric persistence** — Successful AI work no longer emits a
  misleading telemetry warning when recording a model-digest mismatch counter;
  the PostgreSQL upsert now preserves its `BIGINT` parameter type.
- **Capability telemetry failure-log minimization** — Metric-write persistence
  warnings now retain only a fixed stage and SQLSTATE-class category, rather
  than provider/model values, raw database exceptions, or stack traces.

- **Candidate-adjudication retry persistence** — The classification-history
  method contract now admits completed bounded candidate-adjudication results,
  preventing valid local retry work from repeatedly failing while it is saved.

- **Classification evidence retention** — Post-classification routing now
  patches only its owned metadata fields, preserving the policy, RAG,
  cross-library, and AI-advisory evidence persisted by the current decision.
- **Policy precision** — Broad genres inferred from a library profile no
  longer qualify as specialized destination identity evidence.
- **Migration constraint safety** — Migration preflight now rejects effective PostgreSQL constraint-name collisions before startup; the new review-history tables use concise identifiers and repair earlier local pre-release names.

### Security

- **Bounded policy-maintenance evidence** — The route-safety handoff is
  administrator-only, rate-limited, no-store, parameter-free, aggregate-only,
  and incapable of changing policy, routing, learning, retries, AI, or RAG.
- **Route-safety readiness boundary** — The administrator-only, no-store, rate-limited aggregate uses a fixed completed window and gate allow-list, exposes no media, library, policy, provider, prompt, response, or actor data, and cannot call AI/RAG or change policy, learning, retry, or routing behavior.
- **Capability telemetry health boundary** — The administrator-only, no-store,
  rate-limited status signal has no caller-selected dimensions, returns only
  fixed counts/timestamps and a server-owned status vocabulary, excludes raw
  logs/provider/model/media data, and cannot write telemetry or influence AI,
  policy, RAG, classification, or routing.
- **Capability telemetry trend boundary** — The completed-window trend is
  administrator-only, no-store, rate-limited, parameter-free, and
  aggregate-only. It exposes no provider/model/media/log dimension or raw
  diagnostic data, rejects incoherent contracts in the browser, and cannot
  call AI, write telemetry, retry, or influence policy, RAG, classification,
  or routing.
- **Offline fixed-band evidence boundary** — The fixed-path corpus pins the versioned default baseline, rejects unknown or authority-bearing data, reports only aggregate results, and cannot read live configuration, invoke AI/RAG, alter policy, or route media.
- **Offline route-safety evidence boundary** — The fixed matrix permits only bounded synthetic gate controls, exercises the existing server-owned safety resolver, returns aggregate-only results, and has no API, storage, provider, AI/RAG, policy, retry, approval, or routing authority.
- **AI readiness refresh boundary** — Automatic AI Settings refreshes call only the existing administrator-authorized saved-capability read at a visible-page bound; they cannot probe providers, discover models, write settings, route media, or expose raw scheduled-preflight errors.
- **Offline calibration evidence boundary** — The fixed-path synthetic corpus accepts only allow-listed aggregate status combinations and fixed procedures, returns aggregate pass/fail data only, rejects authority-bearing or live fields, and has no API, storage, provider, AI/RAG, policy, approval, or routing authority.
- **Adjudication authority boundary** — The server validates every proposal against the original policy-owned candidate set, discards model reasoning and confidence, persists only allow-listed status facts, and always keeps routing behind the operator decision.
- **Ollama endpoint trust boundary** — Detailed candidate profiles and historical titles now require a syntax-validated trusted-local endpoint; an arbitrary DNS name or public address receives aggregate-only evidence.
- **Current-library retrieval boundary** — Candidate-owned library IDs, media type, and result caps are fixed server-side; descriptions are never returned from the read-only query, unexpected library rows are discarded, and retrieval failure remains advisory and unavailable.
- **Retrieved-text containment** — Catalog title evidence is normalized to a bounded single line and retrieval labels are allow-listed before prompt construction, limiting prompt-shaped media metadata.
- **Retrieval telemetry boundary** — Candidate lookup observations use a server-built, allow-listed projection; the authenticated aggregate report omits media, library, provider, prompt, response, actor, and exact-duration data and cannot alter AI, policy, learning, or routing.
- **Candidate-set attribution boundary** — The server computes membership only from the validated runtime-question contract and persists a fixed status with no candidate, destination, operator, media, or provider identity.
- **Candidate-set readiness boundary** — Policy-review readiness uses only existing content-free aggregate counters and fixed thresholds; it returns no identities, introduces no new retention path, and has no AI, policy, learning, retry, or routing authority.
- **Policy-score explanation boundary** — Score explanations expose only allow-listed source and calibration IDs with bounded numeric mechanics; they exclude policy terms, media, identities, provider/model data, prompts, raw output, diagnostics, and routing controls.
- **Policy confirmation evidence boundary** — Confirmation-evidence readiness uses a static, parameterized aggregate query and fixed source/status vocabulary; it returns no history object, media, policy, library, actor, provider, model, prompt, response, or routing control and creates no new retention path.
- **Policy confirmation-evidence uncertainty boundary** — The confidence gate accepts only bounded aggregate counts and emits fixed method metadata and percentage bounds; it cannot expose identity, create retention, invoke AI, edit policy, retry work, or route media.
- **Policy-scope handoff boundary** — The evidence-review link accepts and recognizes one fixed focus token only; it cannot select a policy, expose telemetry identity, invoke AI, or alter policy, learning, or routing.
- **Score-comparison data boundary** — Pending-score comparisons are capped in browser memory, revalidate only allow-listed numeric mechanics, and expose no new identity, API, telemetry, AI, policy, retry, learning, or routing path.
- **Candidate-evidence card boundary** — Pending-review evidence cards use only fixed source/state identifiers, reject unknown client input, expose no raw metadata or retrieval text, and cannot invoke AI, alter scores, learn, or route media.
- **Library-evidence profile boundary** — Candidate comparisons are built server-side from the existing policy-owned candidate set, cap at three libraries, and expose only existing library names, rounded scores, score margins, and allow-listed evidence states; descriptions, catalog titles, policy terms, IDs, prompts, provider data, raw model output, and routing controls remain unavailable.
- **Contrastive inventory boundary** — Cross-library identity checks use a server-owned same-media candidate set and one parameterized exact-ID read; rows, identities, catalog text, and provider data are discarded before a fixed advisory status is persisted or displayed.
- **Contrastive outcome telemetry boundary** — The server derives both attribution axes from persisted fixed evidence and the validated runtime-question contract; static aggregate queries and an allow-listed client view retain no item, library, candidate, destination, actor, provider, prompt, response, or routing control.
- **Offline semantic-evaluation boundary** — The fixed local corpus accepts only allow-listed status identifiers, rejects raw runtime/provider fields, exposes no fixture names in reports, accepts no arguments or network input, and has no authority to invoke AI, learn, edit policy, retry, route, or affect an operator workflow.
- **Pinned snapshot boundary** — Semantic evaluation validates versioned local artifacts, SHA-256 manifest pins, and one-to-one fixture/snapshot IDs before scoring; it returns only allow-listed status IDs and never exposes vectors, similarities, retrieval text, or a live RAG path.
- **Correction-analytics boundary** — Versioned server snapshots, validated operator-outcome attribution, a static aggregate query, and strict client projections retain and expose only fixed score-margin, evidence-state, and selection-status dimensions; no media, policy, library, candidate, destination, actor, provider, prompt, response, raw RAG text, or routing control is added.
- **Correction-readiness uncertainty boundary** — Fixed 95% Wilson review signals accept only bounded aggregate counts, preserve the static read-only query and existing authentication boundary, and return no identity, configuration, AI, policy, RAG, learning, retry, or routing authority.
- **Correction temporal-stability boundary** — Adjacent-window monitoring reuses the authenticated static aggregate query with server-built dates and strict client revalidation; it returns only fixed aggregate dimensions and derived statuses, with no event history, identity, configuration, AI, RAG, policy, learning, retry, or routing authority.
- **Correction cohort-composition boundary** — The fixed TVD screen reuses existing count-only aggregates, validates every derived client value, and returns no item, destination, policy, library, provider, prompt, response, RAG text, configuration, or routing control; it cannot invoke AI, tune policy, learn, retry, or route media.
- **Long-horizon correction boundary** — The 28-day trend uses only server-built completed periods and existing aggregate reads, exposes a compact allow-listed cohort result, and is re-derived by the client; it adds no identity, configuration, AI, RAG, policy, learning, retry, or routing authority.
- **Representative review-handoff boundary** — The conditional handoff recognizes only the strict sustained-review status and navigates to one fixed existing Command Center anchor; it sends no request or filter and carries no media, policy, library, candidate, destination, actor, provider, prompt, RAG, configuration, or analytics identity.
- **Historical review-corpus boundary** — The new v6 preflight derives only fixed content-free readiness from the sustained aggregate state, rejects historical-record access in both server and client contracts, and adds no query, storage, export, selection, AI, RAG, policy, learning, retry, or routing authority.
- **Historic review-corpus control boundary** — The administrator-only control plane accepts only an exact acknowledgement contract, keeps response DTOs content-free and no-store, serializes writes with a transaction lock, and records only minimal append-only audit metadata; it cannot select, expose, or authorize historic records.
- **Redacted review-projection boundary** — The administrator-only snapshot uses a parameterized server-side allow-list, persists no history identity or content, exposes no-store fixed categories only, audits creation/view/expiry minimally, and deletes expired snapshots through a locked scheduled transaction; it cannot invoke AI/RAG, alter policy, or route media.
- **Policy-change outcome boundary** — The administrator-only outcome protocol accepts no policy, receipt, range, or hypothesis selector; it binds one short-lived server-generated aggregate baseline to a recent native receipt, uses fixed windows and no-store reads, rate-limits the explicit start flow, automatically deletes expired observations, and exposes no policy, media, library, provider, prompt, response, RAG, or routing authority.
- **Review-history data boundary** — The administrator-only summary uses fixed completed UTC periods, static aggregate reads, response allow-lists, no-store, rate limits, and bounded retention. It stores no individual activity, outcome, policy, media, library, actor, rationale, provider, prompt, response, or RAG data, and cannot trigger policy, AI, routing, learning, retry, or classification work.
- **Offline calibration-protocol boundary** — The existing administrator-only, no-store summary now exposes only a fail-closed fixed human procedure from already-redacted aggregate status; it creates no threshold, proposal, export, write, provider call, AI/RAG access, policy change, or routing authority.
- **Axios runtime hardening** — Updated Axios to 1.20.0, incorporating upstream hardened handling of runtime option objects relevant to prototype-pollution-style configuration reads.

- **Comparison-cap privacy boundary** — Coverage detection uses one server-only sentinel to identify omitted competitors; the sentinel, total active-policy count, configurations, identities, and routing authority remain unavailable to clients.
- **Explanation privacy boundary** — Shared-eligibility explanations expose only allow-listed category labels and anonymous configuration counts after a bounded shared result; they never return rule values, competitor identities, item outcomes, AI state, or routing control.
- **Competition-preview privacy and resource boundary** — The administrator-only competition preview derives competitors and fixed caps server-side, uses batched native-intent reads and parameterized SQL, returns no competitor or media identity, and cannot call AI, persist, learn, or route media.
- **Cohort-preview privacy and authority boundary** — The administrator-only simulation accepts only a validated draft, derives scope and fixed bounds server-side, uses a parameterized read-only query, returns aggregate counts only, and cannot call AI, persist a draft, learn, or route media.
- **Policy-review data boundary** — Disjunctive-overlap guidance remains administrator-only and aggregate-only: it returns counts and fixed guidance without exposing policy terms, draft contents, media data, AI output, or routing controls.

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
