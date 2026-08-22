# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

Current development changes will be recorded here.

### Added

- **AI classification evaluation foundation** — Added a versioned,
  machine-readable local evaluation-fixture contract and side-effect-free ESM
  grader. Policy-owner fixtures can define exact classified, clarification, or
  retry outcomes with method, history-status, library, confidence, and fallback
  requirements; the grader fails closed on malformed or unbounded inputs and
  verifies the bounded AI result agrees with persisted history.

- **Compatibility-deletion release review artifacts** — A new local ESM
  generator produces a fresh, fingerprint-bound, non-approving review request
  from bounded execution-plan evidence. It expires with its source evidence,
  refuses unsafe output paths, and lists the exact named release-review
  attestations without manufacturing an approval or deletion authority.

- **Bounded native-change receipt retention** — Immutable native-purpose
  change receipts now retain exact replay state for 30 days and are pruned only
  by a scheduler-owned, lock-protected, age-ordered transaction. Database-side
  enforcement protects current replay and 60-minute recovery receipts; capacity
  pressure reports aggregate warnings instead of deleting protected receipts or
  adding a receipt-history surface.

- **Recent native-change status** — Native-purpose maintenance now restores one
  recent current-administrator change status after reload through a fixed-window,
  actor- and policy-bound, read-only `no-store` lookup. The passive revision
  notice exposes no retry key, fingerprint, command, receipt identifier,
  timestamp, history, policy content, AI, routing, learning, or mutation path.
- **Native intent change retry safety** — Native-purpose changes now require a
  volatile browser-generated idempotency key and persist a compact immutable,
  actor-, policy-, revision-, and canonical-command-bound receipt with the
  committed native intent revision. Exact response-loss retries replay the
  bounded original result without creating another revision; no raw rule, AI,
  compatibility, routing, profile, RAG, or history content is retained.

- **Native purpose maintenance** — Added an administrator-only native-purpose
  form that reads a narrow server-owned command and revision, offers
  aggregate-only coverage advice, and applies one locked, revision-checked
  `update_purpose` command without reopening compatibility authoring or using
  AI, routing, or learning data.
- **Native purpose-change preflight** — Native maintenance now has an
  administrator-only, revision-bound aggregate `update_purpose` advisory that
  derives current authority server-side and cannot retain terms, authorize a
  change, call AI, write data, or affect routing.
- **Policy purpose coverage preflight** — Existing policy maintenance can request an
  admin-only aggregate draft check before save without term retention, AI, writes, or routing changes.
- **Policy purpose coverage review** — Added a bounded administrator-only
  native-policy report for missing specialized purpose coverage and shared
  same-media-type overlap, with fixed editor guidance and no routing changes.
- **Reconciliation operator remediation** — Added an administrator-only,
  bounded unresolved-policy inventory that opens the existing validated policy
  editor for an explicit destination-purpose review while leaving conversion to
  the protected scheduler.
- **Specialized destination evidence calibration** — Added current,
  server-derived native-purpose comparison that distinguishes specialized
  identity evidence from shared broad overlap and gives pending-decision
  operators fixed explanations without retaining matched terms or using AI,
  profile, history, or library names as route authority.

### Changed

- **Workflow dependency pins** — Applied open Dependabot PR #516 locally
  without merging it, advancing the pinned Docker Buildx action to v4.3.0 and
  the OSV Scanner action/reusable workflows to v2.5.1.

- **CodeQL security actions** — Applied Dependabot PR #511 locally (without
  merging it), advancing the pinned CodeQL init, analysis, and SARIF-upload
  action revision to v4.37.7.

- **Native Policy Intent Storage** — Current closure evidence remains bound to
  the native schema, authority, migration, reconciliation, safety, and audit
  components. Compatibility source retirement remains separately blocked until
  its approved deletion evidence chain is replay-valid.
- **Compatibility-removal closure evidence** — Re-evaluated regeneration
  against a running immutable release image and documented the non-substitution
  boundary: image provenance and release-installation records select a
  deployment but cannot replace the approved, replayable post-removal evidence
  chain required to retire compatibility code.
- **Server tooling dependencies** — Updated `@types/node` to 26.2.0, `eslint`
  to 10.8.1, `eslint-plugin-n` to 18.3.0, `globals` to 17.11.0, and `knip` to
  6.32.2.
- **Client test isolation** — Fresh router tests now await their deliberate
  guard-bypass initial navigation, and Vitest uses a bounded jsdom worker pool
  to prevent asynchronous setup checks and resource starvation from leaking
  into later client tests.
- **Reconciliation attention alerts** — Alert notifications now target the
  remediation screen and emit once per firing incident instead of repeating
  every six hours until the durable alert state resolves.

### Fixed

- **Router test stability** — The asynchronous native-intent reconciliation
  route test now has an explicit, narrow 10-second budget for lazy-route
  loading under constrained host concurrency without weakening the global test
  timeout.

- **Local backup and restore verification** — Removed the obsolete
  `ai_config` backup/restore path, which referenced a table intentionally
  absent from the current schema, and preserve libraries required by completed
  classification history during replace restores. Together, these fixes allow
  a fresh verification cycle without corrupting history integrity.
- **Schema snapshot drift gate** — Ignore informational PostgreSQL and
  `pg_dump` patch-version banners during snapshot comparison, so upstream
  patch releases cannot cause false schema drift while semantic SQL changes
  still fail the gate.
- **Native-purpose change audit** — Added the constrained
  `native_intent_change_applied` event vocabulary so a valid native-purpose
  revision no longer rolls back because the audit-event database constraint
  rejected its recorded outcome.

## [0.48.1-beta] - 2026-08-13

### Added

- **Verification capability change receipts** — Added actor-scoped,
  transactional strict-capability history without provider configuration or authority changes.
- **Saved verification capability summary** — AI Settings now shows the
  server-owned current strict-verification capability, refreshes it after an
  AI-settings save or explicit operator request, ignores stale reads, and
  links to aggregate Verification monitoring without provider probes or
  routing changes.
- **Verification-capability save preflight** — AI Settings now receives a
  server-owned, no-probe strict-verification capability warning before saving
  provider settings and requires explicit continuation for advisory paths.

- **Candidate-bound AI verification** — Added a strict `CONFIRM` or `ABSTAIN`
  response contract that binds verification to the server-selected policy
  candidate, requires contract-grade structured-provider admission before any
  prompt or generation, and retains only bounded verification status in
  history.
- **Candidate-bound verification explanations** — Pending-decision review now
  presents a fixed verification status for confirmation, abstention, rejected
  output, unavailable capability, and candidate mismatch without exposing
  provider or model content.
- **Candidate-bound verification monitoring** — Added status-only outcome
  counts, a sample-gated drift comparison, and a read-only Statistics view
  without retaining item, provider, model, prompt, or response content.
- **Candidate-bound verification remediation readiness** — Added an
  administrator-authorized, read-only report that correlates aggregate trend
  status with current provider admission and anonymous active-policy readiness
  without exposing AI content or mutating provider, policy, routing, or retry
  state.

- **Historic route-safety maintenance surface** — Added a bounded administrator maintenance route for explicit historical retry selection, acknowledgement, and privacy-preserving receipt status monitoring without local receipt persistence or background-tab polling.
- **Historic retry receipt reconciliation** — Added durable, transaction-bound historic route-safety retry receipts and an administrator-only, read-only status endpoint that reports bounded current-runtime outcomes without exposing history metadata, task IDs, or provider content.
- **Controlled historic route-safety refresh** — Added an administrator-authorized, 50-item maximum retry command that rechecks the historic condition from the locked current row, preserves duplicate-task protection, and returns a privacy-bounded outcome receipt.
- **Historic route-safety refresh inventory** — Added an admin-only, GET-only, keyset-paginated report that identifies active decisions missing their historic route gate and produces a 50-item retry plan without executing it.
- **Authorized historic-retry resume** — Added a fixed-window, actor-bound recent-receipt discovery read that restores one qualifying maintenance receipt after a reload without browser persistence or receipt-history enumeration.
- **GHCR manifest retention inventory** — Added a GET-only, graph-aware inventory that protects tagged OCI indexes and every referenced platform or attestation manifest while reporting untagged artifacts for manual review only.
- **Immutable image-release retirement assessment** — Added a GET-only, evidence-bound plan that connects an incomplete retained GHCR graph to its named GitHub release, rejects republishing the tag, and requires an external advisory plus separate approval before any remote retirement action.

### Changed

- **AI Settings stale-write protection** — Reads issue opaque no-store ETags; missing or stale saves fail before side effects and reload current settings for
  explicit administrator review without automatic merge or retry.
- **Verification-capability receipt integrity** — AI Settings now serializes
  first-row configuration saves, increments the private receipt revision in
  PostgreSQL without unsafe `BIGINT` conversion, enforces append-only
  capability receipts, and clears non-portable actor-scoped receipts during
  replace restore.
- **Verification safety boundary** — Unsupported, fallback, local, reasoning,
  and candidate-mismatch verification paths now fail to operator-confirmation
  review before prompt construction. Malformed verification output cannot
  select an alternate destination or invoke local response repair.

- **Deterministic AI invocation modes** — Policy and RAG outcomes now select
  explicit AI verification, generic fallback, or server-owned abstention. AI
  no longer receives an ambiguous, manually gated, malformed, or failed policy
  evaluation as a generic destination-selection request; bounded mode facts are
  retained with classification history.
- **OSV scanner action pins** — Updated the Dependabot-proposed `google/osv-scanner-action` references to v2.5.0 across pull-request, merge-group, and full-scan workflows.
- **Client build tooling** — Applied the Dependabot-reviewed `globals` 17.9.0, `postcss` 8.5.26, and `vite` 8.2.1 updates with lockfile integrity preserved.

### Fixed

- **AI repair authority attribution** — Cross-provider or cross-model local repairs now report `fallback_advisory` authority and separate aggregate capability observations instead of inheriting the original provider's authority.

- **Image-retirement command** — Accepted npm 12's documented `tag` configuration forwarding so the retirement-assessment command reaches its bounded release-tag contract.
- **Automatic-route explanations** — Persisted bounded route-safety gates so high-score pending decisions name the actual blocker, including AI advisory authority, weak policy evidence, provider recovery, provenance, and administrative confirmation. Historic decisions that predate this projection now state when their original route-safety details cannot be recovered and require a current retry rather than showing an unnamed safeguard.
- **Dependency-declaration CI gate** — Removed four unused historic-refresh
  compatibility exports so Knip no longer blocks the build and its dependent
  release-acceptance readout.

### Security

- **Client transitive dependency remediation** — Updated the `postcss`-resolved
  `nanoid` lockfile entry to 3.3.18 for the current upstream security advisory.
- **Historic retry receipt authorization** — Direct receipt reconciliation now requires the same server-derived actor that created the receipt and returns the existing generic 404 for foreign or absent receipt IDs.

## [0.48.0c-beta] - 2026-08-09

### Fixed

- **Published image integrity** — Release tags publish the verified GHCR and Docker Hub digest as `latest`; pre-publication validation now checks every referenced OCI manifest and a clean `latest` pull. GHCR package-version cleanup is disabled because it can orphan multi-platform child manifests; alias recovery rejects incomplete release indexes.

## [0.48.0b-beta] - 2026-08-09

### Fixed

- **Policy-score authority** — Pending-decision routing and review cards now use the current candidate-bound policy score and action rather than a generic recheck confidence, preserving explicit confirmation and destination-selection safeguards.

## [0.48.0a-beta] - 2026-08-09

### Fixed

- **Release provenance repository normalization** — Canonicalized the tag-workflow GHCR image repository to lowercase and enforce it in the provenance contract so attestation verification receives a valid OCI reference.
- **Declared-policy versus profile authority** — Prevented an inferred library-profile absence from erasing an active native identity match, falling through to legacy AI classification, or hiding the policy evidence needed for a safe operator decision. Destination labels no longer participate in candidate ordering.
- **Release validation** — Removed a duplicate diagnostics export that blocked the dependency-declaration check and therefore the required release-acceptance readout.
- **Multi-architecture image builds** — Retain `npm ci` lockfile integrity while increasing documented registry fetch retries so a transient ARM64 registry timeout does not abort an otherwise validated release image.
- **Public image provenance verification** — Accept the Sigstore Public Good instance used for this public repository while continuing to require the exact repository, signer workflow, source revision, and GitHub-hosted runner.
- **Published digest consumer startup** — Run the disposable digest-smoke service as the image-owned `1000:1000` user and drop all capabilities, allowing its fresh scoped data volume to initialize without a root bypass.

## [0.48.0-beta] - 2026-08-09

Detailed engineering history is retained in the [August 2026 pre-release archive](docs/changelog/CHANGELOG-2026-08-pre-release.md).

### Added

- **Library-first native policy authoring** — Added an accessible destination-first workflow that starts with the selected media-server library, its observed collection, and the policy questions that define destination meaning.
- **Bounded policy proposals** — Added short-lived, actor-bound proposal references, revision checks, typed allow-listed adjustments, idempotency keys, and one-time consumption so browsers submit commands rather than policy meaning.
- **Native policy creation** — Added transactional, administrator-authorized native intent creation with advisory-lock coordination, durable receipt replay, bounded conflict outcomes, and a post-commit authority projection.
- **Native policy maintenance** — Added persisted-policy entry classification, material-exception guidance, and revision-bound changes for purpose, hard limits, avoidance, helpful matches, routing targets, and review behavior.
- **Accessible authoring controls** — Added keyboard-operable, labelled controls, visible focus handling, concise next-step feedback, scoped recovery actions, and browser acceptance coverage for the complete authoring workflow.
- **Profile-backed policy context** — Added observed-library suggestions, profile freshness and recovery guidance, normalized rating distributions, and a post-upgrade repair path without treating AI or external metadata as policy authority.
- **Native intent storage** — Added versioned headers, executable rules, routing references, validation state, migration events, and time-bounded rollback snapshots while excluding UI drafts, prompts, embeddings, and raw diagnostics.
- **Conversion and reconciliation** — Added migration candidate reporting, conversion planning, scheduler-owned native-policy initialization, overlap protection, one-active-intent enforcement, and bounded non-convertible lifecycle state.
- **Controlled rebuild and rollback** — Added fingerprinted rebuild proposals, comparison and acceptance gates, rollback snapshot persistence, replay-safe replacement, and structured strict-constraint conversion.
- **Canonical policy evidence** — Added read-only evidence collectors and a canonical envelope for profiles, final outcomes, manual corrections, resolved decisions, routing outcomes, and normalized metadata.
- **Evidence provenance controls** — Added deterministic ordering, deduplication, source ownership, freshness, contribution limits, fingerprints, and bounded quality states so repeated or untrusted input cannot gain policy authority.
- **Deterministic decision contracts** — Added server-owned intent, readiness, runtime-decision, question-reduction, and route-outcome handoffs with reason codes, permitted actions, trace context, and audit boundaries.
- **Policy-focused pending decisions** — Added versioned server-owned pending questions, safe leading-destination recommendations, alternative selection, answer replay protection, and one active decision per media identity.
- **Guarded learning** — Added exact-item and outcome-only learning admission from completed runtime resolutions, requests, imports, Discord answers, and manual corrections without allowing them to create broad policy rules.
- **AI authority capability modes** — Added inspectable local and cloud capability modes, shared normalized output handling, privacy-bounded telemetry, and explicit advisory treatment for unsupported, fallback, and non-strict responses.
- **Provider recovery contracts** — Added versioned, redacted provider recovery states for disabled, transient, permanent, and malformed outcomes, including bounded retries and deterministic policy preservation.
- **Classification evidence snapshots** — Added sanitized RAG first- and second-pass neighbor evidence, match counts, final-outcome versus input-signal views, and History detail projections.
- **Decision observability** — Added W3C-compatible decision trace correlation, bounded stage timing, stable queue and WebSocket stage contracts, source fingerprints, and completion audits.
- **RAG quality and recall controls** — Added policy-candidate calibration, trusted-neighbor quality gates, strict constraint evaluation, embedding-contention resilience, and an admin-only approximate-versus-exact recall audit.
- **Provider-neutral web search** — Added shared configuration and adapters for Tavily, Brave Search, and Serper, including encrypted secrets, connectivity checks, purpose coverage, and priority controls.
- **Safe search-provider operations** — Added result normalization, URL and content sanitization, error taxonomy, `Retry-After` handling, quota-aware routing, cooldowns, usage accounting, caching, and decision history.
- **Provider retention and calibration** — Added independently configurable retention, health and cooldown history, per-purpose quality controls, guardrails, analytics, and rate-limited review digests.
- **Discord decision notifications** — Added duplicate-safe pending-decision notifications with structured answer controls and optional server-scoped role or user mentions constrained by Discord allowed-mentions rules.
- **Consistent media-server setup** — Added shared Radarr and Sonarr connection testing, connect-and-save behavior, root-folder and quality-profile feedback, library mapping, and instance removal flows.
- **Live media-server state synchronization** — Added immediate enrichment-state updates for queue, cancel, retry, and dismiss actions plus safer rating-normalization reprioritization when source metadata changes.
- **Release acceptance assembly** — Added versioned CI manifests and bounded evidence that distinguish repository acceptance from active-installation evidence without reading policy, provider, or classification content.
- **Published digest consumer smoke** — Added a disposable, no-port, digest-only smoke command that verifies the expected provenance before starting the published image and checking application and database readiness.
- **Container image provenance verification** — Added multi-architecture image attestations and verification of repository, signer workflow, source revision, and GitHub-hosted runner before release maintenance proceeds.
- **Compatibility-retirement evidence contracts** — Added read-only, fingerprint-bound repository and active-installation closure evidence, explicit blocked diagnostics, and audit coverage without granting mutation authority.

### Changed

- **Deterministic routing authority** — Current policy evidence and library context now determine routes; AI output is normalized, schema-validated, privacy-bounded advisory input that cannot veto a deterministic match or route an item on its own.
- **AI invocation boundaries** — Disabled authority, unsupported verification, and invalid schema states now stop provider calls before invocation; verified output is normalized and marked advisory before any downstream use.
- **Pending-decision experience** — Command Center now presents one unambiguous active item, a scored policy-confirmation recommendation, safe evidence sources, collapsed alternatives, idempotent retries, and recommendation-scoped bulk confirmation.
- **Pending-decision explanations** — Review cards now distinguish policy confirmation from missing evidence, explain automatic and confirmation thresholds, and avoid presenting a score alone as proof of destination identity.
- **Privacy-bounded recovery** — Retry, queue, worker-restart, and RAG recovery retain fixed reason identifiers rather than provider exceptions; stale questions and old recovery diagnostics are safely redacted or regenerated.
- **Existing-installation upgrades** — Supported legacy policies reconcile automatically to native authority, while unsupported input becomes bounded maintenance state and native runtime reads remain available.
- **Compatibility retirement isolation** — Compatibility removal is now a separately gated release-maintenance concern; it cannot interrupt normal authoring, reconciliation, routing, or supported upgrade behavior.
- **Policy authoring model** — Routine policy work now prioritizes destination meaning, observed library evidence, constraints, review behavior, and routing readiness rather than scoring thresholds, provider state, or migration analysis.
- **Media-server authority** — Existing library behavior and media-server context are primary inputs to policy intent; AI, RAG, templates, and external metadata remain bounded supporting evidence.
- **Release trust chain** — Tag releases now verify package-version alignment, publish and attest immutable multi-architecture images, smoke the exact digest, attach bounded evidence to a draft release, and verify immutable release attestation.
- **Installation acceptance hardening** — The manual acceptance workflow accepts only exact `v*` tags, validates the tag contract, disables administrator bypass, avoids fictitious reviewer requirements, and prevents manual input from reaching shell evaluation.
- **Runtime baseline** — Standardized Node.js 24.18.1, npm and npx 12.0.2, and Alpine 3.24 across local tooling, Docker, package engines, and CI.
- **Client runtime dependencies** — Updated Vue to 3.5.41, Axios to 1.19.0, and VueUse to 14.4.0 after clean-install, lint, typecheck, and full client-test validation.
- **Developer tooling dependencies** — Updated ESLint to 10.8.0, Knip to 6.32.0, Testcontainers PostgreSQL to 12.1.0, and Markdownlint CLI2 to 0.23.2 while retaining their quality gates.
- **Database and vector upgrades** — Added PostgreSQL 17-to-18 upgrade coverage, pgvector 0.8.6 extension upgrades for existing databases, and authoritative schema-snapshot validation for fresh installs.
- **Classification history performance** — Reworked canonical outcome selection and lifecycle assembly to use narrow identifiers, one per-page aggregation pass, stable `created_at, id` pagination, and a supporting index.
- **Task queue retention maintenance** — Serialized worker-startup, delayed-startup, and cron cleanup through a nonblocking service-owned advisory lock; cleanup history now records its origin, and age-only retention drains log as routine information rather than capacity pressure.
- **Bounded database failures** — PostgreSQL statement timeouts from classification-history reads now return retryable `503` responses instead of internal-server errors.
- **Client asset delivery** — Retired content-hashed Vite assets now return a bounded 404 response while current assets remain immutable and application navigation still receives the app shell.
- **Workflow and dependency maintenance** — Updated client and server dependencies, restored dependency-declaration checks, refreshed CodeQL and action pins, and retained Markdown, ESM, source-reachability, and product-language gates.

### Removed

- **Compatibility source-mutation tooling** — Removed unreachable mutation commands, filesystem adapters, browser migration previews, dedicated fixtures, and speculative retirement executors; CI now audits against their reintroduction.
- **Legacy authoring diagnostics** — Removed normal-path replay, parity, provider-readiness, metadata-coverage, raw-scoring, reset, and migration-verifier controls so policy work has one server-admitted native path.

### Fixed

- **AI disagreement vetoes** — Prevented advisory AI output from blocking deterministic policy matches or changing a selected destination without valid policy authority.
- **Duplicate and stale pending decisions** — Supersede historical duplicates without deleting audit history, preserve the current decision, and treat retries for an already-active item as idempotent success.
- **Native policy change persistence** — Preserve unchanged rules and routing targets, replace only requested values, and update review behavior atomically so partial policy changes do not lose intent.
- **Weak-evidence promotion** — Prevented stale profiles, hard profile exclusions, broad compatibility, profile-only, and RAG-only signals from becoming primary policy anchors or automatic routes.
- **Profile and reconciliation recovery** — Fixed stale and malformed profile handling, normalization repair, scheduler re-runs, and concurrent reconciliation so supported policy reads remain stable across restart and upgrade paths.
- **Classification-history timeouts** — Fixed inefficient outcome and lifecycle queries that could exhaust the PostgreSQL statement timeout on large histories.
- **Fresh-install RAG indexes** — Restored missing text HNSW snapshot infrastructure and added an integrity check so a fresh database cannot silently start with degraded vector retrieval.
- **PostgreSQL and pgvector startup** — Corrected optimized-vector fallback behavior, PostgreSQL 18 migration handling, and container start timing to prevent affected Docker installations from cycling.
- **Provider resilience** — Correctly classify disabled, transient, permanent, and malformed provider outcomes; sanitize provider data and recover without turning a provider incident into an unsafe route.
- **Initial-account and media-server setup** — Prevented authenticated polling from interrupting first-admin setup and corrected valid Radarr and Sonarr configuration, save, and wizard actions.
- **Library removal and enrichment synchronization** — Close related history before library deletion, prevent rating-normalization loops, and synchronize live media-server state after enrichment actions.
- **RAG identity and recall** — Resolve live library identity when historical names are absent, preserve sanitized fallbacks, and centralize HNSW recall controls and iterative scans.

### Security

- **Server-owned policy authority** — Enforced server authority over policy evidence, intent commands, readiness, routing, learning, reconciliation, rebuilds, and rollback with bounded inputs and explicit handoffs.
- **Untrusted-input rejection** — Reject inherited values, accessors, prototype-pollution keys, unknown fields, stale handoffs, altered fingerprints, and client-supplied authority claims at their owning boundary.
- **Learning and clarification containment** — Prevented stale questions, raw AI rationale, cross-destination candidates, duplicate source events, and legacy Discord controls from creating durable learning or policy changes.
- **Provider-data and secret boundaries** — Mask provider credentials, sanitize normalized provider results, constrain raw-response retention, and keep operational diagnostics bounded.
- **Discord mention safety** — Restrict Discord mentions to selected server-scoped targets through allowed-mentions rules rather than dynamic message content.
- **Compatibility-retirement safeguards** — Require current, fingerprint-valid evidence for any retirement decision and fail closed on stale, cross-plan, malformed, or unsupported evidence without modifying runtime policy behavior.
- **Release workflow hardening** — Preserve full-SHA action pinning, least-privilege permissions, provenance validation, immutable tag and environment contracts, and consumer-side digest verification.
- **Dependency remediation** — Resolved workspace Dependabot alerts and patched audited runtime, tooling, YAML, Markdown, link-detection, glob, Engine.IO, and body-parsing dependency paths.
- **Server dependency hardening** — Updated Express Rate Limit to 8.6.2, js-yaml to 5.2.3, Node type definitions to 26.1.2, and their locked transitive dependencies to remediate reported security exposure.
