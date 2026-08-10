# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

Current development changes will be recorded here.

### Added

- **GHCR manifest retention inventory** — Added a GET-only, graph-aware inventory that protects tagged OCI indexes and every referenced platform or attestation manifest while reporting untagged artifacts for manual review only.

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
