# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Added

- **Policy Builder Phase 7R Runtime Evidence Fingerprint** — added stable
  sanitized SHA-256 fingerprints and bounded provenance summaries to runtime
  evidence projections so automation decisions can bind to the exact evidence
  projection without carrying raw evidence labels forward.
- **Policy Builder Phase 7R Runtime Surface Coverage Guard** — hardened the
  runtime decision inventory so classification route entrypoints, pending and
  correction routes, second-pass diagnostics, metadata enrichment, Discord
  pending notifications, orchestration, routing, and persistence paths must have
  explicit cutline decisions before Phase 7R runtime wiring proceeds.
- **Policy Builder Phase 6R Completion Bounded Chain Audit** — added an
  end-to-end bounded completion audit that proves evidence, intent, learning,
  readiness, workflow, and migration handoffs share sanitized evidence
  projection provenance before Phase 6R completion can pass.
- **Policy Builder Phase 6R Migration Boundary Alignment** — added a bounded
  Phase 6R.6 migration/deletion entry point that requires a successful bounded
  operator workflow result and matching sanitized workflow provenance before
  returning a migration plan.
- **Policy Builder Phase 6R Operator Workflow Boundary Alignment** — added a
  bounded Phase 6R.5 workflow entry point that requires successful bounded
  intent and readiness contracts with matching sanitized evidence projection
  fingerprints before returning the destination-first operator workflow.
- **Policy Builder Phase 6R Readiness Boundary Alignment** — added a bounded
  Phase 6R.4 readiness entry point that requires successful bounded evidence,
  intent, and learning contracts with matching sanitized evidence projection
  fingerprints before returning automation readiness.
- **Policy Builder Phase 6R Learning Boundary Alignment** — added a bounded
  Phase 6R.3 learning-guard entry point that requires a successful bounded
  intent result and carried evidence projection fingerprint before evaluating
  learning eligibility, while preserving final outcome recording separately
  from durable learning.
- **Policy Builder Production Naming Cutover Roadmap** — added Phase 9R to the
  intent-model roadmap so phase-coded production services, contracts, telemetry,
  and adapters are renamed to durable product-domain names after the rebuilt
  engine, runtime, storage, and legacy-removal work is proven.
- **Policy Builder Phase 6R Intent Boundary Alignment** — added a bounded
  Phase 6R.2 intent entry point that requires a successful Phase 6R.1 evidence
  boundary result, carries the sanitized evidence projection fingerprint into
  the intent draft, and blocks failed or unfingerprinted evidence handoffs.
- **Policy Builder Phase 6R Evidence Projection Fingerprint** — added a
  sanitized SHA-256 fingerprint and provenance summary to the Phase 6R.1
  evidence boundary so downstream engines can correlate bounded evidence
  without leaking raw evidence labels, provider payloads, quota state, or UI
  diagnostics.
- **Policy Builder Phase 8R Closure Inventory Sync** — classified the
  `PolicyStarterTemplateAccelerator.vue` replacement in the Phase 1R boundary
  and Phase 3R workflow inventories, added focused inventory assertions, and
  documented the validation gap that blocked Phase 8R final closure evidence.
- **Policy Builder Phase 8R Replay Preview Removal** — removed the
  `policyIntentReplayPreview.mjs` compatibility service path, replaced it with
  a Phase 8R replay migration verifier, updated policy write routes and replay
  diagnostics to use the verifier utilities, refreshed focused replay/route
  coverage, and added the verifier to Phase 8R validation evidence.
- **Policy Builder Phase 8R Impact Preview Removal** — removed the
  `policyIntentImpactPreview.mjs` compatibility service path, replaced it with
  a Phase 8R impact migration verifier, updated policy write routes and focused
  route/service tests, and added the verifier to Phase 8R validation evidence.
- **Policy Builder Phase 8R Starter Template Mechanics Removal** — removed the
  `PolicyStarterTemplateMechanics.vue` compatibility path from product code,
  replaced it with `PolicyStarterTemplateAccelerator.vue`, updated focused
  component coverage, and hardened the Phase 8R final-removal reference scanner
  so control-plane manifest strings and tests do not block product/runtime
  removal evidence.
- **Policy Builder Phase 6R Evidence Boundary** — added a server-owned Phase
  6R.1 boundary that validates the public evidence input envelope, adapts
  public section names into the evidence projection shape, builds the
  projection, runs the projection audit, and blocks unsafe inputs before
  downstream intent/readiness engines can consume evidence.
- **Policy Builder Phase 8R Final Requirement Completion Audit** — added a
  final current-state completion audit and
  `npm run policy:phase8r:final-requirement-audit` to verify the full 8R.1
  through 8R.34 sequence against current closure, artifact, roadmap, changelog,
  and focused-test evidence before Phase 8R can be marked complete.
- **Policy Builder Phase 8R Current Repository Closure Audit** — added a
  current-checkout closure audit contract and
  `npm run policy:phase8r:current-closure-audit` to compose current artifact,
  roadmap, changelog, Phase 8R.31 completion-audit, validation, checkpoint, and
  final-readout evidence into one completion decision.
- **Policy Builder Phase 8R Final Closure Readout** — added a
  machine-readable final readout contract and
  `npm run policy:phase8r:final-closure-readout` to classify Phase 8R closure
  as complete or blocked by component, roadmap, removal-audit, validation,
  changelog, artifact-validation, or side-effect evidence.
- **Policy Builder Phase 8R Completion Checkpoint Artifact Exporter** — added
  a machine-readable checkpoint artifact contract and
  `npm run policy:phase8r:completion-checkpoint` to consume component,
  roadmap, Phase 8R.31 completion-audit, validation, and changelog evidence
  before Phase 8R is claimed complete.
- **Policy Builder Phase 8R Compatibility Removal Completion Audit Artifact
  Exporter** — added a machine-readable audit artifact contract and
  `npm run policy:phase8r:completion-audit` to consume Phase 8R.20
  authorization, the approved execution manifest, verified removal evidence,
  final reference scan, and validation evidence before the Phase 8R completion
  checkpoint.
- **Policy Builder Phase 8R Next Compatibility Removal Batch Authorization
  Artifact Exporter** — added a machine-readable authorization artifact
  contract and `npm run policy:phase8r:next-batch-authorization` to consume
  verified Phase 8R.19 evidence, the approved execution manifest, requested
  remaining paths, and operator authorization metadata before continuing the
  compatibility-removal loop.
- **Policy Builder Phase 8R Post-Removal Runtime Verification Artifact
  Exporter** — added a machine-readable verification artifact contract and
  `npm run policy:phase8r:post-removal-verification` to consume Phase 8R.18
  apply-result JSON plus explicit import/reference scan, runtime check, and
  validation evidence before authorizing the next compatibility-removal batch.
- **Policy Builder Phase 8R Controlled Removal Apply Artifact Exporter** —
  added a machine-readable apply artifact contract and
  `npm run policy:phase8r:removal-apply` to consume a ready Phase 8R.17
  removal-batch JSON plus explicit operator confirmation, apply supported
  repo-relative file deletion only when `--apply-files` is passed, and emit
  Phase 8R.18 apply evidence for post-removal runtime verification.
- **Policy Builder Phase 8R Controlled Removal Batch Artifact Exporter** —
  added a machine-readable removal-batch artifact contract and
  `npm run policy:phase8r:removal-batch` to generate Phase 8R.17
  controlled-removal batch JSON from a ready execution plan, explicit
  execution-gate evidence, selected approved manifest paths, review reason, and
  reviewer metadata without applying compatibility removals.
- **Policy Builder Phase 8R Execution Plan Artifact Exporter** — added a
  machine-readable execution-plan artifact contract and
  `npm run policy:phase8r:execution-plan` to generate Phase 8R.15
  execution-plan JSON from explicit readiness, deletion-gate, replacement,
  rollback, support, approval, and actor evidence without fabricating readiness
  or applying compatibility removals.
- **Policy Builder Phase 8R Final Removal Audit Exporter** — added a
  machine-readable final-removal-audit evidence contract and
  `npm run policy:phase8r:final-removal-audit` to compose the Phase 8R.21 audit
  from an explicit execution-plan manifest, current checkout path state, source
  reference scan, and validation JSON; reports remaining inventory instead of
  claiming closure when approved manifest paths still exist.
- **Policy Builder Phase 8R Completion Evidence Run** — added a
  side-effect-free evidence-run service that consumes explicit Phase 8R artifact
  inventory, normalizes Windows/POSIX paths, maps 8R.1 through 8R.22 docs,
  contracts, and focused tests into checkpoint evidence, composes the Phase
  8R.22 completion checkpoint, and blocks closure when inventory, artifact,
  roadmap, final-removal-audit, validation, or changelog proof is incomplete;
  added a current-state collector plus `npm run policy:phase8r:evidence` to
  gather mapped artifact, roadmap, and changelog evidence from the checkout
  while requiring caller-supplied final-removal-audit and validation JSON before
  completion can pass.
- **Policy Builder Phase 8R Validation Evidence Generator** — added a fixed
  command-spec validation evidence contract and
  `npm run policy:phase8r:validation-evidence` to generate checkpoint-compatible
  focused, lint, markdown, and full server validation JSON for the Phase 8R
  closure evidence run.
- **Policy Builder Phase 8R Completion Checkpoint** — added a
  side-effect-free phase completion checkpoint that consumes component,
  roadmap, final-removal-audit, validation, and changelog evidence for the full
  Phase 8R sequence; blocks closure when any expected phase lacks
  implementation, design-doc, contract, focused-test, roadmap, changelog, or
  validation proof.
- **Policy Builder Phase 8R Compatibility Removal Completion Audit** — added a
  side-effect-free audit service that consumes Phase 8R.20 completion
  authorization, the approved deletion manifest, verified removal evidence,
  final import/reference scan evidence, and focused/full validation results;
  reports remaining compatibility inventory separately from failed evidence and
  blocks completion claims when coverage, scans, validation, or side-effect
  invariants are not proven.
- **Policy Builder Phase 8R Next Compatibility Removal Batch Authorization** —
  added a side-effect-free authorizer that consumes verified post-removal
  runtime evidence and the approved deletion manifest, calculates remaining
  compatibility paths, blocks unknown or already removed path selections,
  bounds the next batch size, requires operator authorization context, and
  advances to a completion audit when no approved manifest paths remain.
- **Policy Builder Phase 8R Post-Removal Runtime Verification** — added a
  side-effect-free verifier that consumes controlled-removal apply evidence,
  import/reference scan evidence, focused runtime checks, and focused/full
  validation results; blocks additional compatibility removal batches when
  removed paths remain referenced, runtime checks fail, validation evidence is
  missing, or storage/Git side effects are reported.
- **Policy Builder Phase 8R Controlled Compatibility Path Removal Apply** —
  added an adapter-driven apply boundary that consumes a ready removal review
  batch, requires explicit execute confirmation with a confirming actor, applies
  entries only through an injected adapter, verifies result path/action parity,
  captures adapter failures as bounded risks, and rejects archive, storage, or
  Git-command side effects inside the service.
- **Policy Builder Phase 8R Controlled Compatibility Path Removal** — added a
  side-effect-free removal-batch contract that consumes a ready deletion
  execution plan and final gate output, limits selected manifest paths to a
  narrow reviewed batch, requires removal reason and reviewer metadata, blocks
  empty, unknown, or too-broad selections, and defers destructive application to
  a later controlled apply step.
- **Policy Builder Phase 8R Compatibility Path Deletion Execution Gate** —
  added a final side-effect-free preflight gate that consumes the deletion
  execution plan and blocks controlled deletion unless the worktree, backup and
  restore evidence, operator approval, final rollback/support stances, and
  manifest freshness are confirmed.
- **Policy Builder Phase 8R Compatibility Path Deletion Execution Plan** —
  added a side-effect-free manifest builder that consumes deletion readiness and
  legacy deletion categories, enumerates exact compatibility paths with action
  IDs and replacement evidence, and blocks execution planning without rollback
  stance, support stance, and explicit approval.
- **Policy Builder Phase 8R Compatibility Path Deletion Readiness** — added a
  side-effect-free readiness report that composes native runtime cutover
  verification with legacy deletion gates, blocks on residual compatibility
  references and missing backup/rollback/support/manifest confirmations, and
  advances only to a deletion execution-plan step rather than deleting code.
- **Policy Builder Phase 6R Evidence Input Gate** — added a server-side evidence
  input envelope gate that maps allowed Phase 6R.1 input sections to evidence
  sources and authority sources, rejects unknown sections plus raw provider
  payloads, live lookup markers, quota/cooldown state, UI diagnostic labels,
  and replay/impact preview payloads before projection, and documents the
  secure evidence-boundary design.
- **Policy Builder Phase 8R Native Runtime Cutover Verification** — added a
  native policy read loader that attaches active native intent rows before
  detailed policy projection; detailed `GET /api/policies/:id` now returns
  native `configuration_view`, `policy_intent_contract`, and
  `policy_intent_read_trace` for converted policies while unconverted policies
  stay on the compatibility bridge; added a cutover verification service that
  checks converted/native and unconverted/compatibility read behavior, rollback
  availability, deletion blocking, and bounded support diagnostics before any
  compatibility paths can be removed.
- **Policy Builder Phase 8R Post-Upgrade Apply Gate** — added a native intent
  apply-gate service that requires a current dry-run and database transaction
  boundary before conversion; writes native intent headers, rollback snapshots,
  rules, routing targets, starter-template provenance, validation status, and
  migration events atomically; reports rollback-safe operator error IDs on
  failure; skips already-active target-version native intents; wires a
  `phase8r_native_intent_apply_gate` post-upgrade action without registering it
  as an automatic release-version task; and keeps legacy paths undeleted until
  later cutover/deletion gates pass.
- **Policy Builder Phase 8R Post-Upgrade Dry-Run Wiring** — added a bounded
  native intent post-upgrade dry-run service that loads policy, library, ARR
  mapping, and preset inputs; runs the existing Phase 8R migration candidate
  report and explicit conversion workflow in plan-only mode; reports ready,
  review-required, and no-policy states with bounded operator error IDs; wires a
  `phase8r_native_intent_dry_run` post-upgrade action; and keeps native
  conversion apply disabled until transaction and rollback gates are
  implemented.
- **Policy Builder Phase 8R Native Backup And Restore Wiring** — wired native
  policy intent tables into the live backup/export and transactional restore
  path; backup payloads now include native intent headers, rules, routing
  targets, starter-template provenance, migration events, rollback snapshots,
  and validation status; restore remaps old policy, library, and native intent
  IDs before inserting native child rows; replace-mode cleanup clears native
  intent tables explicitly; and restore stats now include bounded native intent
  recovery counts without logging raw policy payloads.
- **Policy Builder Phase 8R Native SQL Migration Coverage** — added the native
  policy intent storage migration, regenerated the authoritative schema
  snapshot, and expanded migration/reset tests to prove native intent headers,
  rules, routing targets, starter-template provenance, migration events,
  rollback snapshots, validation status, active-version uniqueness, JSONB rule
  indexing, rollback expiry indexing, and validation lookup coverage exist for
  fresh-install and upgraded-install paths.
- **Policy Builder Phase 8R Native Storage Test Reset** — added a
  side-effect-free test reset service, architecture record, and audit suite that
  inventories Phase 8R schema contract, migration candidate, explicit
  conversion, native runtime read, rollback/reversion, legacy write-blocking,
  backup/restore safety, and deletion-gate tests; makes native SQL migration
  coverage a named blocker instead of inferring it from schema-contract tests;
  scopes legacy payload preservation tests to unconverted policies, rollback
  snapshots, or maintainer fixtures; and marks abandoned impact/replay
  diagnostic tests as deletion-scoped rather than final native-storage product
  coverage.
- **Policy Builder Phase 8R Backup, Restore, And Post-Upgrade Safety** — added a
  side-effect-free operational safety service, architecture record, and audit
  suite that enumerates native intent tables from the Phase 8R schema contract;
  requires native table backup and restore coverage; requires restore validation
  for native policy recovery, rollback snapshots, migration events, and schema
  version checks; blocks post-upgrade apply without current dry-run reporting;
  requires atomic rollback-safe apply semantics that prevent mixed partial
  native/legacy writes; and validates clear operator-facing migration error IDs
  before native storage can be treated as operationally ready.
- **Policy Builder Phase 8R Legacy Code Deletion Gates** — added a
  side-effect-free deletion-gate service, architecture record, and audit suite
  that classifies client bridge UI, legacy serializer/deserializer paths,
  custom-signal mutation helpers, preset-as-policy runtime behavior, old
  preview/replay diagnostics, and stale compatibility tests; requires native
  read/write, runtime decision, conversion/reversion, backup/restore,
  post-upgrade dry-run/apply, and deletion-gate coverage; blocks deletion while
  unconverted policy count is unknown or non-zero; requires an explicit support
  stance; rejects hiding or preserving replaced code permanently; and validates
  that this planning slice performs no file, route, test, or storage side
  effects.
- **Policy Builder Phase 6R Evidence Summary And Reducer Cutlines** — hardened
  the Phase 6R evidence engine with generated projection summaries for bucket
  counts, source IDs, authority-source IDs, blocking evidence, and review
  evidence; added audit coverage that rejects missing or stale summaries; and
  classified legacy replay/impact reducers as delete, rewrite-as-evidence, or
  maintainer-only migration material so diagnostic reducers cannot return to
  the normal operator workflow.
- **Policy Builder Phase 8R Legacy Write Path Shutdown** — added a
  side-effect-free write-boundary service, architecture record, and audit suite
  that blocks converted policies from accepting legacy preset/custom-signal
  behavior writes; allows converted metadata-only edits; keeps unconverted
  compatibility writes time-bounded with warnings and a removal checklist;
  requires native write readiness before native intent payloads are allowed; and
  gates new policy legacy defaults once native default readiness is proven.
- **Policy Builder Phase 8R Rollback Snapshot And Reversion Window** — added a
  side-effect-free rollback-window service, architecture record, and audit suite
  that plans bounded rollback snapshots before native conversion or accepted
  rebuilds; requires restore coverage for preset attachments, weights,
  thresholds, `customSignals`, routing/mapping references, migration actor, and
  reason; limits rollback windows to a default 14 days with a one-to-thirty-day
  validation boundary; blocks ordinary reads and unrelated saves from triggering
  revert; and requires bulky legacy snapshot payload deletion after expiry while
  retaining only minimal support/compliance audit metadata.
- **Policy Builder Phase 8R Native Runtime Read Path** — added a focused
  server read-path service and mapper integration that prefers attached active
  native intent for converted policies, keeps unconverted policies on the
  compatibility bridge, returns a stable `configuration_view`,
  `policy_intent_contract`, and `policy_intent_read_trace` shape for both
  sources, surfaces invalid active native intent without falling back to legacy
  custom signals, and emits bounded `classifarr.phase8r.read.*` source trace
  metadata with validation that rejects custom-signal-dependent native reads or
  read-path storage side effects.
- **Policy Builder Phase 6R Evidence Projection Audit** — hardened the Phase 6R
  evidence engine with a server-owned projection-instance audit that validates
  generated or tampered evidence projections after construction; blocks unknown
  buckets, sources, authority sources, unsafe source-to-bucket ownership, raw
  payload leakage, live provider lookup markers, UI diagnostic language,
  metadata-owned destination identity, and non-operator hard-limit or avoid
  evidence; and updates the Phase 6R evidence design record and roadmap.
- **Policy Builder Phase 8R Explicit Conversion Workflow** — added a
  side-effect-free conversion workflow contract, architecture record, and audit
  suite that plans selected native policy conversions only from approved manual
  operator, post-upgrade apply, test fixture, or maintainer migration actions;
  blocks conversion from ordinary policy reads and unrelated saves; requires a
  ready Phase 8R.2 candidate, server validation, rollback snapshot plan,
  migration event plan, native intent record plan, deterministic idempotency
  key, and legacy behavior retained until commit; and requires passing or
  operator-accepted Phase 7R migration verifier output before
  behavior-sensitive policies can be marked ready.
- **Policy Builder Phase 8R Migration Candidate Report** — added a server-owned
  dry-run migration readiness report, architecture record, and audit suite that
  classifies each emitted policy as ready to convert, needing operator review,
  partial legacy inference, unsupported legacy shape, missing routing target,
  stale profile dependency, or blocked by server contract validation; uses the
  existing policy intent compatibility contract as the projection authority;
  includes bounded explainable reasons, affected policy details, routing/profile
  status, unsupported-signal summaries, and estimated legacy deletion impact;
  and rejects reports that mutate storage, omit deletion-impact details, hide
  blockers behind generic statuses, or expose raw legacy JSON outside explicit
  maintainer mode.
- **Policy Builder Phase 8R Native Schema Contract** — added a server-owned
  native intent schema contract, architecture record, and audit suite that
  defines side-effect-free storage boundaries for native policy headers, intent
  rules, routing targets, starter-template provenance, migration events,
  rollback snapshots, and validation/schema status; requires policy, library,
  active-version, rule, JSONB value, routing, migration, rollback-expiry, and
  validation indexes; and rejects legacy `customSignals` gaps, unbounded
  rollback snapshots, missing server validation gates, missing referential
  boundaries, and durable UI/provider/prompt/trace/embedding/replay diagnostic
  fields before any SQL migration is introduced.
- **Policy Builder Phase 7R Runtime And Rebuild Test Reset** — added a
  server-owned test reset manifest, architecture record, and audit suite that
  classifies runtime/rebuild tests as retained regressions, Phase 7R contract
  rewrites, or abandoned impact/replay diagnostic deletion candidates; requires
  coverage for broad genre no specialized auto-route, missing routing as
  `classified_not_routed`, stale questions unable to learn, guarded request-time
  choices, explicit constraint preservation, and rollback snapshots; and rejects
  rewrites that bypass server authority, conflate classification success with
  routing success, or freeze old preview UI as the migration contract.
- **Policy Builder Phase 7R Runtime Metrics And Decision Trace** — added a
  server-owned metrics/trace projection contract, architecture record, and audit
  suite that counts Phase 7R automation, question, request-learning, rebuild,
  migration-verifier, and rebuild lifecycle outcomes; emits bounded
  `classifarr.phase7r.trace.*` records with reason codes and stable component
  ids; suppresses raw payloads, prompts, embeddings, provider payloads, and
  diagnostic internals; and keeps operator summaries action-oriented without
  persisting or exporting telemetry yet.
- **Policy Builder Phase 7R Migration Verifier And Rollback Path** — added a
  server-owned migration verifier contract, architecture record, and audit suite
  that compares Phase 7R rebuild proposals against sanitized representative
  legacy behavior samples; emits bounded migration-relevant differences for
  destination changes, newly blocked items, newly review-required items,
  route-readiness changes, and evidence-confidence changes; requires operator
  acceptance plus rollback snapshot and restore path before replacement; blocks
  legacy deletion until Phase 8 stability and verifier/deletion gates pass; and
  keeps verifier output out of normal policy-authoring UI with all replacement,
  deletion, rollback, learning, and routing side effects disabled.
- **Policy Builder Phase 7R Library-Derived Policy Rebuild** — added a
  server-owned rebuild proposal contract, architecture record, and audit suite
  that converts observed library profile evidence, guarded outcomes, explicit
  constraints, routing configuration, outliers, observed absences, and profile
  freshness into a Phase 6R evidence/intent/readiness proposal; explains source
  counts, confidence, assumptions, and warnings; preserves explicit
  constraints; keeps observed absence as warning-only context; requires
  operator acceptance and rollback snapshot gates; and blocks activation,
  replacement, deletion, learning, and routing side effects until a later
  verifier/replacement slice.
- **Policy Builder Phase 7R Request-Time Learning And Destination Selection** —
  added a server-owned request-time learning contract, architecture record, and
  audit suite that normalizes user-requested destinations, operator manual
  destination changes, successful Arr routes, and missing-mapping route
  failures; records destination selection separately from final outcome; routes
  all durable learning through the Phase 6R learning guard; keeps failed routing
  from becoming positive destination evidence; marks manual changes auditable
  and reversible; and leaves all persistence/profile-refresh writes disabled
  until a later integration slice wires them deliberately.
- **Policy Builder Phase 7R Runtime Question Reduction** — added a
  server-owned runtime question reducer, architecture record, and audit suite
  that consumes Phase 7R automation decisions and suppresses unnecessary
  questions, turns routing gaps into configuration actions, routes stale or
  legacy pending questions through cleanup, limits persisted prompts to accepted
  Phase 5R frames, rewrites broad-genre/AI/provider/replay diagnostic frames
  before persistence, and marks planned answers as learning-ineligible by
  default so durable learning remains guarded.
- **Policy Builder Phase 7R Automation Decision Contract** — added a
  server-owned automation decision contract, architecture record, and audit
  suite that converts Phase 7R runtime evidence into explicit
  `auto_route_ready`, `classified_not_routed`, `needs_operator_review`,
  `blocked_by_hard_limit`, `needs_routing_mapping`, `stale_profile_retry`, and
  `insufficient_evidence` states; requires strong identity, concrete Arr route
  mapping, fresh profile evidence, and no high-risk conflicts before automatic
  routing; and keeps classification success distinct from route success with
  bounded runtime decision traces and no side effects.
- **Policy Builder Phase 7R Runtime Evidence Projection** — added a
  server-owned runtime evidence projection, architecture record, and audit suite
  that maps runtime library-profile, operator-intent, history, manual answer,
  RAG, metadata, Arr-routing, and profile-freshness inputs into Phase 6R
  evidence buckets; demotes low-trust RAG neighbors, unknown-library evidence,
  stale profiles, failed routing, raw provider payloads, and unsupported broad
  genre overlap with bounded reason codes; and keeps the projection
  deterministic, side-effect-free, and free of live provider lookups.
- **Policy Builder Phase 7R Runtime Decision Inventory** — added a
  server-owned runtime inventory contract, architecture record, and audit suite
  that classifies classification, policy-path, signal, AI/RAG, question,
  manual-resolution, learning, Arr-routing, media-profile, queue, and retry
  artifacts as runtime primitives, Phase 5R/6R rewrites, readiness/question
  replacements, or migration deletion targets; requires authority-source
  ownership before runtime behavior changes; and explicitly flags broad-genre
  authority risk, bad question-generation paths, and classification/routing
  conflation for replacement.
- **Policy Builder Phase 6R Completion Audit** — added a server-owned
  completion gate, architecture record, and audit suite that verifies all seven
  Phase 6R records have docs, services, tests, passing component audits, and
  expected next-phase links; broadened the migration cutline so legacy replay,
  impact, provider, TMDB, scoring, old diagnostic tests, and the pre-6R
  implementation doc have explicit verifier or deletion decisions before Phase
  7R starts.
- **Policy Builder Phase 6R Migration And Deletion Path** — added a
  server-owned migration/deletion cutline, architecture record, and audit suite
  that classifies old impact, replay, provider readiness, TMDB coverage,
  scoring, write-route, and schema artifacts as kept engine primitives,
  migration verifiers, delete-after-migration targets, or Phase 8 storage
  blockers; keeps old diagnostics out of the normal operator workflow; requires
  representative comparison, rollback snapshot, rollback window, deletion
  checklist, and Phase 8 storage blocking before cleanup.
- **Policy Builder Phase 6R Operator Workflow Rebuild** — added a server-owned
  destination-first workflow projection, architecture record, and audit suite
  that turns Phase 6R intent and readiness into five normal policy-builder
  sections: what belongs here, what should not go here, what helps but should
  not decide alone, when Classifarr should ask, and whether confirmed matches
  can route; keeps readiness read-only; enforces one primary action per section;
  blocks client-side direct policy persistence or routing execution; and
  explicitly excludes impact preview, replay preview, replay parity, provider
  gates/readiness, TMDB coverage, raw scoring, and diagnostic panels from the
  normal operator workflow.
- **Policy Builder Phase 6R Automation Readiness Engine** — added a
  server-owned readiness contract, architecture record, and audit suite that
  combines Phase 6R evidence, intent, learning, routing, and profile freshness
  into one action-oriented state; supports `ready`, `needs_more_examples`,
  `needs_operator_review`, `needs_routing`, `blocked_by_hard_limit`, and
  `stale_profile`; returns reason-coded next actions; computes from cached/local
  state only; and ignores replay, impact preview, provider, TMDB, and raw scoring
  diagnostic inputs instead of treating them as product gates.
- **Policy Builder Phase 6R Learning Guard** — added a server-owned learning
  eligibility contract, architecture record, and audit suite that separates
  final outcomes from durable learning; supports no-learning, exact-item,
  compatibility, identity, and hard-limit tiers; blocks stale questions,
  ambiguous answers, rejected question frames, AI explanation text, broad
  one-off genre choices, provider quota/cooldown state, replay diagnostics, and
  TMDB diagnostic state; requires explicit policy edits for hard-limit learning;
  and queues profile refresh instructions only when destination evidence
  changes.
- **Policy Builder Phase 6R Intent Engine** — added a server-owned intent
  proposal contract, deterministic evidence-to-intent builder, architecture
  record, and audit suite that converts Phase 6R evidence into `belongs_here`,
  `helpful_matches`, `hard_limits`, `avoid`, `ask_when`, `routing_target`,
  confidence, assumptions, and warnings while demoting unsupported broad-genre
  identity, blocking metadata-owned identity, treating missing/stale evidence as
  review triggers instead of exclusions, keeping constraints operator-owned, and
  preventing direct learning side effects.
- **Policy Builder Phase 6R Evidence Engine** — added a server-owned evidence
  bucket/source contract, deterministic offline evidence projection helper,
  architecture record, and audit suite that separates identity, compatibility,
  hard-limit, avoid, outlier, routing, freshness, and insufficient evidence
  while blocking live provider lookups, raw provider payloads, UI chip language,
  provider quota/cooldown state, metadata-owned identity, and direct learning
  from final outcomes.
- **Policy Builder Phase 0R Authority Vocabulary** — added a server-owned
  authority vocabulary contract and architecture record that separates observed
  media-server application, operator-declared intent, manual outcomes, AI
  suggestions, metadata evidence, and legacy starter templates before the
  re-imagined policy-builder phases continue.
- **Policy Builder Phase 0R User Mental Model** — added a server-owned setup
  language contract and architecture record for the default policy-builder
  questions, approved operator-facing labels, helper-copy authority rules,
  setup-copy validation, internal-diagnostic language detection, broad-genre
  framing, default setup-copy inventory, interaction-pattern mapping, and a
  full mental-model audit before the UI component reset continues; hardened the
  contract with an approved four-step setup sequence and setup-step audit that
  keeps observed application, declared destination rules, review behavior, and
  routing readiness separate from internal diagnostics; added default setup
  cards and setup-card audits so later UI work can render four plain operator
  actions without exposing scoring, provider, replay, or broad-genre-authority
  internals; added setup-surface roles and audits that separate observed
  suggestion review, declared-intent editing, review-trigger editing, and
  readiness status while preventing setup surfaces from directly persisting
  policy intent or executing routing; added first-run setup journey stages and
  audits that keep each setup step to one operator goal, one primary action,
  one completion signal, one system boundary, and one avoided failure mode;
  added setup field groups and audits that define observed multi-select,
  declared multi-select, declared checklist, status summary, and next-action
  status controls without allowing setup fields to persist policy intent
  directly; added setup answer shapes and audits so setup answers can shape
  draft intent only where allowed and cannot directly persist policy, create
  learning, or execute routing.
- **Policy Builder Phase 0R Legacy Compatibility Vocabulary** — added a
  server-owned compatibility terminology contract and architecture record that
  keeps presets, `customSignals`, bridge payloads, rollback snapshots, and
  native intent storage clearly separated while existing policies remain
  readable.
- **Policy Builder Phase 0R Question and Learning Vocabulary** — added a
  server-owned runtime question, rejected question, answer outcome, and learning
  side-effect vocabulary so UI, Discord, and future learning guard work can
  separate item resolution from durable learning.
- **Policy Builder Phase 0R Documentation and Test Alignment** — added a
  server-owned implementation checklist, stale terminology classifier, and
  architecture record so future policy-builder work must identify source of
  truth, authority level, learning side effect, rollback or migration impact,
  and operator-facing language before changing UI or runtime behavior.
- **Policy Builder Phase 1R Boundary Inventory** — added a server-owned
  policy-builder client module inventory contract, live-tree classification
  coverage, and architecture record that separates presentation, orchestration,
  draft state, legacy bridge, reference adapters, engine candidates,
  diagnostics, and test boundaries before further builder refactors continue;
  hardened the inventory with explicit freshness auditing, legacy
  combined-signal surface coverage, rule-owner checks, and Phase 6R cutline
  validation for engine candidates and delete/replace diagnostics; synced the
  inventory rules for current setup-card, routing-readiness, review-trigger,
  and save/defer action-boundary client surfaces.
- **Policy Builder Phase 1R UI Orchestration Boundary** — added a server-owned
  modal orchestration contract, extraction-target inventory, and architecture
  record that limits `PolicyBuilderModal.vue` to flow coordination,
  composition, loading/error presentation, and command routing while blocking
  evidence generation, intent inference, learning, readiness, migration parity,
  and raw legacy payload mutation from modal ownership; hardened the contract
  with a current modal touchpoint audit for save, preview, profile refresh,
  legacy-adapter, summary-projection, save-failure behavior, public event
  boundaries, and runtime emit validators.
- **Policy Builder Phase 1R Draft State Boundary** — added a server-owned draft
  state contract, command allow-list, save payload allow-list, prohibited
  UI/server-projection field list, and architecture record that keeps client
  policy drafts as editable projections rather than durable policy authority;
  hardened the contract with a public draft-operation audit for form updates,
  starter-template selection, signal commands, legacy aliases, UI expansion, and
  save payload building.
- **Policy Builder Phase 1R Reference Data Boundary** — added a server-owned
  reference-data contract, category inventory, option-source validator, and
  architecture record that separates static options, configured libraries,
  starter templates, observed profile suggestions, migration notices, and
  future routing readiness projections; hardened the contract with record and
  option provenance audits for authority drift, readiness computation, policy
  persistence, routing-status leakage, and migration-notice intent leakage.
- **Policy Builder Phase 1R Legacy Compatibility Boundary** — added a
  server-owned compatibility contract, bridge ownership inventory, raw legacy
  payload mutation guard, and Phase 8R deletion gates for preset attachments,
  starter-template weights, `customSignals`, removed markers, strict/advisory
  metadata, and compatibility fallback projections; hardened the contract with
  compatibility ownership auditing and a Phase 8R deletion-readiness evaluator.
- **Policy Builder Phase 1R Test Boundary Reset** — added a server-owned test
  reset contract, policy-builder test category inventory, executable boundary
  rule checks, and architecture record so Phase 2R can proceed without tests
  freezing transitional diagnostic UI or legacy-first layout shape; hardened the
  completion gate with legacy compatibility ownership audit coverage and Phase
  8R deletion-readiness checks.
- **Policy Builder Phase 2R Draft Contract Definition** — added a server-owned
  draft contract, authority-classified field inventory, native versus
  compatibility mapping, prohibited draft responsibility checks, and
  architecture record for the draft bridge rework; hardened the contract with
  an executable field audit that blocks unsafe native persistence,
  UI/read-only projection serialization, observed-evidence ownership drift, and
  raw legacy terms in product-facing draft fields.
- **Policy Builder Phase 2R Legacy Bridge Isolation** — added a server-owned
  bridge isolation contract, deserializer/serializer/no-op preservation
  responsibility inventory, serialized key allow-list, unsupported legacy
  preservation list, and Phase 8R bridge deletion gate checks; hardened the
  contract with an executable bridge audit for responsibility ownership,
  serializer key hygiene, unsupported preservation separation, raw mutation
  boundaries, and deletion-gate completeness.
- **Policy Builder Phase 2R Draft Command Boundary** — added a server-owned
  draft command inventory, payload validator, read-only projection guard,
  compatibility config allow-list, future routing/warning command reservations,
  multi-select-ready value validation, and Phase 6R rename/split candidates for
  legacy bridge adapter commands; hardened the command inventory with an
  executable audit for command category, payload authority, reserved-command
  implementation, operator-facing bridge adapter, read-only projection, raw
  legacy terminology, and Phase 6R rename-target drift.
- **Policy Builder Phase 2R Draft View Projection** — added a server-owned
  draft-view projection contract, browser-facing provenance labels, read-only
  readiness and observed-evidence placeholders, provenance counts, raw legacy
  storage exposure checks, and chip rendering that prefers view-provided
  provenance before raw source fallbacks; hardened the projection contract with
  an executable audit for view-field ownership, command-hint safety,
  read-only/server-placeholder authority, provenance alias collisions, and raw
  legacy terminology exposure.
- **Policy Builder Phase 2R Server Authority Preparation** — added a
  server-owned authority-preparation contract, server insertion point inventory,
  sanitized draft-intent preflight wrapper, server warning reason-code list,
  Phase 5R/6R/8R handoff points, and native-storage replacement steps that keep
  client draft/view/command state subordinate to server validation; hardened the
  authority contract with an executable audit for client/server authority
  drift, raw draft echo, insertion-point coverage, warning reason-code
  completeness, native-storage replacement steps, and premature native storage
  activation.
- **Policy Builder Phase 2R Draft Parity Regression Tests** — added a
  server-owned parity audit contract for required Phase 2R regression rules,
  rewrite/delete candidate tracking for old diagnostic UI tests, and client
  save-payload allow-list coverage so UI-only transient fields, read-only
  projections, and raw legacy placeholders do not serialize before server
  validation.
- **Policy Builder Phase 3R Workflow Inventory Cutline** — added a server-owned
  live-tree workflow inventory that classifies current policy-builder UI,
  utility, and test surfaces as keep/rewrite/replace/delete, gates new surfaces
  until classified, and keeps replay, impact preview, provider readiness, raw
  scoring weights, migration notices, starter-template mechanics, bridge
  internals, and presentation tests out of the normal policy-authoring path.
- **Policy Builder Phase 3R Destination-First Flow** — added a server-owned
  destination-first workflow contract that orders normal policy authoring around
  selecting a connected library, reviewing observed destination meaning,
  accepting or editing declared intent, confirming hard limits, confirming
  routing readiness, and saving or deferring, while keeping starter templates
  behind destination context and mapping new, sparse, and unmapped libraries to
  bounded operator next actions.
- **Policy Builder Phase 3R Component System Reset** — added a server-owned
  target component vocabulary, primitive replacement map, option-source model,
  typed-command interaction rules, explicit observed-evidence acceptance rule,
  disabled-choice explanation rule, readiness linking rule, and component-level
  accessibility requirements for keyboard, labels, multi-select state, focus,
  target size, and programmatic error/disabled reasons before Vue screen rebuild
  work continues.
- **Policy Builder Phase 3R Evidence-Backed Option Selection** — added a
  server-owned option-selection contract that separates read-only observed
  library evidence from selectable suggestions, custom values, already-declared
  values, and conflicting choices, while requiring explanations, disabled
  reasons, typed draft commands, and broad-genre evidence guardrails.
- **Policy Builder Phase 3R Hard Limits And Avoid UX** — added a server-owned
  constraint UX contract that separates blocking hard limits from advisory
  avoid signals and review warnings, requires explicit operator action for
  blockers, rejects absence-inferred constraints, and keeps max-rating behavior
  separate from avoid-rating behavior.
- **Policy Builder Phase 3R Readiness And Next Action Surface** — added a
  server-owned readiness contract with six visible states, one next action per
  readiness issue, destination workflow links for each issue, prioritized
  action selection, and verifier-only classification for replay, provider,
  TMDB, scoring, parity, and impact diagnostics.
- **Policy Builder Phase 3R Starter Template Role Reset** — added a
  server-owned starter-template contract that keeps templates as optional
  post-destination accelerators, maps template suggestions into Phase 0R
  vocabulary, applies suggestions through typed draft commands, and classifies
  raw template mechanics as bridge-only or delete-after-native-storage targets.
- **Policy Builder Phase 3R Accessibility And Decision Load** — added a
  server-owned accessibility and decision-load contract that maps every Phase
  3R target component to visible labels, helper text, keyboard and focus
  requirements, disabled reasons, multi-select state, chip removal names,
  destructive confirmations, single readiness next actions, and normal-path
  diagnostic language guards.
- **Policy Builder Phase 3R Presentation Test Reset** — added a server-owned
  presentation test reset contract that categorizes current policy-builder
  tests as keep, rewrite, delete, or Phase 2R-owned draft bridge coverage,
  defines required simplified workflow assertions, and marks old replay,
  impact, raw template mechanics, provider, TMDB, scoring, and parity
  diagnostics as outside the normal policy-authoring test path.
- **Policy Builder Library-Derived Multi-Select Genre Controls** — added
  checkbox-based multi-select controls for Belongs Here, Helpful Matches, and
  Boosts, with selected-library profile genres shown first from existing media
  server contents and starter-template genre options retained as fallback
  choices. The library context card now summarizes top existing genres so
  operators can fill policy intent from what already belongs in the destination.
- **Policy Builder Library Profile Freshness UX** — added profile loading,
  missing, stale, refresh, and error states to the policy builder library context
  card, with a bounded refresh action that uses existing library profile APIs
  without changing policy drafts, save behavior, or classification scoring.
- **Policy Builder Library Profile Refresh Result Feedback** — added bounded
  refresh completion feedback to the policy builder library context card so
  operators can see whether a refreshed profile produced usable genre, rating,
  or keyword signals, or whether sync/enrichment is still needed before relying
  on library-derived suggestions.
- **Policy Builder Ask When Unsure Review Triggers** — added a bounded Phase 3R
  review-trigger checkbox control for the policy intent editor, backed by
  `review_triggers.when_any` draft serialization, readable review summaries,
  duplicate disabled reasons, and compatibility bridge coverage so operators
  can declare when Classifarr should ask without exposing replay, provider,
  TMDB, scoring, or migration diagnostics as normal policy controls.
- **Policy Builder Replay Provider Readiness Projection** — added read-only
  TMDB, OMDb, and web-search provider readiness to representative replay
  preview, showing configured, quota-safe, cooldown, demanded-source, and
  selected-provider state without live provider calls, AI calls, persistence,
  Arr writes, API keys, provider configs, queries, cache keys, or raw payloads.
- **Policy Builder Replay Enrichment Adapter Contract** — added the first Phase
  6 replay enrichment boundary with blocked-by-default TMDB, OMDb, and
  web-search adapter contracts, explicit provider-readiness linkage, and
  replay preview UI visibility without executing enrichment, live provider
  calls, AI calls, persistence, Arr writes, credentials, provider configs,
  queries, cache keys, or raw payloads.
- **Policy Builder TMDB Replay Metadata Adapter Preview** — added a
  replay-only TMDB metadata dry-run adapter that remains blocked by default,
  exposes sanitized field availability and improvement counts in representative
  replay preview, and keeps TMDB IDs, request details, provider payloads,
  provider errors, API keys, cache keys, AI calls, persistence, Arr writes, and
  classifier reruns out of the browser-facing contract.
- **Policy Builder TMDB Replay Execution Switch** — added a quota-aware,
  blocked-by-default TMDB metadata live-preview switch for representative
  replay. Live TMDB reads now require both server environment opt-in and
  explicit request opt-in, pass through provider readiness, quota, and cooldown
  checks, and expose only sanitized switch status in the replay card without
  provider payloads, identifiers, credentials, cache mutation, persistence, AI
  calls, Arr writes, or classifier reruns.
- **Policy Builder TMDB Metadata Coverage Comparison** — added a deterministic
  replay comparison that summarizes which sparse evidence fields sanitized TMDB
  metadata preview could add, including before/after completeness, added field
  counts, remaining missing fields, and per-sample field names without
  provider values, payloads, identifiers, credentials, cache mutation,
  persistence, AI calls, Arr writes, or classifier reruns.
- **Policy Builder TMDB Replay Live-Preview Opt-In Control** — added an
  advanced representative replay checkbox that exposes the request side of the
  two-key TMDB live-preview gate. The control remains disabled until normal
  replay reports server opt-in, provider readiness, quota safety, and no active
  cooldown, then sends structured request opt-in metadata only when selected.
- **Brave Search and Serper.dev Web Search Adapters** — activated Brave and
  Serper behind the provider-neutral contract, registry, quota-aware router,
  settings test action, result normalizer, and error taxonomy. Added bounded
  regional settings, Brave strict Safe Search, deterministic post-normalization
  domain filtering, and fixture-backed request/response coverage.
- **Provider-Routed Web Search Enrichment and Retry** — migrated classification
  metadata enrichment, queue enrichment, OMDb fallback, and retry execution
  from direct Tavily services onto the quota-aware provider router. New evidence
  is stored as provider-neutral `web_search_*` metadata while historical
  `tavily_*` evidence, states, and retry rows remain readable and compatible.
  Added bounded purpose-specific requests, typed fallback behavior, generic
  Command Center and dashboard language, and a database state-constraint
  migration for the new provider-neutral enrichment states.
- **Web Search Provider Usage Cache** — added provider-neutral cached search infrastructure with deterministic SHA-256 cache identities, bounded TTLs, DB-backed normalized-response storage, zero-cost cache-hit usage events, expired-entry cleanup, fresh-install schema coverage, and architecture documentation for the Tavily/Brave/Serper provider framework.
- **Web Search Provider Usage Retention** — added provider-neutral usage/cache retention with a configurable `web_search_provider_usage_retention_days` setting, current-month quota protection, bounded usage-row purge batches, scheduled expired-cache cleanup, fresh-install schema coverage, and architecture documentation for the retention policy.
- **Web Search Provider Retention Seed Reconciliation** — added an explicit data-only reconciliation migration so fresh-install schema snapshots include the default `web_search_provider_usage_retention_days` setting even though the original retention migration also contains DDL.
- **Web Search Provider Route Decision History** — added sanitized provider-route decision persistence with candidate order, selected/final provider, attempts, outcomes, trace IDs, and bounded metadata; surfaced recent decisions in the Web Search Providers Route Diagnostics panel without exposing queries, API keys, cache keys, provider configs, or response bodies.
- **Purpose-Aware Web Search Provider Quality Calibration** — added provider-purpose quality scoring from recent live-search usage signals, with minimum sample requirements, capped priority penalties, effective-priority routing, and diagnostics UI visibility for score, sample count, and applied penalty.
- **Web Search Provider Route Decision Retention** — added configurable 30-day retention for sanitized route-decision history with bounded indexed purge batches, daily scheduler integration, fresh-install seed coverage, and architecture documentation for the retention policy.
- **Web Search Provider Health and Cooldown History** — added sanitized provider health-event persistence for live-search success, error, and cooldown transitions; wired provider usage updates into best-effort health history writes; and surfaced recent provider health events in Route Diagnostics without exposing queries, credentials, provider configs, cache keys, or raw responses.
- **Web Search Provider Health Retention** — added configurable 30-day retention for sanitized provider health/cooldown events with bounded indexed purge batches, daily scheduler integration, fresh-install seed coverage, and architecture documentation for the retention policy.
- **Web Search Provider Outcome Feedback Loop** — added derived downstream outcome feedback from sanitized provider route decisions joined to classification outcomes, feeding provider quality calibration with a capped purpose-aware penalty when enough provider-backed classifications later fail or are corrected. Route Diagnostics now surfaces outcome fit without exposing queries, credentials, cache keys, provider configs, classification IDs, or raw responses.
- **Purpose-Specific Web Search Calibration Controls** — added bounded per-purpose calibration policies for provider quality routing, with database-backed lookback windows, minimum samples, maximum priority penalties, outcome weights, and an enable switch. The Web Search Providers settings page now exposes these safe controls without raw scoring JSON, credentials, queries, cache entries, or provider response data.
- **Web Search Purpose Coverage Report** — added a read-only settings report showing which web-search purposes have explicit calibration policies and which are using default fallback behavior, sourced from the canonical provider contract purpose list without exposing provider secrets, queries, cache keys, route traces, or raw responses.
- **Web Search Calibration Preview Mode** — added a side-effect-free preview for purpose calibration changes that compares current versus unsaved route order, selected provider, effective priority, quality score, and penalty deltas before saving. The browser-facing preview reuses sanitized route diagnostics and excludes provider secrets, queries, cache keys, route IDs, trace IDs, raw errors, and response payloads.
- **Web Search Calibration Guardrails** — added preview-time warning guardrails for no-provider outcomes, selected-provider changes, low sample confidence, and recent provider health/cooldown signals. Guardrails are computed server-side from sanitized diagnostics and health history without persisting preview state or exposing API keys, queries, cache keys, route IDs, trace IDs, correlation IDs, classification IDs, raw errors, or response payloads.
- **Web Search Guardrail Threshold Controls** — added bounded settings controls for preview guardrail sensitivity, including low-sample multiplier, recent-health lookback count, and per-guardrail severities. Thresholds are normalized server-side, seeded for fresh installs, and editable in the Web Search Providers settings UI without exposing queries, credentials, provider payloads, cache keys, route IDs, trace IDs, classification IDs, or raw errors.
- **Web Search Guardrail Analytics** — added sanitized calibration-preview guardrail event capture and aggregate settings analytics so operators can tune guardrail thresholds from repeated evidence instead of isolated previews. The analytics store excludes queries, credentials, provider payloads, cache keys, route IDs, trace IDs, correlation IDs, classification IDs, raw errors, and preview messages.
- **Web Search Guardrail Alert Digest** — added a computed non-paging digest for repeated preview guardrails, with clear/watch/attention levels and recommendation text in the Web Search Providers settings UI. The digest is derived from sanitized aggregate guardrail analytics and does not expose raw event rows, queries, credentials, provider payloads, cache keys, route IDs, trace IDs, correlation IDs, classification IDs, or raw errors.
- **Discord Pending Item Notifications** — added an operator-facing Discord notification path for classifications that enter `awaiting_decision`, with a separate settings toggle, duplicate protection via `discord_message_id`, and reuse of existing policy-question response buttons when a pending item has structured options.
- **Discord Pending Item Mention Targeting** — added settings to optionally ping `@here` and a selected Discord role or user for pending classification alerts, with server-scoped mention target lookup, bounded stored mention metadata, and explicit Discord allowed-mention controls to prevent accidental broad pings.
- **Quota-Aware Web Search Provider Routing** — added provider-neutral routing policy and router services that select the first eligible adapter-backed provider by priority while skipping disabled, unconfigured, cooldown-active, quota-exhausted, or adapterless providers with structured reasons. Added daily/monthly usage aggregation and architecture documentation for the next Brave/Serper activation slice.
- **Web Search Provider Route Diagnostics** — added a secure settings read model and Route Diagnostics card showing the selected/eligible provider, deterministic candidate order, skipped reasons, quota counters, cache/request totals, and cooldowns. The browser-facing projection excludes credentials, provider configuration, search content, cache identities, trace IDs, and raw provider errors.
- **Policy Builder Representative Replay Readiness Preview** — added a
  side-effect-free policy intent replay-preview API and client wrapper that
  validates native drafts, reuses structural impact preview, and returns a
  bounded sanitized sample of recent classification history with explicit
  no-classification, no-AI, no-provider, and no-arr-write execution flags.
- **Policy Builder Replay Preview Panel** — added a modal-facing representative
  replay preview card, browser normalizer, and composable so operators can
  request bounded sample readiness from the same draft payload used for save
  without running classification, AI, providers, arr writes, or persistence.
- **Policy Builder Dry-Run Signal-Fit Replay** — added deterministic native
  intent signal-fit scoring behind representative replay preview, using bounded
  stored classification evidence to show strong, review, blocked, or
  insufficient sample outcomes without running full classification, AI,
  providers, Arr writes, or persistence.
- **Policy Builder Replay Execution Context** — added a dry-run replay
  capability boundary with blocked no-op adapters for full classification, AI,
  providers, Arr writes, persistence, RAG, profile, and history access so future
  full-replay slices can opt into dependencies deliberately without accidental
  side effects.
- **Policy Builder Replay Item Adapter** — added a bounded server-side adapter
  that converts representative `classification_history` rows into deterministic
  policy-engine item shape for replay, preferring indexed genre/studio evidence
  before sanitized metadata fallbacks while excluding raw IDs, metadata, traces,
  provider payloads, and persistence details from browser-facing replay output.
- **Policy Builder Policy-Engine Replay Comparison** — added a deterministic
  replay comparison adapter that maps native intent draft buckets into existing
  policy-engine signal scoring, reports bounded per-sample engine score/fit and
  blockers, and surfaces the sanitized comparison in the replay preview card
  without invoking RAG, profile, history, AI, providers, Arr writes, or
  persistence.
- **Policy Builder Replay Parity Delta Summary** — added a bounded read-only
  replay delta that compares each representative sample's current outcome,
  draft signal fit, and deterministic policy-engine fit into operator-facing
  actions such as remain, candidate, review, block, or insufficient evidence,
  with sanitized aggregate counts in the replay preview card.
- **Policy Builder Replay Sample Selection Diagnostics** — added bounded
  aggregate diagnostics for representative replay sample selection, showing
  total history, eligible rows, final-success rows, review/pending rows,
  media-type filtered rows, sparse-evidence rows, and sanitized selection
  reasons without exposing raw classification metadata, IDs, prompts, provider
  payloads, traces, SQL, or persistence details.
- **Policy Builder Replay Evidence Completeness** — added bounded per-sample
  evidence completeness for representative replay, showing whether selected
  samples have rating, genre, keyword, studio, language, overview, runtime, and
  vote-average evidence available without exposing the raw evidence values,
  metadata, IDs, prompts, provider payloads, traces, SQL, or persistence
  details.
- **Policy Builder Replay Enrichment Eligibility** — added read-only enrichment
  eligibility for representative replay samples, showing missing evidence
  fields, abstract source categories, and explicit no-execution flags without
  calling TMDB, OMDb, web search, AI, Arr, persistence, or queue services and
  without exposing IDs, API keys, provider configuration, metadata, prompts,
  payloads, traces, SQL, or persistence details.

### Changed

- **Policy Builder Migration Verifier Cutline** — hid intent impact and replay
  verifier panels from the default policy-builder modal workflow behind an
  explicit migration-verifier flag, with modal coverage confirming normal setup
  no longer triggers preview/replay calls.
- **Policy Builder Phase 3R Vue Setup Cards** — added a destination-first
  setup-card surface to the policy-builder modal with four plain operator
  actions for observed application, destination rules, review behavior, and
  routing readiness, backed by a reusable client setup-card contract and tests.
- **Policy Builder Phase 3R Destination Section Split** — split the policy
  intent editor into review behavior, destination identity, destination rules,
  and confidence-support groups so setup-card actions target distinct workflow
  sections while preserving existing typed draft commands.
- **Policy Builder Phase 3R Routing Readiness Surface** — added a dedicated
  read-only routing readiness card for the policy builder so `Can this
  destination route?` shows one visible status and one next action without
  executing routing, calling providers, or saving policy intent.
- **Policy Builder Phase 3R Setup Card State Binding** — changed setup cards
  from static guidance into read-only progress cards backed by existing modal
  projections for observed evidence, declared rules, review behavior, and
  routing readiness without adding API calls, persistence, or automation.
- **Policy Builder Phase 3R Save and Defer Boundary** — replaced the generic
  policy-builder footer with a save-readiness status, visible disabled reasons,
  and a defer-without-saving action while preserving the existing save payload
  and close event contracts.
- **Policy Builder Phase 3R Starter Template Accelerator** — changed starter
  templates from a required policy-builder step into an optional accelerator:
  save readiness no longer requires a selected template, no-template warnings
  were removed from the normal summary path, and the template browser/details
  surface is collapsed behind an accessible disclosure.
- **Policy Builder Phase 3R Vue Accessibility Decision Load Audit** — updated
  setup cards to expose one recommended next action with `aria-current="step"`,
  status/completion descriptions for action links, quieter secondary actions,
  and no-template fallback targets so setup links do not point at missing
  sections.
- **Policy Builder Phase 3R Vue Presentation Test Reset** — reset the
  highest-risk policy-builder modal, impact preview, and replay preview tests
  so they protect destination-first setup, one recommended next action,
  read-only verifier behavior, no-execution replay safety, and TMDB opt-in
  gating without freezing old provider, scoring, parity, or sample-selection
  diagnostics as normal UI.
- **Policy Builder Phase 3R Completion Audit** — added a server-owned
  completion gate that records Phase 3R server contracts, Vue rewrite slices,
  normal workflow rules, and normal-path exclusions, verifies referenced docs,
  services, and tests exist, and keeps verifier/provider/TMDB/scoring/parity
  diagnostics out of the normal policy-authoring path before Phase 6R runtime
  handoff.
- **Policy Builder Phase 0 Language Alignment** — updated the current policy
  intent editor to use plain-language intent buckets (`Belongs Here`, `Helpful
  Matches`, `Hard Limits`, `Boosts`, `Avoid`) and starter-template copy while
  preserving the legacy preset-backed `customSignals` save contract. Added the
  Phase 0 implementation record and regression coverage for the new labels and
  existing payload shape.
- **Policy Builder Phase 1 Reference Data Extraction** — moved policy-builder
  library, starter-template, suggestion, migration-notice, filtering, usage,
  and option-derivation logic into a tested `usePolicyBuilderReferenceData`
  composable with injected API/storage dependencies. The modal keeps the same
  behavior and legacy payload contract while losing a large async side-effect
  block. Repaired the client `test:unit` script so it uses the working Vitest
  wrapper invocation and discovers the full client unit suite.
- **Policy Builder Phase 1 Template Signal Extraction** — moved advanced
  starter-template signal helpers into a tested `usePolicyBuilderTemplateSignals`
  composable, covering base signal lookup, language/runtime presentation,
  strict/advisory toggles, removed base-signal markers, and normalized keyword
  additions without changing the legacy `customSignals` payload contract.
- **Policy Builder Phase 1 Combined Signal Extraction** — moved combined signal
  presentation into a tested `usePolicyBuilderCombinedSignals` composable with a
  pure `buildCombinedSignals` helper, preserving source attribution, removed
  base-signal filtering, deterministic sorting, and the current modal output
  shape.
- **Policy Builder Phase 2 Intent Draft Bridge** — added a tested
  legacy-compatible intent draft bridge that projects selected presets and
  policy-specific `customSignals` into explicit intent buckets, preserves
  unsupported legacy fields, and serializes allow-listed draft edits back to the
  current save payload without changing storage, APIs, or classification
  scoring. Added a reactive `usePolicyIntentDraft` state boundary so intent
  helper edits now flow through draft commands before save, while metadata-only
  legacy template controls remain preserved until the draft model explicitly
  owns them. The policy intent editor now renders from a tested draft read model
  with a legacy projection fallback and emits validated draft-command events
  instead of legacy custom-signal events while keeping the save payload stable.
  Added modal-level no-op save parity coverage for unchanged legacy
  `customSignals` and API-shaped `custom_signals` payloads. Moved the language
  strict/advisory advanced control onto draft-owned signal metadata overrides so
  returning to the base template behavior clears stale strict metadata without
  losing unrelated legacy fields or signal values. Moved base-signal removal
  markers onto draft-owned `signalRemovalOverrides`, keeping removal-state reads
  in the template helper while mark/restore writes flow through the draft. Moved
  advanced-template custom additions and removals for ratings, genres, languages,
  and keywords onto draft add/remove commands so the modal no longer mutates
  those saved signal lists directly. Extracted the advanced starter-template
  details panel into a focused `PolicyStarterTemplateDetails` component with
  explicit add/remove/removal/strict events while preserving draft-backed save
  behavior. Extracted the selected starter-template rows into
  `PolicySelectedStarterTemplates`, replacing nested weight mutation with a
  bounded state command while preserving runtime badges, expansion, remove
  actions, and draft-backed detail events. Extracted the read-only combined
  signal presentation into `PolicyCombinedSignalsSummary` so the modal consumes
  normalized summary props instead of owning the rendering block. Extracted
  advanced scoring, combination mode, and classification threshold controls into
  `PolicyBuilderAdvancedSettings`, with bounded state-layer form updates for
  weights, thresholds, and allowed combination modes. Extracted the
  starter-template browser into `PolicyStarterTemplateBrowser`, moving
  suggested templates, category tabs, search, and available-template rows behind
  explicit add-all, toggle, category, and search events. Extracted the legacy
  preset migration notice into `PolicyPresetMigrationNotice` with a narrow
  dismiss event while leaving dismissal persistence in the reference-data
  composable. Centralized advanced settings labels, allowed fields, bounds,
  modes, normalization, and percent formatting in a shared utility so the
  rendered controls and state-layer validation cannot drift. Extracted the
  selected-library source-of-truth banner into `PolicyBuilderLibraryContext` as
  a read-only component.
- **Policy Builder Phase 3 Intent Summary** — added a read-only policy behavior
  summary derived from the intent draft view, showing Purpose, Hard Limits,
  Helpful Hints, and deterministic Review Triggers before starter-template
  mechanics. The summary uses a pure allow-listed utility and a prop-only
  component, preserving the legacy preset-backed save contract. Moved
  starter-template selection, selected-template details, and combined-signal
  diagnostics behind a `PolicyStarterTemplateMechanics` disclosure that stays
  open for new policies but collapses by default when templates already exist.
  Reordered the modal so the policy intent editor appears directly under the
  behavior summary, making intent the first editable work surface while leaving
  template mechanics as supporting compatibility context. Centralized intent
  editor section labels, option sources, display classes, and draft command
  generation in `policyIntentEditorSections.js` so the primary work surface is
  driven by one allow-listed contract. Extracted each intent section into
  `PolicyIntentSectionCard`, keeping section rendering prop-driven while draft
  command authority stays in the shared contract. Added intent-specific action
  labels and help copy for belongs-here genres, helpful genres, rating limits,
  confidence boosts, and avoid ratings so controls explain their policy effect
  before selection. Added operator-facing display formatting for configured
  intent chips so entries read as policy behavior, such as `Belongs here:
  Family`, `Maximum rating: PG-13`, and `Avoid rating: R`, instead of raw signal
  keys. Added editable remove affordances for draft-managed intent chips, routed
  through allow-listed section commands and the existing draft remove boundary so
  operators can undo belongs-here, helpful-match, boost, and hard-limit edits
  without mutating raw preset JSON. Split multi-value certification chips into
  value-specific rows so avoid ratings can be removed one at a time while
  preserving unrelated max-rating limits, legacy fields, and the existing save
  payload. Added section-specific certification controls so max-rating and
  avoid-rating edits use explicit action buttons instead of the same immediate
  generic selector used for genre signals. Added section-specific genre intent
  controls so belongs-here, helpful-match, and confidence-boost edits use
  distinct operator-facing actions while keeping the same draft command
  contract. Added inline chip provenance labels so configured signals show
  whether they came from an intent edit, policy override, starter template, or
  compatibility fallback without opening advanced template mechanics. Added
  compact per-section behavior summaries derived from configured chips so users
  can read the effective policy intent before scanning individual signals.
  Added deterministic weak-section warnings inside the intent section cards so
  missing identity, helpful-only structure, boost-without-identity, and absent
  rating-boundary cases are visible while editing without changing storage,
  scoring, or the legacy-compatible save payload. Added compact warning
  consequence text so each section explains why the weak structure matters for
  review frequency, confidence, or routing safety. Added a non-blocking Policy
  Readiness summary above section editing so operators can see `Ready`, `Ready
  with notes`, or `Needs review` before scanning individual intent sections.
  Added readiness issue navigation so each readiness row can focus the affected
  intent section without mutating draft data or changing save/scoring behavior.
  Added compact section completion badges so each intent section shows whether
  it is configured, advisory, optional, or missing required identity evidence.
  Added passive section next-action guidance so each section suggests the
  smallest useful edit based on its current completion state. Extracted section
  visual-state helpers into a focused utility module while preserving the
  existing section contract import surface. Extracted intent chip projection,
  behavior summaries, and draft-command construction into a focused utility
  while keeping the existing section contract import surface stable. Added
  deterministic option availability guardrails so intent controls disable and
  explain already-configured values before duplicate draft commands can be
  emitted. Added section-level option diagnostics so controls distinguish
  missing reference options, partially available choices, and fully configured
  sections. Added shared control readiness so disabled add buttons expose a
  deterministic reason through title and accessible label text. Extracted a
  shared policy intent option-select component and option-state resolver so
  genre and certification controls reuse bounded-choice rendering while keeping
  their intent-specific labels, buttons, clear actions, and draft event
  contracts. Extracted shared primary action-button readiness rendering so
  disabled intent edit actions use consistent title and accessible-label
  reasons while parent controls keep policy-specific labels, resets, clear
  behavior, and draft event payloads. Added a shared option-action composable
  for selected-value state, option projection, readiness, guarded submit, and
  reset behavior so genre and certification controls keep only policy-specific
  language and layout. Added a shared secondary intent action button for
  certification clear actions, preserving the clear-section event contract
  while removing raw secondary-button markup from the control. Extracted
  certification-control label and clear-capability projection into a pure helper
  so max-rating and avoid-rating copy stays deterministic outside the Vue
  component. Extracted genre-control label projection into a pure helper so
  belongs-here, helpful-match, confidence-boost, and fallback copy stay
  deterministic outside the Vue component. Added a shared intent-control view
  facade so genre and certification controls consume one projection entry point
  while type-specific helpers keep ownership of their wording rules. Extracted
  the shared option/action shell so genre and certification controls reuse the
  same option-select plus primary-action layout while certification supplies its
  clear action through an explicit slot. Added editor-to-draft parity coverage
  proving the refactored intent controls still emit draft commands that
  serialize to legacy-compatible `customSignals` for belongs-here,
  helpful-match, confidence-boost, max-rating, and avoid-rating edits. Added a
  Phase 3 checkpoint audit marking the intent-first builder presentation scope
  complete and folding the previously planned Phase 4 summary/warnings work
  into the completed Phase 3 scope.
- **Dependency Security Hardening** — resolved local npm audit alerts by moving the server's direct `undici` dependency to the patched 8.5.x line, constraining Discord's transitive `undici` usage to patched 6.27.x, and constraining jsdom's transitive client test dependency to patched 7.28.x.
- **Dependency Refreshes** — updated `axios` to 1.18.1 in the root/client workspaces and `vite` to 8.1.0 in the client workspace, keeping local npm audits clean while staying on compatible release lines.
- **Dependabot PR Follow-Through** — applied the remaining open Dependabot maintenance updates locally: server runtime dependencies (`node-cron`, `pg`), server/client Node type tooling, Testcontainers PostgreSQL tooling, server lint/dead-code tooling (`eslint-plugin-n`, `globals`, `knip`), client test/lint tooling (`@playwright/test`, `globals`), and the pinned `actions/checkout` v7 workflow upgrade.
- **Policy Builder Phase 5 Server Intent Schema** — added a server-owned policy
  intent schema validator for read-only `policy_intent_contract` responses,
  with allow-listed sources, inference states, roles, signal types, operators,
  and semantic boundaries for purpose, hard limits, helpful hints, and avoid
  evidence. Generated contracts now include validation metadata while preserving
  legacy preset/custom-signal storage and existing policy load behavior.
- **Policy Builder Phase 5 Intent Projection Mapper** — extracted detailed
  policy response projection into a shared server mapper so policy read,
  create, and update routes emit the same `configuration_view` and
  `policy_intent_contract` fields without duplicating composition logic.
  Existing policy storage, list responses, and classification scoring remain
  unchanged.
- **Policy Builder Phase 5 Route Contract Parity** — added route coverage that
  locks detailed policy read/create/update responses to the server-owned
  `configuration_view` and `policy_intent_contract` contract while explicitly
  keeping policy list responses lightweight.
- **Policy Builder Phase 5 Write Preflight Validator** — added a strict,
  bounded server-side validator for future native intent draft write payloads,
  including allow-listed draft fields, bucket names, signal types, value
  operators, semantic guardrails, and an explicit non-persistence status so
  create/update routes can later report draft validity without changing storage.
- **Policy Builder Phase 5 Route Write Preflight** — wired native intent draft
  validation into policy create/update routes as a non-persistent preflight.
  Valid drafts now return a sanitized `policy_intent_write_preflight`
  diagnostic, while invalid drafts fail before database mutation. The route
  still saves only through the legacy preset/custom-signal path and does not
  persist, echo, or score native draft content.
- **Policy Builder Phase 5 Client Write Preflight Consumption** — the policy
  builder now submits a cloned native `policyIntentDraft` sidecar alongside the
  legacy-compatible preset payload, and the policy list consumes the sanitized
  `policy_intent_write_preflight` response to show compatibility-mode save
  status without persisting, echoing, or scoring native draft content.
- **Policy Builder Phase 5 Native Intent Impact Preview** — added a
  side-effect-free preview API, server comparison service, route coverage, and
  client API wrapper that compare validated native intent drafts against the
  legacy preset/custom-signal interpretation. The preview returns sanitized
  parity, impact-level, changed-bucket, and reason-code diagnostics without
  persisting, echoing, or scoring native draft content.
- **Policy Builder Phase 5 Modal Impact Preview UX** — added a policy-builder
  impact preview card, client-side preview normalizer, and async preview
  composable so operators can compare the current native intent draft against
  the legacy preset path before saving. Preview remains read-only,
  user-triggered, non-persistent, and separate from create/update behavior.
- **Policy Builder Phase 5 Stale Preview Tracking** — added deterministic
  client-side preview payload fingerprinting so the policy builder keeps the
  previous impact preview visible but marks it out of date after draft edits.
  Stale tracking is non-persistent, does not block save, and keeps preview
  refresh separate from create/update behavior.

## [0.47.5c-beta] - 2026-06-17

### Added

- **Local AI Policy Sweep Cleanup Utility** — added `scripts/cleanup-local-ai-policy-sweep.mjs` and the `test:local:ai-policy-sweep:cleanup` npm script to remove sweep-created DB artifacts (classification history, linked queue tasks, webhook logs, media requests, notifications, clarification responses, embeddings) so sweep fixtures can be safely re-run without manual SQL cleanup.
- **Schema Snapshot Integrity Guard** — `migration:check` now validates that `database/schema/current.sql` contains required pgvector infrastructure (text HNSW index `idx_embeddings_hnsw` and image HNSW index `idx_embeddings_image_hnsw`); fails fast with an actionable message when the snapshot is stale, preventing fresh-install regressions from going undetected.

### Fixed

- **RAG Health Degraded on Fresh Installs — Missing Text HNSW Index** — `idx_embeddings_hnsw` was absent from `database/schema/current.sql` since a column recreation in an earlier migration dropped it and the snapshot was never regenerated. Fresh installations via the schema snapshot fast-path started with a missing text vector index, causing the RAG health panel to report `Degraded` with `Missing indexes: text`. Added repair migration `20260617_180000_repair_missing_text_hnsw_index.sql`, regenerated the authoritative schema snapshot, and added the integrity guard in `migration:check` to prevent recurrence.

### Changed

- **Animated-Only Strict Preset Refines Anime Exclusion** — `animated_only_strict` now explicitly excludes anime-signaled keywords (`anime`, `manga`, `shonen`, `seinen`, `shojo`, `japanese animation`) under `strict: true` so the preset routes only Western/non-anime animated movies and hard-blocks anime-signaled items as policy conflicts rather than passing them as general animation.
- **Docker Compose Healthcheck Start Period Extended** — `HEALTHCHECK --start-period` increased from 60s to 120s in both `Dockerfile` and `docker-compose.yml`; an explicit `healthcheck:` stanza was added to the compose file so the timing is tunable without an image rebuild. Covers pg_upgrade paths, fresh-install schema loads, and slow-I/O hosts.
- **Smart Compose `--wait` Rebuild Lifecycle** — added `docker:smart:up:wait` npm script that passes `--wait` to `docker compose up` (blocks until container health check passes); `docker:smart:rebuild` updated to use it so the full rebuild-validate cycle returns a reliable exit code instead of detaching immediately.

## [0.47.5b-beta] - 2026-06-17

### Added

- **Active Classification & Queue Visibility in Processing Panel** — the Command Center Processing Panel now shows real-time classification details (title, phase, progress bar, media type, pending queue count, AI telemetry, and up-next queue) when a task is in progress, and a queued-waiting state when workers are busy but items are pending.
- **Scoped Local AI Policy Sweep Auth** — added `/api/auth/token/exchange-local-sweep` endpoint that exchanges an admin API key for a short-lived (60–900s), audience-scoped JWT (`classifarr:local-ai-policy-sweep`) with API-prefix restrictions enforced by auth middleware, following RFC 8725/7519/6750 BCP.
- **Strict Animated-Only Policy Preset** — added `animated_only_strict` system preset with strict genre/keyword constraints so non-animated items fail policy validation instead of silently passing, backed by a database migration (`20260617_120000`).
- **Local AI Policy Sweep Harness** — added a local-only harness (`scripts/local-ai-policy-sweep.mjs`) that submits real classification requests across multiple models, validates response contracts, verifies queue lifecycle, and persists history, with a paired cleanup utility and npm scripts (`test:local:ai-policy-sweep`, `test:local:ai-policy-sweep:cleanup`).
- **Strict Genre Hard-Block Test Coverage** — added a test confirming that `strict: true` on `require_any` genres produces a score of 0 when no required genre matches, preventing soft-advisory misclassification of animated-only libraries.

### Changed

- **RAG Embedding Provider Busy Graceful Degradation** — semantic search now treats embedding provider lock timeouts (`PROVIDER_LOCK_TIMEOUT`) as a degraded empty result (logged at INFO) instead of a hard error, preventing transient lock contention from failing active classifications. Hard failures still propagate when `throwOnError` is enabled.
- **Rolldown INVALID_ANNOTATION Warning Suppression** — added `onwarn` handler in Vite config to suppress `INVALID_ANNOTATION` warnings from `@vueuse/core@14.3.0` during build, where Rolldown (Vite 8's bundler) flags misplaced `/*#__PURE__*/` annotations that Rollup silently ignores.
- **Dependency Updates (Dependabot PRs #457, #458)** — applied `@playwright/test` 1.60.0 → 1.61.0 in client, and `knip` 6.16.1 → 6.17.1 in server.

### Fixed

- **Provider Lock Timeout in Semantic Search** — `isProviderBusyError` was not handled in the semantic search error path, causing a provider lock timeout to be logged as a fatal search failure and potentially aborting classification. The busy path now returns an empty result set and logs at INFO, matching the existing pattern in embedding, backfill, and classification persistence services.

## [0.47.5a-beta] - 2026-06-16

### Fixed

- **OMDb 401 Error-Log Noise** — an invalid OMDb API key or exhausted daily quota produced an HTTP 401 that was logged at ERROR level with a full stack trace, once per enrichment item, flooding the error log (5+ entries per cycle). Since a 401 is a recoverable configuration/quota condition that the queue already handles by pausing OMDb enrichment, it is now logged at WARN without a stack trace and deduplicated (30-minute window) so repeated 401s collapse to a single entry.
- **Transient Database Connection Timeouts** — early reads (JWT secret, classification dispatch-blocker check, image-embedding config) intermittently failed with "Connection terminated due to connection timeout" during startup bursts or brief Postgres unavailability, since pool connection acquisition had no retry. Added a bounded exponential-backoff retry around the idempotent connection-acquisition step (`pool.connect()`) in `query`, `withTransaction`, and `withSessionAdvisoryLock` — query execution is never retried, preserving exactly-once semantics for non-idempotent writes. The backoff uses an unref'd timer so a pending retry never holds the process (or test teardown) open. Tunable via `POSTGRES_CONNECT_RETRIES` (default 2) and `POSTGRES_CONNECT_RETRY_DELAY_MS` (default 250ms); follows the retry-with-backoff pattern for transient infrastructure errors. The retry warning skips DB persistence to avoid writing to a database that is currently failing. `healthCheck()` deliberately keeps failing fast without retry to report true connectivity.
- **Plex Library Fetch Timeout** — `getLibraries` had no explicit request timeout and fell back to the 30s HTTP default, long enough for a slow or unreachable Plex server to hold the entire `/api/media-server/sync` transaction open before aborting (and, in turn, trigger downstream sync failures). Added an explicit 10s timeout matching the existing `getLibraryItems` call so an unreachable Plex fails fast instead of stalling the sync.
- **Reasoning Model Classification Stalls (qwen3 family)** — reasoning/"thinking" models such as `qwen3.5:4b` were forced through Ollama's constrained-JSON decoding grammar, which fought their internal `<think>` reasoning tokens and produced generation stalls (`ESTALL` after 120s), hard timeouts (`ETIMEDOUT` after 300s), and prose-leak parse failures (`narrative_no_format_match`). Added a centralized `isReasoningModel()` detector (now including the `qwen3` family) so reasoning models bypass the rigid grammar and run free-form, relying on the existing strip → parse → repair pipeline to shape the structured answer.
- **Reasoning Model Stall Budgets** — reasoning models now receive larger streaming stall budgets (240s first-token, 90s heartbeat, 600s hard cap) versus the default 120s/60s/300s, since thinking models legitimately take longer to first token and emit more total tokens. Budgets are now overridable per call instead of hardcoded.
- **"No Library Configured" Mislabel on Retry Items** — queued-for-retry items showed the misleading "No Library Configured" routing label even when libraries were configured. The label reflected a missing *selected* library on an unfinished classification, not a configuration problem.
- **Queued-for-Retry Items Invisible in Command Center** — items in `pending_retry` state (queued after an AI failure) were never surfaced in the Command Center "Needs Attention" panel because the pending-classifications query only returned `awaiting_decision` rows. The panel now lists queued-for-retry items with their failure reason and a dedicated Retry Classification action.
- **Auto-Retry Dead-Letter Gap** — classifications that exhausted their automatic retry budget (`retry_count >= max_retries`) previously remained stuck in `pending_retry` indefinitely, never re-selected by the scheduler nor marked terminally failed. The retry scheduler now dead-letters exhausted items to a terminal `failed` state with a clear reason and `retry_after` cleared, following the dead-letter queue pattern (Azure Service Bus `MaxDeliveryCountExceeded`, AWS retry-with-backoff fail-after-N). Dead-lettered items remain visible in History and recoverable via manual retry.
- **Manual Retry Budget Reset** — operator-initiated "Retry Classification" actions now reset `retry_count` to 0, granting a fresh set of automatic attempts once the underlying AI issue is resolved, mirroring the DLQ operator-resubmit pattern. Scheduler auto-retries continue to carry the count forward so the automatic loop stays bounded by `max_retries`.

### Changed

- **Post-Upgrade Log Clear (v0.47.5a-beta)** — added a one-time `clear_logs` post-upgrade task so the upgrade starts with a clean logging state. Unresolved `error_log` rows and all `app_log` rows are cleared along with on-disk `.log` files; resolved (operator-reviewed) error entries are preserved.
- **Dependency Updates (Dependabot PRs #450–#453)** — applied open dependency bumps and refreshed all three lockfiles: root `axios` 1.17.0 → 1.18.0 (redirect/URL hardening security fixes); client runtime `axios` 1.18.0 and `vue` 3.5.35 → 3.5.38; client tooling `@tailwindcss/postcss`/`tailwindcss` 4.3.0 → 4.3.1, `@types/node` 25.9.2 → 25.9.3, `@vitest/coverage-v8`/`vitest` 4.1.8 → 4.1.9, `eslint` 10.4.1 → 10.5.0, `vue-tsc` 3.3.4 → 3.3.5; server tooling `@testcontainers/postgresql` 12.0.1 → 12.0.2, `@types/node` 25.9.2 → 25.9.3, `eslint` 10.4.1 → 10.5.0, `eslint-plugin-n` 18.0.1 → 18.1.0, `eslint-plugin-security` 4.0.0 → 4.0.1. Validated with the full server unit suite (13,123 tests) and clean security lint.
- **Domain Regex Lint Hardening** — the `eslint-plugin-security` 4.0.1 bump flagged the bounded domain-validation regex in `webSearchProviderContract.mjs` as potentially unsafe. Added a justified `eslint-disable` documenting why it cannot catastrophically backtrack (bounded labels separated by a mandatory literal `.`, plus an upstream Zod `.max(253)` length cap), restoring a zero-warning security lint.
- **Local knip lint scripts** — added `lint:knip` and `lint:knip:production` npm scripts to `server/package.json` matching the exact flags CI uses (`--reporter compact --no-progress --cache`), and updated the CI workflow to call these scripts instead of raw `npx knip` so local and CI checks stay identical. Follows the official knip CI guide recommendation to use `npm run` over `npx`.
- **Foundation web search provider knip ignores** — added temporary `ignoreIssues` entries for 4 web search provider framework files (`tavilyWebSearchProvider.mjs`, `webSearchProviderContract.mjs`, `webSearchProviderErrorTaxonomy.mjs`, `webSearchProviderStorage.mjs`) that are not yet wired into production code. These should be removed once the framework is consumed by the classification pipeline.
- **Tavily Provider Modernization** — added a provider-native Tavily client that uses bearer-token request headers, optional project tracking, bounded search payloads, and metadata-preserving provider errors. The legacy `tavilyService` now acts as a compatibility facade while the provider framework calls the modern client directly. Added `docs/architecture/tavily-modernization.md` with the research, tradeoffs, final stack, validation, and next migration targets.
- **Web Search Providers Settings UI** — replaced the Tavily-only settings page with a provider-neutral Web Search Providers page backed by provider-neutral settings routes and storage. Tavily saves now mirror to legacy `tavily_config`, Brave/Serper can be staged without raw JSON, provider tests are adapter-gated, masked keys are never echoed back on save, and `tab=tavily` remains a compatibility alias. Added `docs/architecture/web-search-providers-settings-ui.md` with research, tradeoffs, validation, and follow-up targets.
## [0.47.5-beta] - 2026-06-14

### Fixed

- **Media Server Library Sync Deletion** — fixed library sync failures when removed media-server libraries still had completed classification history by marking those history rows failed before the library delete can null the foreign key.
- **Web Search Provider Fresh-Install Seeds** — reconciled provider-neutral web-search seed data so fresh installs and upgraded installs both receive Tavily, Brave, and Serper provider rows while preserving migrated legacy Tavily settings.
- **AI Provider 404 Handling** — preserved HTTP status metadata from Ollama generation failures and classified provider/model-not-found responses as controlled AI availability failures, preventing missing-model 404s from being logged as hard classification errors.
- **Mapped Library Auto-Routing** — hardened successful classification routing so high-confidence or policy-auto results invoke the routing resolver even when libraries rely on modern `library_arr_mappings` instead of legacy `arr_type` fields, and added route-decision diagnostics for skipped or attempted routing.
- **Rating Normalization Count & Stale Mismatch** — fixed double-counting of ratings in the "Needs Normalization" and "Already Normalized" categories by making the count queries mutually exclusive. Added normalization of OMDb and TMDB metadata ratings during prioritization, and a post-upgrade database cleanup task to reset stale rating normalizations for re-processing.
- **Sync-Normalization Loop Resolution** — resolved the sync-normalization ping-pong loop by conditionalizing database updates on conflict, ensuring raw rating syncs only update local ratings when values have actually changed on the media server (comparing them case-insensitively and trimmed of whitespace).

### Changed

- **Web Search Provider Bridge Design Note** — documented the provider seed-reconciliation bridge, fresh-install parity requirements, official-source research, security constraints, and next Tavily/Web Search modernization targets.
- **Web Search Provider Hardening Plan** — added the Web Search Provider Framework roadmap and implemented the first provider-neutral normalization slice so Tavily web evidence is bounded, URL-filtered, provider-traceable, and ready for future Brave/Serper adapters.
- **Web Search Normalizer Hardening** — hardened normalized web-search evidence with HTML/script cleanup, control-character removal, rank/score/date normalization, Brave-style result extraction, and warning metadata for dropped or corrected provider fields.
- **Web Search Provider Contract Validation** — added a runtime provider contract validator plus a contract-compatible Tavily wrapper so future Brave/Serper adapters must expose bounded request, capability, and normalized-response shapes before routing can consume them.
- **Web Search Provider Error Taxonomy** — added provider-neutral error classification for auth, quota, rate-limit, invalid-request, provider-5xx, timeout, network, SSL, and malformed-response failures, including sanitized messages and `Retry-After` parsing for future cooldown routing.
- **Web Search Provider Config and Usage Storage** — added provider-neutral web-search config and usage tables, legacy Tavily projection/backfill, masked provider-config read models, usage/error recording, and schema snapshot coverage for future quota-aware routing.

## [0.47.4c-beta] - 2026-06-13

### Fixed

- **Enrichment State Real-Time Sync** — added immediate synchronization of media server item enrichment statuses when enrichment tasks are enqueued, cancelled, retried, or dismissed, ensuring stats like the "Basic Enriched" count update immediately in the UI.
- **Media Server Settings Navigation** — corrected the tab ID in the "Configure Media Server" CTA redirect from `media-server` to `mediaserver`, ensuring the link takes the user directly to the media server connection settings.
- **OMDb Enrichment Queue Refill** — allowed gap analysis queue refill to identify and re-queue items missing OMDb metadata when the OMDb provider becomes active, ensuring items previously enriched without OMDb data are properly filled in to complete their metadata profiles.
- **Rating Normalization Queue Refill** — allowed items that were previously normalized to be re-queued when new OMDb or TMDB metadata ratings become available, ensuring standard rating normalization is updated automatically.
- **Basic Enriched Status Hint** — added an info icon to the "Basic Enriched" status badge/stats card in the UI to guide users on configuring the OMDb API key for full metadata profiles.
- **Media Server Save Button** — enabled the global "Connect & Save" button when a valid media server configuration is loaded or active, and ensured it activates during setup wizard steps (Plex, Jellyfin, Emby) to act as a universal submit action.

### Changed

- **Password Manager Autocomplete Exclusions** — configured the shared `PasswordInput` component to default to `autocomplete="off"` and added standard ignore attributes (`data-lpignore="true"` and `data-1pass-no-save="true"`). This prevents browsers and password managers from prompting to save or update site login credentials when entering API keys and secrets in settings.
- **Quick Start Image Tracking** — changed the README Docker Compose example and release workflow to keep `ghcr.io/cloudbyday90/classifarr:latest`, matching the checked-in compose files so users can receive new images by pulling/recreating without editing compose each release.

## [0.47.4b-beta] - 2026-06-13

### Fixed

- **Initial Account Setup Redirect Loop** — stopped authenticated system-health polling and expired-session redirects from running on login/setup routes, preventing fresh installs from being pushed to `/login?expired=true` while creating the first admin account.
- **Plain HTTP Browser Console Noise** — only emits COOP/OAC browser isolation headers when HTTPS header enforcement is enabled, preserving standard security headers while preventing LAN HTTP warnings about untrustworthy origins.

## [0.47.4a-beta] - 2026-06-13

### Added

- **Policy Builder State Extraction Design Note** — added `docs/architecture/policy-builder-state-extraction.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Intent Contract Design Note** — added `docs/architecture/policy-intent-contract.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Builder Intent-First UI Design Note** — added `docs/architecture/policy-builder-intent-first-ui.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.

### Changed

- **Policy Builder State Extraction** — moved deterministic policy builder form state, selected starter-template state, custom signal helpers, intent signal helpers, validation, and save-payload construction into `usePolicyBuilderState.js` while preserving the existing legacy preset-compatible save payload.
- **Policy Intent Contract** — added server-owned `policy_intent_contract` metadata to policy read/create/update responses. The contract derives purpose, hard limits, helpful hints, avoid rules, review behavior, template provenance, warnings, and unsupported legacy preset signals without changing preset-backed policy storage or triggering migration.
- **Policy Builder Intent-First UI** — added a policy intent editor to `PolicyBuilderModal` so operators can add identity signals, compatibility signals, strict rating constraints, boosters, and exclusions directly. The editor uses a modular client-side intent projection while continuing to save through the existing structured `customSignals` policy payload.

### Fixed

- **Docker PostgreSQL Startup Loop** — kept the default Compose PostgreSQL runtime tmpfs hardened with `noexec` and made optimized pgvector runtime staging symlink-based. Startup now points `/run/postgresql/pgvector/vector.so` at the immutable image-layer AVX/AVX2 binary when safe, falls back to the generic image-layer `vector.so` if staging fails, and avoids restarting during the RAG embeddings migration. Also fixed the BIGINT classification-history migration to avoid PostgreSQL 18's ambiguous `smallint[] @> smallint[]` operator resolution.
- **Debug Rule Insert Route Hardening** — required read-write API permissions for the non-production library rule debug insert endpoint so a read-only API key cannot mutate rule data even in development/test deployments.

## [0.47.4-beta] - 2026-06-13

### Added

- **Streamlined *arr Setup Design Note** — added `docs/best_practices_esm_and_modular_services.md` detailing research recommendations, pros/cons, and final architecture decisions for Vue 3 composables and Node.js ES Module service design.
- **useArrConfig Shared Composable** — created `client/src/composables/useArrConfig.js` to manage reactive state, connection testing, and saving/transition operations for both Radarr and Sonarr instances.
- **Final Outcome Signal Snapshot Separation Design Note** — added `docs/architecture/final-outcome-signal-snapshot-separation.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Configuration Modernization Design Note** — added `docs/architecture/policy-configuration-modernization.md` with official-source research, recommendation tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Candidate Evidence Calibration Design Note** — added `docs/architecture/policy-candidate-evidence-calibration.md` with official-source research, calibration tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **Policy Constraint Semantics Design Note** — added `docs/architecture/policy-constraint-semantics.md` with official-source research, strict/advisory policy constraint tradeoffs, final implementation stack, security boundaries, validation notes, and next design targets.
- **RAG Evidence Quality Gating Design Note** — added `docs/architecture/rag-evidence-quality-gating.md` with official-source research, quality-gate tradeoffs, the final implementation stack, security boundaries, and the next design targets.
- **RAG Evidence Snapshot Observability** — RAG loop traces now persist bounded, sanitized pass-one/pass-two neighbor evidence and per-pass library counts in classification metadata. The History detail modal renders the snapshot alongside profile scoring and targeted re-check traces so future classification incidents can be diagnosed without direct PostgreSQL inspection.
- **Policy Evidence Hardening Design Note** — added `docs/architecture/policy-evidence-hardening.md` documenting the root cause, official-source research, recommendation tradeoffs, final implementation stack, outcome, and next design targets.
- **pgvector Retrieval Recall Design Note** — added `docs/architecture/pgvector-retrieval-recall-tuning.md` with official-source research, recommendation tradeoffs, final implementation stack, security constraints, validation commands, and the next three high-value design targets.
- **pgvector Recall Audit Mode** — added admin-only `GET /api/rag/retrieval/recall-audit` to compare bounded HNSW approximate nearest-neighbor results against exact search (`SET LOCAL enable_indexscan = off`) for sampled classification embeddings. Added `docs/architecture/pgvector-recall-audit-mode.md` with the design, tradeoffs, security boundaries, validation notes, and follow-up design items.
- **Decision Trace Correlation** — added W3C-compatible decision trace context for classification outcomes, including persisted `classification_details.decision_trace`, RAG loop `trace_context`, stage-log trace metadata, and a History detail panel that exposes trace ID, UUID correlation ID, traceparent, and compact decision stages. Added `docs/architecture/decision-trace-correlation.md` with the official-source research, recommendation tradeoffs, final stack, security boundaries, validation notes, and next design targets.
- **Decision Trace Stage Timing** — added bounded child spans for targeted re-check stages (`gate`, `enrichment`, `retrieval_pass2`, `policy_recheck`, `ai_rerun`, and `rag_candidate`) with span IDs, parent span IDs, duration, outcome, reason code, and sanitized scalar attributes. RAG traces, decision trace metadata, stage-log metadata, and the History detail modal now expose stage timing before any full telemetry exporter is introduced. Added `docs/architecture/decision-trace-stage-timing.md` with official-source research, tradeoffs, final stack, security boundaries, validation notes, and next design targets.

### Changed

- **Streamlined *arr Instance Setup** — refactored Radarr and Sonarr settings views to use `useArrConfig.js` composable, removing duplicate logic and implementing a clean one-pass configuration flow. Running a successful **Test Connection** now automatically saves settings to the database and transitions to edit mode to expose library mappings. Also updated both Radarr and Sonarr connection test handlers to populate `additionalInfo` with root folder and quality profile counts, enabled deletion of any configured instance (including the last remaining one), and integrated step-by-step setup instructions for both forms.
- **History Detail Outcome/Snapshot Separation** — split the History detail modal into explicit final outcome and original signal snapshot concepts. The signal panel now shows snapshot source, snapshot date, final outcome summary, and snapshot score instead of reusing the final row confidence for diagnostic evidence.
- **Policy Configuration Modernization** — added a structured `configuration_view` to policy read/create/update responses that projects merged preset and custom signals into identity signals, compatibility signals, strict constraints, boosters, exclusions, and bounded configuration warnings. Custom signal runtime constraint aliases are now normalized before persistence.
- **Policy Candidate Evidence Calibration** — calibrated weak policy candidates before ranking so compatibility-only, profile-only, and RAG-only evidence cannot outrank stronger identity or multi-source candidates purely through high raw scores. Ranked candidates now preserve `raw_score` and bounded `score_calibration` diagnostics for explainability.
- **Policy Constraint Semantics** — added explicit strict runtime constraint evaluation for policy preset signals while keeping existing policy scoring advisory by default. Strict constraints now work across genres, keywords, studios, language, media type, certifications, release year, vote average, and runtime; failing constraints are excluded from ranking and persisted as bounded `policy_constraints` diagnostics.
- **RAG Evidence Quality Gating** — added deterministic RAG neighbor quality scoring that demotes evidence without trusted final outcome provenance, resolved library identity, or compatible profile evidence. Policy candidate diagnostics now include bounded `rag_evidence_quality` details, and RAG suggestions/dynamic weights use quality-adjusted similarity.
- **Dead Exports Removed** — removed unused `decisionTraceContext` and `decisionTraceSpanCollector` namespace exports from their respective modules. All consumers already import the individual functions directly; the aggregated objects were flagged by knip as dead code.
- **Dependabot Maintenance Rollup (server tooling)** — bumped `@types/node` from 25.9.1 to 25.9.2 and `knip` from 6.16.0 to 6.16.1 in server dev dependencies. Closes #448.
- **Dependabot Maintenance Rollup (server runtime)** — bumped `morgan` from 1.10.1 to 1.11.0 and `undici` from 8.3.0 to 8.4.0 in server runtime dependencies. Closes #447.
- **Dependabot Maintenance Rollup (client tooling)** — bumped `@types/node` from 25.9.1 to 25.9.2 and `vue-tsc` from 3.3.3 to 3.3.4 in client dev dependencies. Closes #446.

### Fixed

- **RAG Evidence Library Identity Resolution** — resolved RAG neighbor library names from the live `libraries` table when legacy `classification_history.library_name` values are null, and added stable `Library #id` fallbacks in server trace sanitization, AI context formatting, and the History RAG evidence snapshot. This prevents stale denormalized rows from appearing as “Unknown library” evidence during policy/profile re-check diagnosis.
- **Policy Evidence Anchor Hardening** — added candidate eligibility diagnostics so hard profile exclusions and weak evidence (`rag_improved`, `profile_only`, broad compatibility-only signals) cannot become primary policy anchors or second-pass adoption targets. This fixes the failure mode where a RAG-only `Family` candidate could lead the question despite an `R` rating exclusion, and where a generic `Comedy` signal could over-influence a specialized `Comedy and Standup` destination.
- **pgvector Retrieval Recall Tuning** — centralized pgvector HNSW recall controls, raised candidate-gathering `ef_search` defaults, expanded bounded vector candidate windows, and enabled query-local iterative HNSW scans by default. This reduces the chance that policy/profile re-checks only evaluate a narrow RAG candidate set before deterministic evidence can reject weak matches.
- **pgvector Distance Ordering for HNSW Eligibility** — changed semantic retrieval's candidate CTE to order by `ce.embedding <=> query_vector` directly instead of sorting by an aliased similarity expression, keeping the pgvector HNSW index eligible for approximate nearest-neighbor scans.
- **Knip Production Dead Export** — removed unused `calibratePolicyCandidates` (plural) batch wrapper from `policyCandidateCalibration.mjs`; production code already calls `calibratePolicyCandidate` (singular) directly via `policyCandidateRanker.mjs`. Updated test to match. Eliminates both the knip `--production` unused-export and the ESLint `no-unused-vars` CI failures.
- **Client ESLint Unused Vars** — removed unused destructured `configs` and `loadConfigs` variables from `useArrConfig.test.js` caught by ESLint `no-unused-vars`.

## [0.47.3-beta] - 2026-06-06

### Changed

- **Dead Exports Removed** — removed unused `decisionTraceContext` and `decisionTraceSpanCollector` namespace exports from their respective modules. All consumers already import the individual functions directly; the aggregated objects were flagged by knip as dead code.

### Fixed

- **Policy Evidence Anchor Hardening** — added candidate eligibility diagnostics so hard profile exclusions and weak evidence (`rag_improved`, `profile_only`, broad compatibility-only signals) cannot become primary policy anchors or second-pass adoption targets. This fixes the failure mode where a RAG-only `Family` candidate could lead the question despite an `R` rating exclusion, and where a generic `Comedy` signal could over-influence a specialized `Comedy and Standup` destination.
- **pgvector Retrieval Recall Tuning** — centralized pgvector HNSW recall controls, raised candidate-gathering `ef_search` defaults, expanded bounded vector candidate windows, and enabled query-local iterative HNSW scans by default. This reduces the chance that policy/profile re-checks only evaluate a narrow RAG candidate set before deterministic evidence can reject weak matches.
- **pgvector Distance Ordering for HNSW Eligibility** — changed semantic retrieval's candidate CTE to order by `ce.embedding <=> query_vector` directly instead of sorting by an aliased similarity expression, keeping the pgvector HNSW index eligible for approximate nearest-neighbor scans.

### Added

- **RAG Evidence Snapshot Observability** — RAG loop traces now persist bounded, sanitized pass-one/pass-two neighbor evidence and per-pass library counts in classification metadata. The History detail modal renders the snapshot alongside profile scoring and targeted re-check traces so future classification incidents can be diagnosed without direct PostgreSQL inspection.
- **Policy Evidence Hardening Design Note** — added `docs/architecture/policy-evidence-hardening.md` documenting the root cause, official-source research, recommendation tradeoffs, final implementation stack, outcome, and next design targets.
- **pgvector Retrieval Recall Design Note** — added `docs/architecture/pgvector-retrieval-recall-tuning.md` with official-source research, recommendation tradeoffs, final implementation stack, security constraints, validation commands, and the next three high-value design targets.
- **pgvector Recall Audit Mode** — added admin-only `GET /api/rag/retrieval/recall-audit` to compare bounded HNSW approximate nearest-neighbor results against exact search (`SET LOCAL enable_indexscan = off`) for sampled classification embeddings. Added `docs/architecture/pgvector-recall-audit-mode.md` with the design, tradeoffs, security boundaries, validation notes, and follow-up design items.
- **Decision Trace Correlation** — added W3C-compatible decision trace context for classification outcomes, including persisted `classification_details.decision_trace`, RAG loop `trace_context`, stage-log trace metadata, and a History detail panel that exposes trace ID, UUID correlation ID, traceparent, and compact decision stages. Added `docs/architecture/decision-trace-correlation.md` with the official-source research, recommendation tradeoffs, final stack, security boundaries, validation notes, and next design targets.
- **Decision Trace Stage Timing** — added bounded child spans for targeted re-check stages (`gate`, `enrichment`, `retrieval_pass2`, `policy_recheck`, `ai_rerun`, and `rag_candidate`) with span IDs, parent span IDs, duration, outcome, reason code, and sanitized scalar attributes. RAG traces, decision trace metadata, stage-log metadata, and the History detail modal now expose stage timing before any full telemetry exporter is introduced. Added `docs/architecture/decision-trace-stage-timing.md` with official-source research, tradeoffs, final stack, security boundaries, validation notes, and next design targets.

## [0.47.2a-beta] - 2026-06-05

### Fixed

- **Ollama Preflight Probe Timeout Too Short for Cold Starts** — increased `DEFAULT_PROBE_TIMEOUT_MS` from 15s to 120s (2 minutes) so the generation readiness probe survives cold model loads that take 30-90 seconds on larger models. Existing installs with `OLLAMA_PROBE_TIMEOUT_MS` already set in `.env` are unaffected; new installs and upgrades get the longer default automatically. Updated `.env.example` documentation accordingly.

## [0.47.2-beta] - 2026-06-05

### Fixed

- **jsdom "Not implemented: navigation" Test Warning** — suppressed the spurious `Not implemented: navigation to another Document` console warning emitted during client test runs. Root cause was `Logs.vue` `exportLogs()` creating a temporary anchor element and calling `a.click()` to trigger a blob download, which jsdom interprets as page navigation. Fixed by spying on `HTMLAnchorElement.prototype.click` in the `exportLogs` test to prevent the real jsdom navigation handler from firing.
- **Canonical Classification History Outcomes** — changed `/api/classification/history` to return one canonical final row per media identity instead of every intermediate classification event. The server now groups rows by `tmdb_id` + `media_type` with a title/year fallback, ranks terminal user/outcome rows ahead of retry/source observations, and attaches the full `history_events` lifecycle to the selected row. The History detail modal now renders that lifecycle so retries, policy rechecks, manual resolutions, and source-library sync observations remain inspectable without presenting duplicate titles as separate outcomes.
- **RAG-Only Policy Promotion Guard** — downgraded `rag_improved` policy candidates to weak viability and blocked pure retrieval fallback candidates from becoming the final policy-prompt result. RAG can still improve a candidate and inform rechecks, but an automated final outcome now needs corroborating policy/profile/history/pattern evidence or a manual/user decision.
- **Library Profile Rating Normalization** — normalized ratings when generating `library_profiles.rating_distribution` so raw age ratings such as `16`, `17`, and `18` fold into canonical TV ratings like `TV-MA`. Profile scoring also normalizes legacy persisted distributions and exclusion ratings at read time, preventing stale mixed buckets from suppressing rating affinity while upgraded installs are being repaired.

### Added

- **Post-Upgrade Library Profile Regeneration** — added a one-time post-upgrade task for `0.47.2-beta` that regenerates active library profiles only when stale, non-canonical rating buckets are present. Existing installs repair themselves on startup instead of requiring manual PostgreSQL commands; fresh installs continue to pre-seed post-upgrade tasks as complete, and already-normalized profiles are marked complete without regeneration.
- **Profile Scoring Observability** — added bounded, versioned profile scoring diagnostics that persist with policy candidate diagnostics and render in the History detail modal. Operators can now inspect the rating normalization, profile distribution percentage, genre and keyword score deltas, and exclusion hits used for the original classification without rerunning scoring against a later profile state. Added `docs/architecture/profile-scoring-observability.md` with official-source research, recommendation tradeoffs, the final implementation stack, and follow-up design items.

### Changed

- **Dependabot Maintenance Rollup** — locally applied and validated the open Dependabot PR equivalents for client runtime (`axios` 1.17.0 with SSRF config hardening, auth redirect, and proxy TLS fixes), client tooling (`@vue/test-utils` 2.4.11, `eslint-plugin-vue` 10.9.2), server tooling (`knip` 6.16.0), and pinned GitHub Actions SHAs for `actions/checkout` v6.0.3 (SHA-256 repo support) and `github/codeql-action` v4.36.2 (exponential backoff, bundle v2.25.6).
- **Dead Export Removed** — removed unused `computeProfileScore()` export from `libraryProfileComputations.mjs` (callers use `computeProfileScoreDetails()` directly). Removed stale `socket.io` entry from `server/knip.json` `ignoreDependencies` (knip 6.16.0 now resolves the DI-injected import correctly).
