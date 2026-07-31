# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Changed

- **Native Policy Recovery Admission**: Persisted policies now open the native
  summary only after the server confirms a valid active native intent read.
  Invalid, conflicting, or incomplete native state is read-only and cannot
  expose compatibility editing, policy setup, save actions, or readiness calls.

- **Compatibility Policy Maintenance Surface**: Persisted compatibility
  policies now use a dedicated maintenance view that retains validated legacy
  editing but no longer loads or displays the native destination workflow.
  Raw scoring, combination-mode, and threshold controls have been removed;
  existing decision values remain preserved for server-validated compatibility
  writes. The browser-derived readiness aggregate and its focus-navigation path
  are also removed; automation readiness remains server-owned for native
  policies.

- **Compatibility Section Advisory Cutline**: Compatibility section cards now
  show direct control instructions and labeled configured-signal chips
  only. Browser-derived warnings, completion badges, and generated next-action
  messages have been removed so unsaved compatibility drafts cannot imply
  automation readiness, review behavior, confidence, routing, or enforcement.

- **Compatibility Configuration Summary Cutline**: Compatibility section cards
  now use their labeled configured-signal chips as the single source of draft
  display. The redundant client-generated behavior summary is removed, so the
  browser does not restate policy effects, confidence, review, or enforcement
  semantics from unsaved compatibility data.

- **Compatibility Intent-Summary Retirement**: The remaining global
  compatibility policy-behavior summary and its draft-derived warnings are now
  removed. Existing policy maintenance uses the editor's labelled controls as
  the sole draft representation; no compatibility save contract or server
  validation behavior changed.

- **Compatibility Save-Footer Admission**: Policy footer actions now show only
  direct unmet prerequisites and returned server errors. Browser-derived
  success, routing, and policy-readiness messages are removed; compatibility
  saves still use the existing server-validated write contract.

- **Compatibility Routing-Readiness Retirement**: Removed the unmounted local
  routing-readiness card and its test. Native policy creation continues to use
  the server-owned operator-workflow readiness and next-action surface.

- **Compatibility Setup-Card Grid Retirement**: Removed the unmounted
  destination setup-card grid, its browser-derived progress projection, focused
  tests, and retired routing anchor. Native creation continues to use the
  server-owned destination workflow and readiness surface.

- **Compatibility Group Guidance Cutline**: Group helper text now gives only
  concise editing directions. It no longer predicts automation safety, review
  behavior, fit, or confidence effects from a browser-side compatibility draft.

- **Compatibility Editor Framing Cutline**: Compatibility editor framing now
  states only the direct edit task, current selection, and factual empty state.
  Browser explanations of save mechanics, reconciliation, new-policy
  establishment, and redundant context counts have been removed.

- **Compatibility Maintenance Framing Cutline**: Compatibility maintenance now
  states only the direct destination-editing task for an existing policy.
  Browser-owned workflow comparisons and the permanent live-status announcement
  have been removed without changing typed editing commands or server-validated
  compatibility writes.

- **Compatibility Migration Notice Cutline**: Migration notices now show only
  the bounded, report-derived removal outcome and affected-preset preview.
  The browser-authored upgrade headline and manual reapply prompt are removed;
  dismissal remains local to the reported migration version and does not write
  policy state.

- **Native Policy Create Payload Cutline**: New native policies now submit only
  library identity, policy name, and explicitly accepted native intent. The
  server rejects hidden legacy configuration before validation or persistence
  and owns retained compatibility-column defaults.

- **Runtime Metrics Persistence Admission**: Validated runtime metrics now pass
  through a server-owned, no-write admission boundary that retains only a
  minimized fingerprinted snapshot, requires a bounded expiration policy, and
  keeps storage and telemetry export disabled until a separately reviewed sink
  integration exists.

- **Request-Time Learning Provenance Cutover**: Request/import terminal
  admission now accepts only task- and attempt-bound queue proof. Obsolete
  direct generic-plan input has been removed and a source-backed audit prevents
  it returning, while validated pending-question selection remains independent
  and terminal pending routing remains outcome-only.

- **Queue Question-Reduction Producer Cutline**: Request/import classification
  now creates one current, task- and attempt-bound queue proof inside the
  server-owned classification workflow. Terminal admission consumes only that
  opaque proof; the former direct generic plan remains internal to
  pending-question persistence and cannot authorize request-time learning.

- **Request-Time Terminal-Route Integration Audit**: The server now inventories
  live request/import and native pending terminal-route callers, verifies their
  guarded proof or outcome-only fallback, and accurately reports the
  queue-bound proof adapter as available until a live producer exists. The
  audit is read-only and cannot route, persist learning, refresh profiles, or
  expose queue/provider data.

- **Request-Time Queue Question-Reduction Admission**: Terminal request/import
  routing outcomes can now use only a revalidated, current-task-bound queue
  question-reduction proof before reaching the existing learning guard. Invalid,
  stale, cross-task, or competing proof remains outcome-only, without provider,
  routing, notification, profile-refresh, or learning writes.

- **Runtime Queue Question Reduction**: Classification queue work now derives
  bounded question and next-action plans only from revalidated queue automation
  decisions, preserves opaque execution provenance, and rejects raw or
  unsupported input without persisting, sending, routing, or learning.

- **Runtime Queue Automation Decision**: Classification queue work now derives
  a side-effect-free automation decision only from revalidated fresh evidence,
  binds it to opaque execution provenance, and fails closed on altered,
  unsupported, or raw queue data.

- **Runtime Queue Evidence Admission**: Classification queue work now has a
  server-owned, side-effect-free boundary that rebuilds runtime evidence from
  allowlisted current inputs, rejects cached decision/projection data, and
  emits opaque execution provenance without exposing queue payloads.

- **Runtime Queue Dispatch Cutline**: The server-owned runtime inventory now
  distinguishes queue dispatch from retry and requires queue lifecycle,
  processor, mutation, and scheduled-retry paths to declare their authority,
  replacement decision, and stale-decision/routing risks before runtime wiring
  can change.

- **Legacy Migration-Verifier Service Retirement**: The current migration
  removal ledger now excludes legacy verifier routes, services, and tests
  already removed from source. It retains only current engine/schema artifacts;
  the server-internal rollback verifier remains a live safety contract, not an
  HTTP endpoint or normal authoring feature.

- **Browser Migration Preview Retirement**: Retirement inventories and modal
  orchestration now exclude the already-deleted impact/replay browser preview
  family. Server-side migration verification remains isolated from normal
  policy authoring pending its own gated retirement.

- **Native Policy Evidence Recovery**: Native policy creation no longer offers
  browser-triggered profile refresh or workflow reload actions. It renders
  observed signal controls only from current server projection or
  server-admitted custom entry while server-owned profile recovery handles the
  lifecycle.

- **Library Rebuild Global Retirement Gate**: A server-owned, transaction-
  scoped aggregate now rebuilds compact final-removal plans for every current
  enabled policy against one removal inventory. It emits a fingerprint-bound,
  non-executing repository-retirement proposal, fails closed on incomplete or
  mismatched evidence, and cannot mutate source, delete runtime data, route
  media, or add browser controls.

- **Library Rebuild Final-Removal Audit**: A server-owned, transaction-scoped
  audit now recomputes cutover readiness and the current removal inventory
  before producing a compact per-library release-retirement plan. It blocks
  stale or mismatched evidence and never authorizes repository mutation,
  runtime deletion, routing, or browser controls.

- **Library Rebuild Deletion Readiness**: A server-only, read-only gate now
  binds completed rebuild provenance to the exact verification receipt,
  rollback snapshot/window disposition, replacement event, active native
  authority, and compact removal inventory. It fails closed, never persists
  deletion authorization, and cannot delete, hide, archive, route, or expose a
  browser control.

- **Server-Owned Rebuild Cutover**: Accepted library rebuilds now follow one
  idempotent server workflow that reuses a persisted verification
  receipt/rollback snapshot before applying native replacement. It stops with
  compact states on invalid evidence, performs routing only in the existing
  replacement transaction, and never authorizes legacy-path deletion.

- **Verified Rebuild Replacement**: Native library-rebuild replacement now
  consumes only the immutable migration-verification receipt bound to its
  persisted execution gate. Missing, mismatched, review-required, stale, or
  audit-invalid evidence stops before native intent, routing, or migration
  writes; replacement events retain compact receipt provenance only.

- **Verified Rebuild Snapshots**: Library-rebuild rollback snapshots now bind
  atomically to a current, immutable, zero-difference migration-verification
  receipt. Missing, stale, mismatched, review-required, risk-blocked, or
  audit-invalid evidence stops before rollback evidence is created; active
  legacy snapshot gates without this provenance are invalidated.

- **Persisted Migration Verification Receipts**: audited server-side migration
  verification now records only replay-protected fingerprints, source
  provenance/counts, verifier status/counts, and audit summaries. Receipts are
  immutable, exclude raw media and verifier differences, and do not create
  snapshots, replace policies, route media, or add browser controls.

- **Migration Verification Coordination**: accepted policy rebuilds now have a
  server-only, fail-closed path from persisted representative evidence through
  bounded verification. Invalid acceptance, missing coverage, or invalid audit
  output stops the process without exposing samples or performing policy,
  routing, rollback, or deletion writes.

- **Persisted Migration Samples**: migration verification can now select a
  bounded, deterministic set of finalized destination-library outcomes from
  persisted policy context. Missing usable history stays an explicit
  insufficient-coverage state; no provider call, browser control, routing, or
  write is used to manufacture migration evidence.

- **Bounded Native-Intent Migration Preview**: migration verification now uses
  a server-owned, comparison-only contract. It requires a usable legacy
  baseline before reporting parity, caps and sanitizes emitted differences, and
  keeps preview mechanics out of browser policy authoring.

- **Migration Deletion Safety**: legacy browser profile-refresh controls are
  now explicit delete-after-migration targets, and migration plans require the
  bounded preview contract alongside existing rollback and storage-stability
  gates.

- **Self-Healing Native Profile Recovery**: terminal native profile-refresh
  failures create bounded, idempotent server-owned successors. Repeated or
  known configuration failures now enter an automatic cooldown-and-probe
  recovery circuit rather than creating unbounded follow-up work.

- **Native Refresh Failure Boundaries**: Profile-refresh failures now use fixed
  server-owned classifications. Known local configuration errors stop their
  immediate successor path on the first attempt; transient and unknown failures
  retain bounded automatic recovery through the durable circuit policy.

- **Durable Native Recovery Circuit**: Native profile refreshes persist
  per-library, per-source-revision recovery state across scheduler runs and
  restarts. The system limits retries, runs one automatic probe after cooldown,
  clears recovery state after a successful refresh, and safely removes obsolete
  runtime history without adding operator controls.

- **Automatic Recovery Lifecycle**: Native profile recovery now has an
  integration-tested server-owned lifecycle from terminal failure through one
  cooldown probe, successful profile regeneration, circuit cleanup, and return
  to current policy readiness without a browser or operator action. Readiness
  now also distinguishes an absent active outbox record from real pending work,
  so a current open circuit remains visible during its automatic cooldown.

- **Source-Revision Recovery Isolation**: New library content now receives its
  own automatic profile-recovery revision. An older cooldown circuit cannot
  block, relabel, or otherwise leak into the current content's queued recovery.

- **Concurrent Recovery Probe Safety**: Concurrent schedulers now have
  integration coverage proving they create at most one automatic cooldown probe
  for a source revision and preserve one queued recovery state.

- **Concurrent Recovery Worker Safety**: Concurrent workers now have
  integration coverage proving only one can claim, generate, complete, and
  clear a pending automatic recovery probe.

- **Recovery Lease Reclaim Safety**: An expired automatic recovery probe can be
  reclaimed by a new worker, while the old claim token cannot complete the
  probe or clear its circuit.

- **Post-Generation Recovery Idempotency**: When a worker persists a current
  native library profile but stops before acknowledgement, the reclaiming
  worker recognizes the durable profile, completes the probe, and clears
  recovery state without generating the profile again.

- **Exhausted Recovery Lease Safety**: An automatic probe that exhausts its
  lease-attempt budget now terminalizes without profile work or circuit cleanup.
  The scheduler recognizes only its matching failed probe and reopens the
  bounded recovery cooldown.

- **Automatic Post-Exhaustion Recovery**: After an exhausted probe's cooldown,
  concurrent schedulers create one successor probe. A successful successor
  returns native profile recovery to current without operator intervention.

- **Bounded Repeated Automatic Recovery**: Repeated terminal automatic probes
  now retain a capped circuit failure count and exactly one later successor.
  Concurrent schedulers cannot duplicate that recovery work, while terminal
  outbox history remains under the existing server-side retention boundary.

- **Atomic Native Recovery Retention**: Expired inactive closed recovery
  circuits and their terminal outbox history now compact together. Active
  circuits, pending probes, protected current revisions, and recent history
  remain server-owned and intact.

- **Concurrent Recovery Retention Safety**: Overlapping scheduler planners now
  have integration coverage proving an expired current source revision remains
  protected through compaction while exactly one automatic recovery successor
  is durably scheduled.

- **Automatic Recovery Cleanup Resilience**: A compaction outage no longer
  interrupts durable native recovery scheduling. The next scheduler run retries
  cleanup automatically while current pending work remains idempotent and
  server-owned.

- **Concurrent Recovery Retention Idempotency**: Overlapping cleanup callers
  now have integration coverage proving expired inactive circuit and terminal
  history compact exactly once while protected current revisions remain intact.

- **Recovery-Retention Completion Audit**: Verified the complete persisted
  native profile-recovery path from bootstrap scheduling through planning,
  lease-protected delivery, atomic retention, read-only status, and replace
  restore. The remaining creation-only browser evidence-refresh control is now
  an explicit migration cutline rather than a persisted-policy recovery
  mechanism.

- **Native Policy Recovery Status**: Persisted native policy views now show
  server-derived automatic profile-recovery status instead of presenting stale
  profiles as a browser refresh action. When an automatic recovery circuit is
  cooling down or probing, the view reports that recovery is automatic without
  exposing retry timing, failure data, or controls.

The entries below describe distinct product behavior and operational guarantees
intended for the next release. They consolidate intermediate implementation work,
temporary diagnostics, and refactors only when those changes resulted in one
unchanged operator or runtime outcome.

### Added

#### Policy Authoring

- **Compact Persisted Native Summary** - Established native policies now show
  their stored purpose, policy-specific readiness from active native intent,
  cached profile freshness, and stored routing, plus one server-provided next
  action instead of reopening the multi-section policy setup workflow.

- **Persisted Native Policy View** - Saved policies now select their builder
  surface from the server-returned intent contract rather than their ID alone.
  Native-intent policies show a read-only native status and no compatibility
  editing or save controls; legacy contracts retain the compatibility editor.

- **Native Create Readiness Boundary** - Native policy creation now limits its
  footer to selected-library and explicitly accepted-purpose checks. Routing,
  provider, replay, TMDB, scoring, and automation state remain server-owned;
  compatibility-policy save warnings remain isolated until the migration path
  retires them.

- **Authorized Outcome Idempotency Receipts** - Classifarr now has a durable,
  append-only source-event receipt foundation for authorized outcome and
  learning writes. It returns an existing receipt only for an exact replay and
  rejects a changed command reusing the same event; manual corrections are the
  first live route to use the receipt.

- **Authorized Outcome Transaction Executor** - Classifarr now has one
  rollback-safe execution boundary that locks the classification and target
  library, revalidates authority, claims the source-event receipt, records a
  compact final outcome, and applies only command-approved learning effects.
  Compatibility and identity evidence now append their refresh intent with the
  same transaction; profile regeneration remains deferred to a worker.

- **Atomic Manual Corrections** - authenticated manual corrections now commit
  the locked correction lifecycle, source-event receipt, legacy-compatible
  outcome projection, and eligible exact-item memory together. Failed
  authorization, state validation, or persistence rolls back the full change.

- **Profile Refresh Command Validation** - Classifarr now rejects refresh plans
  unless they are tied to authorized compatibility or identity evidence, the
  locked final destination, and the learning guard's refresh reason. This
  contract is side-effect free while durable evidence and queue consumers are
  completed separately.

- **Compatibility Evidence Writer** - Classifarr now compiles and persists
  command-authorized supporting evidence only for canonical genre, studio,
  franchise, or certification signals. The writer cannot create destination
  identity, hard limits, avoid rules, or declared policy intent.

- **Identity Evidence Authority Admissions** - Classifarr now has an
  append-only identity-admission foundation that requires a manual outcome to
  match independently declared native purpose authority before it can reinforce
  identity. It cannot change declared intent, and raw library distributions,
  AI output, provider data, labels, and manual outcomes alone cannot establish
  a destination identity.

- **Atomic Profile Refresh Outbox** - Classifarr now persists a compact,
  source-event-deduplicated profile-refresh request in the same transaction as
  admitted compatibility or identity evidence. It contains only server-derived
  correlation and operation data, is cleared during replace restore, and is
  consumed automatically by a lease-protected worker with bounded retries.

- **Automatic Native Profile Recovery** - Active native-policy libraries with a
  missing or stale stored profile now queue server-owned background refresh
  work automatically. Requests are coalesced per library, preserve the
  existing lease and retry guarantees, and recheck freshness before generation
  so policy reads and browser actions remain side-effect free.

- **Authorized Outcome Recovery Guarantees** - Classifarr now verifies with
  isolated PostgreSQL transactions that concurrent source-event replays produce
  one durable effect, stale authorization or destination state cannot write,
  evidence/outbox failures roll back atomically, and recovered outbox leases
  reject stale worker completion.

- **Authorized Outcome Persistence Commands** - Classifarr now validates a
  pure, server-owned persistence plan against canonical intake, learning guard,
  revalidated actor authority, and transaction-locked current state. A valid
  final outcome can remain outcome-only when learning authority is absent; the
  new component performs no direct storage or provider side effects.

- **Discord Pending-Answer Intake Gate** - Discord verification and correction
  now record the existing item outcome before passing server-owned pending
  state through canonical learning intake. They remain outcome-only and cannot
  create preference, exact-match, routing, provider, quota, or profile-refresh
  side effects; legacy direct Discord learning writes have been removed.

- **Request-Import Fallback Intake Gate** - terminal request/import routing
  now sends missing or invalid native-plan fallback outcomes through canonical
  server-owned learning intake before the guard evaluates them. Valid plans
  retain their existing request-time semantics; neither path infers requester
  intent or adds learning, routing, provider, quota, or refresh activity.

- **Native Pending Route-Outcome Intake Gate** - terminal native route success
  and missing-mapping outcomes now use canonical server-owned learning intake
  before the guard can run. Their compact outcome history remains distinct from
  learning, excludes raw routing diagnostics, and cannot queue a refresh or
  initiate a route, provider, or quota operation.

- **Native Pending Resolution Intake Gate** - native pending-resolution
  provenance now sends both validated and malformed-plan fallback selections
  through canonical server-owned learning intake before evaluating the guard.
  The compact audit trail retains only bounded source-event provenance; unknown
  frames fail closed, and the flow remains outcome-only with no routing,
  learning, provider, or profile-refresh side effect.

- **Request-Time Learning Intake Gate** - request, confirmation, manual
  destination, and routing learning decisions now require a bounded
  server-provided event correlation and canonical intake before the learning
  guard can run. Existing question-reduction fingerprint, route-failure, and
  no-write guarantees remain intact; durable persistence remains separate work.

- **Manual Correction Learning Provenance** - manual classification corrections
  now derive a server-owned event identifier from the persisted correction row
  before exact-item learning is evaluated. The shared intake and learning-guard
  audits fail closed when correlation is missing or tampered with; the change
  adds no new learning, routing, provider, or profile-refresh side effect.

- **Canonical Policy Learning Intake** - Classifarr now has a versioned,
  server-owned intake contract for manual, confirmation, Discord, request, and
  routing learning sources. It requires bounded event correlation, allowlisted
  source/question/answer values, and a final outcome bound to that event while
  excluding raw AI and provider payloads. The contract is side-effect free;
  live adapter adoption and authorized persistence remain separate follow-up
  work.

- **Policy Authoring Test Cutline** - policy-authoring presentation coverage
  now has a complete bounded inventory with clear workflow, compatibility,
  draft-bridge, and verifier ownership. The audit rejects missing or duplicate
  classifications, undocumented scope changes, invalid exclusions, and
  compatibility or verifier coverage appearing in the normal authoring path.

- **Predictable Keyboard Recovery Flow** - policy-authoring modals now keep
  keyboard focus contained and restore it after normal close. Library evidence
  refresh, retry, and sync actions retain a logical focus target after their
  async updates, while successful mapping actions move focus to the library
  mapping section rather than returning to the closed builder.

- **Single Workflow Status Priority** - policy authoring now announces one
  ordered progress or failure state across workflow loading, evidence recovery,
  library refresh, and empty-state setup while preserving each local recovery
  action and explanation.

- **Scoped Empty-State Recovery Feedback** - library sync and routing-mapping
  recovery now show progress only for the action in flight, retain distinct
  server-approved busy copy, and keep competing recovery actions from being
  mislabeled or triggered concurrently.

- **Clear Evidence Recovery Actions** - native policy creation now keeps
  profile refresh and evidence-check recovery actions distinct while busy, and
  each action is programmatically associated with its visible explanation.
  Recovery remains bounded to one server-approved action per evidence state.

- **Focused Destination Question Guidance** - destination questions no longer
  repeat generic projected readiness instructions in every card. Card-scoped
  evidence and routing recovery actions remain available where they apply,
  while compatibility-policy readiness remains a single workflow-level status.

- **Accessible Save Block Feedback** - when policy creation or saving is
  unavailable, the footer now presents the exact required correction as its
  visible next step and associates the disabled primary action with that
  status. Operators no longer need a hover tooltip to understand what must be
  corrected, and no duplicate warning panel is added.

- **Starter Template Intent Boundary** - removed raw starter-template
  selection, browser, and suggestion endpoint from policy authoring. Optional
  template-derived values now arrive only through server-owned, source-labelled
  candidate projection and explicit typed intent commands; existing preset
  attachments remain compatibility-only context in the legacy draft bridge.

- **Deterministic Profile Intent Suggestions** - policy intent now derives
  evidence-backed proposals through a versioned server-owned rule plan. Every
  suggested entry includes a stable rule ID and explanation; metadata and
  unsupported broad genres remain helpful evidence, observed absence remains a
  review trigger, and only operator-declared evidence can propose hard limits
  or avoid values.

- **Broad-Genre Identity Eligibility** - observed broad genres now need an
  eligible specific identity before they can define a destination: non-stale
  media-server evidence, at least two observed items, and `0.70` confidence.
  The server rechecks the same rule when it audits an intent draft; metadata,
  weak, stale, or malformed supporting evidence remains non-authoritative.

- **Server-Owned Constraint Decisions** - the native policy workflow now
  publishes a bounded, display-only decision model that keeps hard limits,
  avoid values, and review warnings semantically distinct. Hard limits can
  block automatic application only after explicit operator action; avoid values
  only lower confidence; observed absence can only lead to review warnings. The
  projection contains no selected values, raw evidence, persistence authority,
  runtime decision, routing execution, provider activity, or quota usage.

- **Typed Constraint Draft Commands** - explicit constraint choices can now be
  resolved against server-owned decision semantics and a canonical per-library
  value allowlist into bounded transient draft commands. Native setup now uses
  accessible labelled selects for hard limits, avoid values, and review
  warnings; it does not accept free-form values, and unsupported library media
  types fail closed without controls. The browser forwards the server-approved
  command identifier instead of deriving behavior from a visible label; the
  local state clears when the selected library changes. Staged constraints
  remain visibly unsaved and cannot write a policy, mutate compatibility
  payloads, route media, create learning, call a provider, or consume quota.

- **Server-Side Constraint Admission** - future native constraint storage now
  has a protected, rate-limited admission boundary that independently rebuilds
  the active library's decision semantics and canonical value allowlist before
  it accepts one typed local command. The DTO rejects extra client fields and
  cannot supply a library, actor, projection, write target, or reusable
  approval token. The current result is non-persistent: it cannot change a
  policy, compatibility payload, runtime decision, learning record, route,
  provider, quota, or media server, and a later storage transaction must
  revalidate the command again. Admission responses also expose no normal
  workflow next action, so a preflight cannot create a seventh readiness state
  or imply that a policy write occurred.

- **Evidence-Backed Destination Signals** - new policies now distinguish
  read-only values already observed in the connected library from the proposed
  signals that can define future matches. Operators can select several supported
  genre, studio, or keyword suggestions at once; a versioned server-owned
  projection now carries source, state, explanation, bounded evidence, optional
  matching starter-template provenance, and disabled reasons. Broad generic
  identity values remain unavailable without supporting evidence, raw
  template/profile records are not exposed, and no observation becomes intent
  until explicitly accepted. For sparse libraries, an optional custom-value
  fallback now validates only supported genres, keywords, or studios with an
  operator explanation on the server, returns the candidate through the same
  bounded projection, and still requires explicit selection. It cannot write
  policy state, create learning, route media, or consume provider quota. Policy
  creation still establishes native authority, audit history, routing state,
  and a rollback snapshot atomically without provider calls, quota consumption,
  learning, or media routing.

- **Native-First Policy Creation** - creating a new policy now focuses on the
  connected library and explicitly accepted observed destination values. Legacy
  starter templates, raw preset controls, migration notices, and scoring
  thresholds no longer load or appear on the new-policy path; they remain
  available only while editing an existing compatibility policy. Creation
  requires declared destination meaning, while incomplete routing remains a
  clear non-blocking follow-up before automatic application can occur.

- **Bounded Native Evidence Recovery** - new-policy creation now keeps stale,
  missing, empty, and failed library-profile evidence out of destination
  selection. Classifarr offers one explicit profile refresh or evidence reread,
  then reloads the server-owned workflow before values can be accepted; unsafe
  evidence can be deferred without reopening legacy authoring controls.

- **Native Policy Create Confirmation** - after a native policy is created,
  Classifarr keeps the outcome visible while it confirms the persisted declared
  intent and routing state. The handoff uses the server response and an
  authorized policy reread rather than unsaved browser state, and it remains
  clear that the policy was saved even when detailed reread data is temporarily
  unavailable.

- **Bounded Native Establishment Provenance** - native policy creation now
  retains one small, server-generated record of the cached library-profile
  context available at establishment. The record is explicitly not policy
  authority, cannot affect routing or learning, avoids media-item and path
  data, is retained for the 14-day recovery window, and is then redacted to a
  minimal audit marker.

- **Library-First Policy Workflow Shell** - replaced the policy builder's
  setup-card grid and standalone routing diagnostic with the five
  destination-first questions, current library observations, and one
  server-owned automation-readiness outcome. Observations remain unselected
  until an explicit policy-intent action, and the display cannot issue media,
  provider, quota, write, learning, or routing operations.

- **Composable Policy Workflow Context** - policy setup, observed library
  evidence, and the automation-readiness next action now render through
  dedicated presentation components. The workflow continues to consume only
  server-owned display values, preserves read-only evidence until explicit
  acceptance, and does not add client policy, routing, provider, quota,
  learning, or media authority.

- **Ordered Native Destination Questions** - new-policy creation now presents
  the complete server-owned destination workflow in one accessible sequence.
  Accepted observed values and evidence recovery appear only under `What
  belongs here?`, while other policy questions show bounded next actions until
  their dedicated controls are available; no hidden policy rule, media route,
  or legacy builder action is introduced.

- **Actionable Destination Empty States** - new-policy creation now distinguishes
  a missing library profile from a profile-read failure, guides a new library
  through the existing sync-and-profile-refresh sequence, opens unmapped
  libraries in their existing mapping screen, and keeps sparse evidence as
  explicit guidance rather than guessed policy intent or a non-functional
  control.

- **Library-First Policy Workflow Read API** - added a read-only server
  projection for the five destination-first policy questions. It safely exposes
  cached library-profile suggestions and stored routing readiness without live
  media or provider calls, quota reads, policy writes, learning, or routing;
  observed values remain unselected until a later explicit intent action.

#### Platform Integrity

- **Policy Evidence Artifact Cutline** - reconciled each active legacy
  rewrite, replacement, or deletion group with an allowlisted bounded engine
  successor. Evidence mappings must use admitted source-to-bucket pairs, while
  runtime library evidence remains independent of checkout validation.

- **Policy Engine Artifact Inventory** - extracted the policy-engine cutline
  into a dedicated validated inventory of active artifacts and retired
  diagnostic surfaces, with explicit owner, replacement, and test decisions.

- **Automatic Instance Closure-Evidence Assembly** - added a read-only,
  platform-agnostic command that derives current-closure and requirement-audit
  artifacts from existing fingerprint-valid completion and validation evidence.
  It fails closed without evidence synthesis, validation execution, source or
  storage mutation, Git commands, or network calls.

- **Bounded Closure-Evidence Launcher** - added a fixed-command launcher that
  generates validation evidence and assembles the closure chain without shell
  execution or inferred completion evidence. Generated output remains inside
  the selected checkout, and failed or timed-out commands stop the run with
  compact diagnostic identifiers.

- **Public Compatibility-Removal Artifact Cutover** - all public
  compatibility-removal exporters now require current, plan-bound runtime
  evidence before they produce downstream authorization, completion,
  regeneration, or storage-closure artifacts. Legacy, missing, or cross-plan
  evidence fails closed; explicit blocked output is a bounded,
  non-authoritative diagnostic with fixed reason IDs and one next step.

- **Direct Compatibility-Removal Plan Binding** - post-removal runtime evidence
  now retains the exact execution-plan artifact digest used by the applied
  review. Next-batch authorization and completion replay require that digest to
  match the current verified plan artifact, blocking missing or cross-plan
  evidence without issuing commands, mutating storage, or depending on local
  deployment configuration.

- **Bound Release-Prerequisite Evidence** - compatibility-code retirement now
  requires one fresh, versioned, subject-bound attestation contract tied to the
  current deletion-readiness context. Legacy approval booleans and unsupported
  CLI fields are rejected, while stale, malformed, mismatched, duplicated, or
  unrecognized-subject-type evidence remains blocked. Backup/restore evidence
  stays database-owned, and this release-only contract cannot alter routine
  native policy automation or perform a destructive action.

- **Actionable Compatibility-Deletion Readiness** - compatibility maintenance
  outcomes now distinguish ready native policy automation from blocked
  compatibility-code retirement release prerequisites. The bounded readout
  reports only fixed blocker IDs and a next action, rejects invalid helper
  evidence, and does not expose backup details or authorize removal.

- **Automatic Compatibility-Deletion Diagnostics** - revision-matched local
  installations can now collect current, database-owned compatibility-deletion
  evidence without a hand-created JSON input file. The automatic result remains
  fail-closed: it cannot invent coverage, support, residual-reference,
  rollback, diagnostics, or approval evidence, and it cannot authorize or
  perform removal.

- **Current Checkout Closure Evidence Integrity** - policy storage current
  closure audits now bind the SHA-256 content digest of their mapped source,
  documentation, test, roadmap, and changelog evidence. The final requirement
  audit recomputes that bounded fingerprint for its selected checkout and
  blocks stale or cross-checkout artifacts before accepting completion; it does
  not run commands, Git, database operations, or writes.

- **Durable Naming Gate Matcher Integrity** - the production naming gate now
  checks both artifact paths and contents for mixed-case or future roadmap
  markers while excluding valid local-model and certification identifiers. A
  zero-debt audit now proceeds to the next product component instead of
  requesting an unnecessary rename batch.

- **Canonical Compatibility Removal Selection** - compatibility-removal review
  batches now accept only unique canonical repository-relative manifest and
  selected paths, and require meaningful replacement evidence for every chosen
  entry. Malformed, traversal, alias, duplicate, and empty-evidence inputs
  fail closed before a later apply adapter can receive them.

- **Semantic Compatibility Deletion Readiness Validation** - compatibility
  removal planning now rejects serialized readiness reports whose native
  authority, reconciliation state, runtime cutover, deletion gates, recovery
  confirmations, derived status, or non-destructive execution handoff no
  longer support a `ready` claim. Fresh source collection remains bounded by
  the subsequent execution-plan evidence bundle.

- **Repository And Installation Closure Separation** - policy storage closure
  evidence now reports repository implementation readiness independently from
  an active installation's compatibility-removal cutover. Pending instance
  evidence remains fail-closed for deletion and final closure, but cannot make
  the source implementation appear incomplete or depend on local media-server
  configuration.

- **Isolated ESM Integration Imports** - the static-import quality gate now
  recognizes integration suites that must load services after the shared Jest
  database facade is registered. This preserves Testcontainers isolation and
  continues to flag unnecessary dynamic test imports without depending on a
  developer's local application configuration.

- **Reconciliation Scheduler Overlap Guard** - native-intent reconciliation now
  skips an overlapping recurring callback within one application process before
  it opens a database session, while retaining PostgreSQL advisory locks as the
  cross-replica conversion authority.

- **Automatic Native Policy Initialization** - existing destinations without
  legacy presets now establish a bounded baseline from their current connected
  media-server profile during scheduler-owned reconciliation. The generated
  baseline preserves existing review thresholds and routing configuration but
  adds no hard limits, avoid rules, learning writes, external provider calls,
  or user-specific naming assumptions. Missing, stale, or insufficient
  profiles are regenerated and retried automatically rather than becoming a
  terminal manual-maintenance state.

- **Bounded Compatibility-Removal Readiness Diagnostics** - when the approved
  compatibility-removal evidence chain has not yet been created, Classifarr now
  emits only the missing approval categories in an explicit diagnostic run. The
  read-only report cannot act as closure authority and does not write a nested
  completion-audit artifact, resolve a deletion plan, or scan a checkout,
  preventing incomplete readiness checks from looking like deletion approval.

- **Checkout-Bound Compatibility Evidence** - compatibility-removal evidence
  generation now resolves relative input and output artifacts from the same
  requested repository checkout used for path-state and source-reference
  validation. This prevents a caller directory from mixing another checkout's
  evidence into a current removal decision.

- **Checkout-Bound Storage Closure Evidence** - policy storage closure and
  current-closure commands now resolve every relative evidence input and audit
  output from their selected checkout. This prevents a shell caller from
  mixing artifacts from one repository with source evidence from another.

- **Semantic Native Intent Authority** - native intent now replaces
  compatibility behavior only when its active header is fully materialized:
  native source, completed inference, safe validation, and a persisted purpose
  rule. Historical empty placeholders are deactivated with bounded audit
  evidence; incomplete active rows fall back to compatibility behavior or block
  unsafe conversion rather than suppressing the existing policy. Storage
  closure evidence now requires this semantic safeguard independently from the
  structural active-header invariant.

- **Native Runtime Compatibility Recovery Integrity** - a single malformed
  active native-intent row now receives the preserved compatibility presets its
  runtime path declares authoritative. Valid native authority and duplicate
  native-authority conflicts still suppress legacy signals, so ambiguity cannot
  resume legacy scoring.

- **Contained Runtime Evidence Escalation** - compatibility cleanup now
  distinguishes current retained runtime evidence from the narrow safe case
  that requires a fresh embedded probe. Only an otherwise-valid preflight with
  missing or stale runtime evidence can request the existing
  provenance-bound, read-only maintenance runner; invalid evidence, unsafe
  checkout or manifest state, image-provenance failures, containment failures,
  and runtime-query failures remain blocked without trusting host or
  caller-provided runtime claims.

- **Compatibility Deletion Evidence Attestation** - compatibility cleanup now
  independently collects and then revalidates the reviewed checkout, approved
  execution-plan fingerprint, manifest-path continuity, and runtime-evidence
  reference before batch assembly. Dirty, stale, altered, cross-plan,
  post-observation, duplicate, unsafe, or missing evidence fails closed;
  recovery proof, approval, rollback, and support decisions remain separately
  attributable human gate requirements.

- **Compatibility Deletion Apply-Time Integrity Check** - controlled
  compatibility cleanup now rechecks every approved path immediately before it
  reaches the removal adapter. Revision drift, altered or missing files,
  symlinks, non-regular paths, invalid `HEAD` entries, and content changes block
  the affected entry without invoking the adapter; the apply result retains
  bounded verification evidence and clearly reports a stopped batch, including
  any earlier narrow entries that already applied.

- **Fail-Closed Compatibility Removal Applies** - controlled compatibility
  cleanup now stops immediately after the first adapter error, rejected result,
  or forbidden reported side effect. Later approved paths are not rechecked or
  submitted; the result identifies the stopped entry and halt reason, preserves
  prior applied evidence for verification, and sends zero-removal failures to
  blocker resolution instead of a misleading runtime-validation handoff. When
  a batch is rejected before apply, its bounded upstream review reason remains
  available to diagnostics.

- **Bounded Partial Removal Verification** - a stopped compatibility-removal
  batch can now verify only the exact prefix that already applied when its halt
  reason, stopped entry, review/gate provenance, and import/runtime/validation
  evidence agree. Partial verification is explicitly non-authorizing: it routes
  to blocker resolution and cannot start another removal batch or completion
  audit.

- **Native Policy Engine Authority** - converted policies now classify from
  persisted native intent rather than retained legacy presets or
  `custom_signals`. Native purpose establishes eligibility before supporting
  evidence can contribute; invalid authority and unknown hard limits fail
  closed with bounded decision-source diagnostics.

- **Read-Only Native Intent Reconciliation** - retired the interactive native
  intent preview, selection, confirmation, and apply workflow. Administrators
  now have a bounded reconciliation-status view while scheduler-owned
  reconciliation remains the only normal conversion path; protected recovery,
  rollback, and re-entry controls remain separate.
- **Bounded Native Intent Reconciliation** - Classifarr now schedules safe,
  server-owned native-intent conversion after application readiness and every
  ten minutes. A database advisory lock permits only one replica to run; each
  run is capped by policy count and time, excludes already-native policies and
  respects active rollback holds, reuses transactional authority safeguards,
  and records a distinct reconciliation actor without exposing raw policy
  payloads.
- **No-Work Native Reconciliation Safety** - a reconciliation pass with no
  unconverted policies now completes as a side-effect-free evaluated outcome
  instead of treating the intentionally absent conversion workflow as a system
  error. Empty inventory remains auditable as `no_candidates` without false
  failure alerts or conversion attempts.
- **Native Reconciliation Alert Persistence Safety** - reconciliation alerts
  now explicitly type their PostgreSQL lifecycle-state parameters, preventing
  failed alert transactions and cooldown loss. Alert persistence failures retain
  only a safe lifecycle stage and reason while real PostgreSQL coverage verifies
  notification deduplication and resolution behavior.
- **Native Reconciliation Scheduler Collision And Restart Assurance** - added
  failure-injection coverage proving a delayed startup reconciliation skips
  when a recurring run already holds the shared advisory lock, scheduler
  reinitialization produces one fresh locked run, and persisted retry backoff
  survives a fresh reconciliation state-service instance.
- **Native Reconciliation Transaction Rollback Assurance** - added
  transaction-aware failure injection proving that a late native-rule write
  failure rolls back the earlier native-intent header, rollback snapshot, and
  migration events rather than committing partial conversion or recovery data.
- **Native Reconciliation Database Integration Assurance** - added real
  PostgreSQL scheduler coverage proving a ready legacy policy converts without
  a client dialog or apply request. The scheduler-owned path acquires its
  session advisory lock and persists the validated active native intent, native
  rule/template/rollback/audit records, and reconciliation ledger outcome while
  clearing transient retry state.
- **Native Intent Reconciliation Ledger** - automatic native-intent conversion
  now retains bounded, post-commit run and per-policy outcome evidence using
  safe state IDs, timestamps, policy references, and candidate fingerprints.
  Empty evaluations and scheduler lock skips cannot masquerade as completed
  work; retention and backup/restore preserve support evidence without copying
  legacy policy payloads.
- **Fingerprint-Bound Reconciliation Retry Safety** - automatic native-intent
  conversion now keeps a compact, per-policy retry and maintenance state.
  Ready policies are selected ahead of unchanged blockers or active backoff;
  technical failures retry with bounded backoff, while unsupported policies
  remain visible without starving safe conversions. Routing and profile
  readiness remain separate from conversion eligibility.
- **Rollback And Restore Reconciliation Safety** - a successful native-intent
  rollback now creates a durable reconciliation hold in the same transaction,
  preventing automatic reconversion until an administrator explicitly approves
  re-entry. Backup restore closes reconciliation until schema and native
  authority validation pass, preserves safe rollback history, and recalculates
  retry scheduling from restored current state rather than resuming imported
  work.
- **Native Intent Reconciliation Circuit Breaker** - automatic conversion now
  pauses after repeated same-category database, schema, or native-authority
  failures. Administrators have an attributable emergency stop and reset path;
  automatic recovery uses a read-only health probe before a later scheduled
  conversion pass, while policy-local blockers and normal policy operations
  continue independently.
- **Sanitized Reconciliation Failure Attribution** - automatic conversion
  failures now retain a correlated, bounded stage/reason/category and a
  truthful failed-run ledger record when storage is available. Structured logs
  no longer substitute a logger-generated stack for the original failure, and
  do not persist raw exception text, stacks, credentials, or legacy payloads.
- **Native Reconciliation Runtime Provenance** - each persisted reconciliation
  run now records a validated application version and optional immutable build
  revision, surfaced on the existing read-only administrator status page.
  Historical rows remain explicitly unknown; mutable image tags, container
  identifiers, Docker access, raw environment values, and manual recovery
  controls are not introduced.
- **Native Intent Reconciliation Status And Alerts** - administrators can now
  read a bounded, read-only reconciliation status with safe run correlation,
  automation control, unresolved-state, and blocker evidence. Classifarr
  persistently deduplicates in-app alerts for an open circuit, prolonged
  unresolved inventory, or repeated systemic failures without restoring a
  manual conversion workflow.
- **Compatibility Deletion Resolution Gate** - compatibility cleanup now
  requires independently measured zero unconverted enabled policies and zero
  current `requires_maintenance` reconciliation states. The server collects
  both inventories in a read-only consistent snapshot where supported; missing,
  stale, malformed, or mismatched evidence blocks deletion planning. Support
  acknowledgements and alert lifecycle state cannot bypass unresolved work.
- **Native Conversion And Automation Readiness Separation** - valid policies
  can now convert to native intent even when routing or profile freshness still
  needs work. Those automation blockers are reported separately, and unmapped
  native routing targets persist as `missing` rather than `configured`; routing
  remains fail-closed until setup is complete.
- **Approved Final-Removal Manifest Source** - storage-closure final-removal
  audits now require ready, fingerprint-valid execution-plan artifacts and
  reject raw, unapproved, altered, unsafe, or duplicate manifest paths before
  repository inspection.
- **Replayable Final-Removal Checkout Evidence** - final-removal audits now
  consume a fingerprinted, replay-verified snapshot of approved manifest path
  state instead of reading the live checkout during completion evaluation.
  Missing, altered, incomplete, or cross-artifact snapshots block closure.
- **Final-Removal Artifact-Chain Assurance** - the public storage-closure
  audit generator is now verified end to end against its approved plan,
  checkout snapshot, runtime authorization, validation, and source-scan
  inputs. A live product import or cross-artifact snapshot cannot produce a
  complete closure result.
- **Execution-Plan Artifact Export Assurance** - ready compatibility-deletion
  input now has end-to-end command verification that its fingerprint-valid
  wrapper, not the diagnostic nested plan, is accepted as storage-closure
  authority. Blocked input writes no output unless explicit diagnostic export
  is requested.
- **Controlled Removal Batch Export Assurance** - verified the public batch
  generator preserves approved review and execution bindings for the later
  controlled-apply confirmation step. Mismatched preflight evidence cannot
  write a batch by default, and blocked diagnostic export remains explicit.
- **Execution-Gate Public Handoff Assurance** - verified the public controlled
  removal batch artifact retains a ready, fingerprint-bound execution gate;
  later apply tooling cannot rely on an unbound readiness claim.
- **Controlled File Apply Containment** - moved the controlled-removal CLI file
  adapter into a tested ESM service and verified mutation in an isolated
  repository. File removal now remains explicitly opt-in, scope-bound to a
  reviewed repo-relative path, and resistant to traversal or absolute paths.
- **Post-Removal Verification Export Assurance** - verified the public
  post-removal exporter preserves applied-review provenance across its
  verification, evidence, and wrapper outputs. Incomplete scans, lingering
  references, and cross-review evidence fail closed unless a blocked diagnostic
  is explicitly requested.
- **Next-Batch Authorization Export Assurance** - verified the public
  next-batch authorization exporter accepts only one coherent runtime-evidence,
  execution-plan, and replayed path-state artifact chain. Unknown paths,
  cross-review or cross-manifest evidence, and already removed paths cannot
  write authorization by default; blocked diagnostics require explicit opt-in.
- **Replay-Verified Storage Closure Checkpoints** - final storage-closure
  decisions now accept only current checkpoint artifacts whose versioned
  fingerprint, provenance, and retained evidence inputs pass deterministic
  replay. Altered, forged, historical, or unreplayable artifacts fail closed;
  public final-readout export writes blocked diagnostics only when explicitly
  requested.
- **Public Current-Closure Audit Assurance** - the storage current-closure
  command is now verified against an isolated mapped checkout and coherent
  completion and validation artifacts. It emits matching audit, checkpoint, and
  final-readout evidence; altered inputs fail closed before output, while
  blocked diagnostics remain explicit.
- **Public Closure Requirement-Audit Assurance** - the final closure command
  now has isolated command-chain verification from current-closure provenance
  through component coverage. Altered current-closure evidence writes no final
  audit by default, and missing component evidence produces diagnostics only
  when explicitly requested.

- **Single Active Native Intent Authority** - repaired and now enforces the
  database invariant that each policy has at most one active native intent.
  Safe historical duplicates are retained as linked inactive history, unsafe
  duplicate groups block migration without mutation, post-upgrade writers lock
  policy authority, and backup restore refuses ambiguous active-intent mapping.
- **Authority-Aware Migration Readiness** - candidate reporting and
  post-upgrade dry-runs now block a policy with ambiguous active native intent
  authority before it can be selected for conversion. The operator-safe result
  reports only the conflict state and active-row count, never native payloads.
- **Native Runtime Authority Integrity** - native policy reads now detect an
  ambiguous active-intent state before selecting a row, block runtime use
  without legacy fallback, and report only bounded conflict diagnostics.
- **Transactional Native-Authority Reversion** - an unexpired, complete
  rollback snapshot can now restore compatibility authority or its direct prior
  native intent atomically. The server rechecks approved action context,
  snapshot integrity, expiry, and authority under row locks; it consumes the
  snapshot and records the reversion without exposing legacy payloads or
  rewriting legacy policy rows.
- **Rollback Snapshot Payload Retention** - expired native-intent rollback
  payloads are now redacted in bounded, transactionally locked batches while
  preserving their restore metadata, source audit reference, digest, and a
  compact migration event. Active policy authority and unexpired recovery data
  are never changed by cleanup.
- **Native Storage Closure Evidence** - the native-policy storage closure audit now requires
  separate proof for active-intent repair, migration eligibility, runtime
  authority selection, transactional reversion, and rollback-payload retention.
  It also rejects outdated compatibility-removal audit artifacts, preventing
  stale or broad parent-component evidence from producing a complete result.
- **Current Compatibility-Removal Evidence** - policy storage closure now
  regenerates completion evidence from the current execution plan, repository
  path state, operational reference scan, and fresh validation results. Older
  plan contracts cannot be rewrapped as current proof, while control-plane
  inventory records no longer create false runtime-reference blockers. The
  public generator now fails closed for blocked regeneration and writes
  diagnostics only through explicit operator allowance.
- **Compatibility-Removal Readiness Diagnostics** - explicit diagnostic mode
  now reports absent current plan, authorization, review, or validation evidence
  as bounded blocked state without creating approval. Normal collection still
  writes nothing for missing inputs, and unreadable supplied artifacts remain
  hard failures.
- **Artifact-Bound Compatibility-Removal Evidence** - compatibility-removal
  regeneration and completion audits now accept only the ready,
  fingerprint-valid execution-plan wrapper that already binds their
  authorization chain. Raw nested plans, altered wrappers, and cross-chain
  substitutions are blocked before they can become closure evidence.
- **Measured Compatibility Deletion Readiness** - compatibility removal plans
  now require a fresh, read-only inventory proving every enabled policy has one
  valid active native intent. Missing, ambiguous, legacy-sourced, pending, or
  invalid authority blocks planning with bounded diagnostics; a supplied zero
  conversion count can no longer bypass the gate.
- **Coherent Compatibility Deletion Evidence** - execution-plan artifacts now
  require one current, side-effect-free evidence bundle that binds enabled-policy
  authority, runtime cutover, deletion gates, and readiness to a bounded
  observation window. Stale, mismatched, invalid, or count-divergent evidence
  cannot be combined into a ready deletion plan.
- **Hardened Compatibility Evidence Collection** - the execution-plan evidence
  command now validates its public input before collection, returns stable
  collected, blocked, or input/output outcomes, redacts dependency failures,
  and reliably closes database resources without changing deletion behavior.
- **Provenance-Bound Embedded Evidence Collection** - embedded-database
  deployments can now collect current compatibility-deletion evidence through a
  noninteractive, revision-matched, read-only helper. The helper has no Docker
  socket or application-data mount, writes only its requested temporary
  evidence output, and blocks before database contact when checkout or image
  provenance is unsafe. Approval and removal remain separate controlled steps.
- **Automatic Verified Local Evidence Builds** - smart local Compose builds now
  derive their image revision from a clean Git checkout rather than requiring a
  manual build argument. The new maintenance rebuild command rejects dirty or
  unverifiable source before Docker work, rebuilds Classifarr without cache,
  recreates it, and waits for health; ordinary dirty development builds remain
  explicitly labeled unverified so evidence collection fails closed.
- **Evidence-Bound Compatibility Deletion Gate** - controlled compatibility
  removal now requires a current, fingerprint-valid execution-plan artifact and
  timestamped preflight evidence bound to that exact artifact. Stale, detached,
  malformed, caller-asserted, or altered serialized readiness can no longer
  authorize deletion.
- **Database-Bound Recovery Evidence** - compatibility deletion now binds the
  existing persisted backup/restore verification result to the exact execution
  plan through a fresh, fingerprinted recovery artifact. Recovery can no longer
  be asserted by an operator boolean; only approval and final support/rollback
  stances remain operator evidence, and controlled batch/apply replay validates
  the same recovery artifact without performing a restore or deletion.
- **Cohesive Compatibility-Removal Reviews** - reviewed removal batches now
  select paths only from one fingerprint-valid execution-plan artifact and
  reject a ready gate bound to any different or altered artifact manifest.
- **Verified Compatibility-Removal Apply Reviews** - the removal apply boundary
  now fingerprints and replays the reviewed artifact, gate, and selected paths
  before adapter execution. Missing, altered, or non-replayable review context
  is blocked before any path can be applied.
- **Review-Bound Post-Removal Verification** - import scans, runtime checks,
  and focused/full validation results now travel in one fingerprint-valid
  evidence artifact bound to the applied removal review. Missing, altered, or
  cross-batch supplied evidence is blocked before another removal batch can be
  authorized.
- **Artifact-Bound Next-Batch Authorization** - next compatibility-removal
  batches now regenerate verification from the fingerprint-valid runtime
  evidence artifact, require the same applied review fingerprint in their
  authorization context, and reject applied paths outside the current approved
  manifest before any remaining path can be authorized.
- **Snapshot-Bound Next-Batch Authorization** - next compatibility-removal
  batches now require a replay-verified checkout snapshot from the exact
  approved execution-plan artifact. Runtime removals must match that snapshot
  exactly; raw plans, altered or cross-artifact snapshots, divergent manifests,
  and mismatched final-audit sources are blocked before a later batch runs.
- **Artifact-Bound Compatibility Removal Completion** - completion audits and
  closure evidence exporters now consume and replay one fingerprint-valid
  next-batch authorization artifact rather than detached authorization and
  verification summaries. Altered, cross-review, cross-manifest, or
  checkout-divergent evidence is blocked before completion can be reported,
  while valid remaining inventory continues through the bounded removal loop.
- **Public Completion-Audit Export Assurance** - the completion-audit command
  now has end-to-end artifact-chain coverage for coherent completion and
  remaining inventory. Altered authorization, a mismatched review context, or
  a final scan reference fails closed without output by default; blocked
  diagnostics require an explicit opt-in.
- **Public Storage Checkpoint Export Assurance** - the storage completion
  checkpoint command now verifies its full evidence chain before writing
  output. Altered removal proof, incomplete roadmap evidence, or altered
  validation artifacts fail closed by default; blocked diagnostics require an
  explicit opt-in.
- **Replay-Verified Storage Closure Evidence** - policy storage closure now
  accepts a completion-audit artifact only when its SHA-256 fingerprint,
  retained authorization and manifest inputs, and deterministic audit replay
  agree. Checkpoint and current-state closure paths no longer unwrap a detached
  completion audit, preventing altered or stale audit summaries from closing
  the storage migration.
- **Replay-Verified Current Closure Audits** - final storage closure now
  requires a fingerprint-valid current-state audit with retained normalized
  evidence and deterministic replay. Altered, stale, or non-replayable closure
  summaries cannot satisfy the final requirement audit. Default-generated
  audits now share one boundary timestamp with nested checkpoint and readout
  artifacts, preserving replay validity.
- **Replay-Verified Closure Validation Evidence** - storage closure validation
  now retains bounded normalized command results under a fixed catalog and
  binds the derived result with SHA-256. Checkpoint and current-closure
  consumers replay the artifact without command execution, rejecting legacy,
  altered, or derived-state-inconsistent validation summaries.
- **Native Policy Authority Guard** - active native-intent policies now reject
  legacy scoring, preset, reset, migration, automatic-preference, and tuning
  mutations atomically, preventing a legacy path from silently replacing or
  diverging durable policy intent.
- **Durable Product Naming Gate** - added a side-effect-free repository
  inventory and regression gate to CI so temporary delivery terminology cannot
  re-enter production modules, commands, or current contracts unnoticed.
- **Product-Language Audit** - added a side-effect-free CI audit across current
  runtime UI and server text, operator commands, public API documentation,
  current release notes, and the Unreleased changelog section. It blocks
  temporary delivery labels while keeping historical records searchable.
- **Delivery-Term Removal Completion Gate** - added a CI boundary that rejects
  delivery terminology and maintenance-parser imports in production source, and
  verifies every remaining compatibility reader has an owner, migration
  condition, required deletion gates, and live deletion-test coverage.
- **Client Build Warning Hygiene** - updated the Vite build toolchain and
  narrowed the temporary VueUse compatibility allowance to its two known
  upstream annotation locations, so unrelated bundler warnings remain visible.

#### Policy Authoring

- **Intent-First Policy Builder** - added a library-centered authoring
  experience that starts with destination meaning, then separates belongs-here
  evidence, hard limits, helpful hints, confidence boosts, avoidance rules,
  review behavior, and routing readiness.
- **Plain-Language Rule Controls** - added dedicated, removable controls for
  identity and helpful genres, rating limits, language requirements, confidence
  boosts, and avoid rules. Each rule explains its operator-facing effect rather
  than exposing raw preset JSON.
- **Accessible Authoring Controls** - added keyboard-reachable option controls,
  removable signal chips, section-level guidance, and focused validation states
  so policy intent can be reviewed and corrected without relying on dense,
  expert-only preset configuration.
- **Library Context and Suggestions** - added observed-library genre
  suggestions, multi-select genre controls, signal provenance, option
  availability diagnostics, and cached-profile freshness so an operator can
  establish a destination from the media server's current collection.
- **Media-Server-Sourced Policy Context** - added an explicit policy-authoring
  path that uses the selected media-server library, its observed collection,
  and its cached profile as the destination context. AI, RAG, and external
  metadata can assist, but cannot silently redefine what a library means.
- **Profile Refresh Feedback** - added in-card refresh actions and explicit
  outcomes for profile collection, including unavailable, stale, empty, and
  successfully refreshed states.
- **Readiness and Review Guidance** - added behavior summaries, section
  completion states, weak-structure warnings, consequences, issue navigation,
  review triggers, and one recommended next action. `Ask When Unsure` is now a
  clear review behavior rather than an unexplained genre conflict.
- **Save and Defer Workflow** - added explicit save readiness, disabled-reason
  messaging, and a defer-without-saving action so incomplete policy work can be
  paused without appearing applied.
- **Policy Save Reliability** - aligned review-trigger drafts with server
  validation, corrected existing-policy save labels, and now keep the form open
  with a clear error when a policy write fails.
- **Optional Starter Templates** - added an accessible template browser and
  detail surface. Templates now provide a starting point and compatibility
  context without hiding or defining the destination's final behavior.
- **Intent Draft Compatibility** - added typed intent drafts, a command
  boundary, a server-owned view, and a legacy serializer. Operators can work in
  the intent model while unchanged legacy preset and custom-signal policies
  retain their existing save behavior.
- **Policy Write Safety** - added a validated policy intent contract, detailed
  read/create/update response parity, and a bounded write preflight so invalid
  native-draft sidecars cannot accompany legacy policy writes.
- **Policy Setup Journey** - added setup-card progress, bounded next actions,
  authoritative reference-data loading, and complete control-state validation
  so an operator can see what remains before a policy is ready to save.
- **Profile-Backed Policy Diagnostics** - added versioned profile-scoring
  diagnostics to History so operators can inspect the rating normalization,
  profile distribution, genre and keyword deltas, and exclusion hits that
  informed a classification without rerunning it against a later profile.
- **Library Profile Repair** - normalized rating distributions as profiles are
  created and read, and added a bounded post-upgrade repair for stale
  non-canonical rating buckets. Upgraded installations can repair affected
  profiles automatically without manual database work.

#### Policy Evidence, Decisions, And Learning

- **Guarded Discord Pending Answers** - Discord clarification answers now pass
  through the authoritative resolver and a bounded learning-admission check.
  Legacy, stale, or fingerprint-drifted questions resolve the current item only;
  selected labels, interaction metadata, and responder details cannot create
  exact-item memory or broad policy evidence. Resolver failures no longer use a
  direct database or pattern-learning fallback.

- **Guarded Manual-Correction Learning** - authenticated classification
  corrections now validate the server-owned destination and media type, record
  the correction outcome, and create exact-item memory only after a bounded
  learning admission passes. One correction can no longer reinforce broad
  metadata patterns automatically; unavailable outcome persistence suppresses
  learning without undoing the correction.

- **Library Evidence Sources** - added bounded, read-only collection of cached
  library profiles, completed outcomes, manual corrections, resolved pending
  decisions, routing outcomes, and normalized metadata. Each source has a
  declared role and cannot execute a provider call, refresh, route, or write
  while policy meaning is being established.
- **Canonical Evidence Envelope** - added a single library-destination evidence
  envelope that combines those sources only after their collection contracts
  pass, reports truncation and blocked states without raw error text, and keeps
  observations separate from authority.
- **Canonical Policy Evidence** - added bounded collectors for library
  profiles, metadata, final classification outcomes, pending answers, and
  routing outcomes. They produce one canonical projection for identity,
  compatibility, limits, avoidance, freshness, routing, and insufficient
  evidence.
- **Evidence Identity and Ordering** - added deterministic source ordering,
  deduplication, bucket ownership checks, and contribution limits so repeated
  observations or unordered source records cannot change a policy conclusion.
- **Evidence Provenance and Quality** - added source-authority validation,
  canonical ordering, deduplication, contribution rules, verified handoffs,
  fingerprints, and input-cardinality limits. Untrusted provider payloads
  cannot acquire policy authority merely by appearing in a collection.
- **Profile Evidence Safeguards** - added freshness re-evaluation, normalized
  profile distributions, and review-only absence handling. A stale, unknown,
  or profile-only signal can assist compatibility but cannot define identity or
  exclusion behavior.
- **Outcome and Resolution Safeguards** - added final-outcome normalization and
  resolved-answer collection that retain only bounded state and timestamps;
  item titles, raw answers, actor identities, provider payloads, and database
  errors are excluded from the policy evidence path.
- **Verified Intent Proposals** - added short-lived, actor-bound proposal
  references that snapshot the reviewed evidence and exact fingerprint. A
  proposal can be consumed once and cannot expose stored evidence or perform
  persistence, learning, routing, provider, or refresh work by itself.
- **Policy Decision Lineage** - added bounded, server-owned intent, readiness,
  workflow, migration, and completion handoffs. Each consumer revalidates the
  source it relies on, preventing stale, substituted, or altered decisions from
  being promoted through the policy workflow.
- **Intent and Automation Readiness** - added deterministic intent inference,
  final-outcome versus learning separation, learning eligibility, evidence
  quality assessment, automation readiness, and an operator workflow with
  bounded next actions.
- **Runtime Automation Decisions** - added request-time evidence projection and
  a server-owned decision contract that binds every outcome to its permitted
  action, reason codes, permissions, and trace data before persistence or media
  routing may proceed.
- **Runtime Evidence Traces and Metrics** - added bounded runtime evidence
  traces, source fingerprints, decision metrics, and completion audits. The
  application can now prove which accepted inputs supported an automated
  outcome without retaining uncontrolled source payloads.
- **Destination-Focused Clarification** - added normalized question reduction
  that asks only for information required to select or review a destination,
  rather than asking operators to resolve arbitrary genre conflicts.
- **Guarded Request-Time Learning** - added bounded learning from media
  requests and manual decisions while keeping final classification success
  distinct from a successfully routed item. Learning evidence cannot become
  policy authority without the required outcome and provenance checks.
- **Bounded Request/Import Route Outcomes** - request-origin classification
  tasks now record successful Arr routes and missing mappings as outcome-only
  admission results. Request payloads cannot imply a requester destination or
  create policy evidence, and webhook history now retains the normalized routed
  library name.
- **Native Classification Decision Handoff** - authoritative native
  classifications now supply a validated, side-effect-free runtime
  question-reduction plan derived only from the selected native destination,
  persisted library profile, and stored route mapping. Legacy, malformed, and
  mismatched results remain outcome-only; the handoff cannot use raw request,
  AI, provider, or media-path data, perform routing, or create learning.
- **Native Pending-Question Admission** - native review plans now become
  pending classifications only through the established classification
  persistence and notification flow. Admission re-audits and re-derives the
  plan, preserves existing questions, stops automatic routing until resolution,
  and keeps browser and Discord answers outcome-only even when a legacy caller
  requests rule generation.
- **Explicit Native Pending Decisions** - native review items now present only
  their two outcome actions, an explicit browser alternate-destination choice,
  and retry. The Command Center no longer renders generic duplicate controls or
  bulk-confirms native reviews, and Discord uses matching action labels while
  directing alternate destinations back to the authoritative web workflow.
- **Auditable Native Pending Resolutions** - native pending-item confirmation,
  do-not-learn, and alternate-destination choices now produce a bounded
  request-time transition before final classification resolution and any later
  routing. The shared resolver validates the persisted question and selection,
  keeps every current outcome guarded and outcome-only, rejects malformed native
  selections safely, and no longer maintains a duplicate Discord-only learning
  path.
- **Auditable Native Pending Route Outcomes** - browser and Discord now append
  a separate, guarded route transition only after an actual Arr success or a
  confirmed missing mapping. Completion and transient routing failures remain
  distinct operational states, and route outcomes cannot write policy evidence
  or queue profile refresh work.
- **Native Pending Completion Coverage** - runtime completion and test-reset
  audits now require documented, focused ESM ownership for native pending
  selection, route outcome, and route outcome persistence boundaries. Missing
  artifacts fail closed, while the audited transitions remain outcome-only and
  cannot create learning or change routing behavior.
- **Question and Learning Controls** - added deterministic question reduction,
  permitted-action checks, answer-shape validation, and learning eligibility
  checks so automation asks only destination-relevant questions and manual
  resolutions do not create unreviewed policy rules.
- **Library Rebuild Proposals** - added read-only proposals derived from
  observed library behavior, verified cached profiles, operator intent,
  constraints, routing context, and guarded classification outcomes. Raw
  profile, freshness, absence, and learning payloads are rejected at the
  proposal boundary.
- **Verified Rebuild Acceptance** - added a time-bounded manual acceptance
  transition that fingerprints the reviewed proposal and same-policy rollback
  plan before migration comparison. Raw approval booleans and unbound rollback
  objects cannot authorize comparison or replacement.
- **Migration Comparison and Rollback Planning** - added bounded sample-set
  provenance, comparison, operator-acceptance requirements, and rollback-window
  planning. Policy replacement remains separate from normal authoring.
- **Persisted Rebuild Rollback Evidence** - added an atomic, one-time execution
  gate that revalidates accepted rebuilds, locks the current policy and native
  intent, stores the authoritative rollback snapshot and audit event, and
  prevents duplicate snapshot writes for replayed, expired, stale, or
  competing requests. It does not replace policy behavior.
- **Verified Native Rebuild Replacement** - added a transaction-gated native
  intent replacement path that requires the persisted rollback snapshot and a
  matching no-difference verifier report. It records terminal replacement
  evidence, returns idempotent retries without another write, preserves legacy
  rows, and rejects label-only strict constraints rather than guessing policy
  semantics.
- **Current-Policy Rebuild Protection** - rebuild approval, migration
  comparison, and execution now revalidate the policy, evidence, accepted
  proposal, sample set, and rollback context at each handoff. Stale, replayed,
  substituted, or concurrently modified rebuild requests are blocked instead
  of changing a policy on incomplete proof.
- **Structured Rebuild Strict Constraints** - rebuild proposals now preserve
  validated operator, values, mode, and semantics for deliberately authored
  strict rules. Replacement converts those descriptors directly to native hard
  limits while keeping label-only or malformed constraints blocked.
- **Runtime and Rebuild Completion Gate** - added a server-owned audit that
  verifies the current docs, services, focused direct-import tests, local
  contracts, and required handoffs for runtime evidence, automation,
  clarification, learning, rebuild acceptance, rollback snapshots, native
  replacement, structured hard limits, and metrics before storage work can
  advance.

#### Native Policy Intent Storage

- **Native Intent Schema Contract** - added a versioned native storage contract
  for intent headers, executable rules, routing references, template
  provenance, validation state, migration events, and time-bounded rollback
  snapshots. It keeps UI drafts, provider payloads, prompts, embeddings, and
  diagnostic traces outside durable policy storage.
- **Migration Candidate Reporting** - added dry-run classification of policies
  as ready, review-required, partial, or unsupported before any conversion
  action. Candidate reports redact raw legacy configuration and expose only
  bounded operator reasons and deletion-impact estimates.
- **Explicit Conversion Planning** - added a server-owned conversion workflow
  that binds a ready candidate, approved actor source, migration evidence, and
  rollback plan through an idempotency key before it can plan a native record.
- **Native Runtime Read Verification** - added runtime admission checks for the
  active native intent, its validation status, storage state, and matching
  migration evidence so classification cannot silently rely on stale or
  incomplete conversion data.
- **Rollback Window Management** - added expiring rollback snapshot contracts
  and restore eligibility checks, keeping a recoverable legacy state during the
  supported window without treating it as a permanent second policy model.
- **Legacy Write Controls** - added explicit compatibility-write boundaries and
  deletion readiness checks so old preset/custom-signal paths remain available
  only while the corresponding native conversion and rollback obligations are
  still open.
- **Operational Conversion Safeguards** - added backup/restore wiring,
  post-upgrade dry-run and apply gates, transaction-aware migration checks, and
  SQL migration coverage for a controlled storage transition.
- **Storage Closure Evidence** - added current-evidence collection, validation
  records, completion checkpoints, final readouts, and requirement audits so
  storage readiness is proved from live repository and schema artifacts rather
  than narrative alone.
- **Environment-Agnostic Storage Readiness** - storage evidence now reports
  repository implementation readiness separately from an active installation's
  compatibility-removal cutover state. Local policy inventory can still block
  destructive removal, but it can no longer make a complete source
  implementation appear unfinished.
- **Compatibility-Removal Controls** - added bounded deletion plans, execution
  gates, selected-batch manifests, post-removal verification, and next-batch
  authorization so retirement of replaced compatibility paths remains explicit
  and reversible until its acceptance criteria are met.

#### Classification And RAG Observability

- **RAG Evidence Snapshots** - added bounded, sanitized first- and second-pass
  RAG neighbor evidence and per-library match counts to classification history,
  allowing operators to diagnose a classification without direct database
  inspection.
- **Decision Trace Correlation** - added W3C-compatible decision trace context
  to classification outcomes, RAG traces, stage logs, and History details.
- **Decision Trace Stage Timing** - added bounded child spans for targeted
  re-check stages with parent relationships, durations, outcomes, reason codes,
  and sanitized scalar attributes before introducing any full telemetry
  exporter.
- **Stable Classification Progress** - standardized persisted progress,
  WebSocket events, RAG-loop stages, parser diagnostics, resume diagnostics,
  and queue history around durable stage names and bounded trace metadata.
- **Outcome and Signal Separation** - added distinct final-outcome and original
  signal-snapshot views in History so diagnostic evidence is not confused with
  the final classification result.
- **RAG Evidence Quality Gating** - added deterministic quality scoring that
  demotes neighbors without a trusted final outcome, known library identity, or
  compatible profile evidence.
- **Policy Candidate Calibration** - added bounded calibration and diagnostics
  so weak profile-only, compatibility-only, or RAG-only candidates cannot
  outrank stronger identity and multi-source evidence on raw score alone.
- **Strict Constraint Semantics** - added strict runtime evaluation for
  configured genres, keywords, studios, languages, media type, certifications,
  release year, vote average, and runtime while preserving advisory scoring by
  default.
- **RAG Retrieval Recall Audit** - added an admin-only, bounded comparison of
  approximate HNSW retrieval against exact search to measure recall without
  changing classification behavior.
- **Canonical History Lifecycles** - consolidated Classification History to
  one final outcome per media identity while retaining the full lifecycle of
  retries, rechecks, manual resolutions, and source-library observations for
  inspection.
- **Embedding Contention Resilience** - made temporary embedding-provider lock
  contention a controlled degraded-search result instead of a classification
  failure; configured hard failures still propagate when requested.
- **Reasoning-Model Support** - added local-model detection and parsing paths
  for Ollama reasoning models so their thinking output does not conflict with
  constrained JSON generation, along with longer bounded first-token and
  streaming budgets for legitimate cold or reasoning-heavy responses.

#### Web Search Providers

- **Provider-Neutral Search Configuration** - added shared configuration,
  encrypted-secret handling, result normalization, contract validation, and
  failure classification for Tavily, Brave Search, and Serper.
- **Safe Provider Settings** - added an operator settings surface that manages
  provider configuration, secure key updates, connectivity checks, priority,
  purpose coverage, usage, route diagnostics, retention, and calibration
  controls without returning credentials to the browser.
- **Brave and Serper Activation** - activated Brave Search and Serper alongside
  Tavily through capability-gated adapters, letting operators distribute query
  volume across configured providers.
- **Tavily Router Modernization** - moved legacy Tavily enrichment and retry
  work through the provider router, preserving safe fallback when a provider is
  unavailable, cooling down, or has exhausted its configured allowance.
- **Provider Contract and Result Safety** - added URL filtering, HTML and
  control-character cleanup, canonical rank/score/date handling, bounded field
  normalization, provenance-preserving deduplication, and sanitized warnings
  for corrected or dropped provider data.
- **Provider Error Taxonomy** - added shared handling for authentication,
  quota, rate-limit, invalid-request, timeout, network, SSL, provider, and
  malformed-response failures with sanitized retry metadata and `Retry-After`
  parsing.
- **Quota-Aware Provider Selection** - added daily and monthly allowance
  policies, cooldown handling, purpose-aware selection, and deterministic
  reasons for selected and skipped providers.
- **Usage Accounting and Cache** - added normalized result caching, request
  reuse, per-request usage accounting, cache-hit diagnostics, and bounded
  cleanup so repeated searches do not unnecessarily consume provider allowance.
- **Independent Data Retention** - added separately configurable retention for
  usage, cached results, route decisions, and provider health records rather
  than applying one deletion policy to unrelated operational evidence.
- **Route Decision History** - added sanitized decision history that records
  purpose, candidate set, selected or skipped provider, fallback reason, and
  retained route outcome without storing API keys or raw response bodies.
- **Provider Health and Cooldown History** - added bounded health/cooldown
  events and settings diagnostics that explain why a provider is available,
  cooling down, reused, or skipped.
- **Purpose-Specific Quality Controls** - added outcome feedback, per-purpose
  calibration policies, coverage reporting, and side-effect-free previews so an
  operator can review an adjustment before it affects provider ordering.
- **Calibration Guardrails and Analytics** - added configurable thresholds,
  bounded guardrail events, analytics, and a rate-limited digest for review
  when provider behavior falls outside the configured safety envelope.
- **Fresh-Install Provider Parity** - reconciled provider configuration and
  retention seed data so new and upgraded installations receive compatible
  Tavily, Brave Search, and Serper rows while migrated Tavily settings remain
  intact.
- **Provider Operational Feedback** - added bounded health, cooldown, quota,
  cache, route-decision, and calibration feedback so settings diagnostics can
  explain why a provider was chosen, skipped, reused, or held back.

#### Notifications And Setup

- **Discord Pending-Decision Notifications** - added duplicate-safe alerts for
  items awaiting a decision, structured response buttons, optional `@here`, and
  server-scoped role or user mentions constrained through Discord allowed
  mentions.
- **Simplified Radarr and Sonarr Setup** - added shared setup behavior so a
  successful connection test saves the connection, exposes library mappings,
  reports root-folder and quality-profile counts, and supports removal of every
  configured instance when needed.

#### Media Server Operations

- **Live Enrichment-State Sync** - added immediate media-server status updates
  when enrichment work is queued, cancelled, retried, or dismissed so library
  counts and item state stay current without waiting for another full sync.
- **Rating Normalization Maintenance** - added mutually exclusive status
  counts, metadata-aware reprioritization, and safe re-queueing when new OMDb
  or TMDB ratings arrive, so normalization reflects current source data.
- **Shared Arr Configuration Flow** - unified Radarr and Sonarr connection
  state, testing, save behavior, and setup transitions in the client so both
  integrations follow the same predictable configuration experience.

#### Deployment and Fresh-Install Reliability

- **Schema Snapshot Integrity** - added a migration check that verifies the
  required pgvector HNSW indexes in the schema snapshot, preventing a stale
  snapshot from producing a degraded RAG installation.
- **Container Vector Runtime Resilience** - hardened PostgreSQL startup on
  hosts that cannot load the optimized staged pgvector binary. The container
  safely links to an immutable image-layer optimized binary when possible and
  falls back to the generic image-layer binary without a restart loop.
- **Docker Startup Readiness** - extended the container health-check start
  period for fresh schema loads, PostgreSQL upgrades, and slower storage
  environments while keeping the hardened runtime mount configuration.
- **Fresh-Install and Upgrade Coverage** - added migration and post-upgrade
  checks for native policy intent, web-search provider operations, Discord
  notification settings, rating-profile repair, and rebuild execution state so
  both a new database and an existing installation reach the same supported
  runtime shape.

### Changed

- **Installation-Derived Native Runtime Evidence** - compatibility-deletion
  maintenance evidence now verifies every enabled policy's persisted native or
  compatibility runtime read within one read-only repeatable-read snapshot.
  Operator input can no longer manufacture converted or unconverted policy
  samples, and the bounded report omits policy names and raw payloads.
- **Database-Owned Native Rollback Evidence** - native runtime cutover now
  derives recovery availability from the current rollback snapshot linked to
  each active authoritative native intent. Caller-supplied rollback, deletion,
  and support safety claims are ignored; output remains bounded and omits
  snapshot payloads, names, and paths while compatibility-code deletion stays
  fail-closed pending its separate release evidence.
- **Database-Owned Backup/Restore Evidence** - compatibility-deletion
  readiness now accepts recovery proof only from a fresh, validated restore
  record that matches the current native restore gate. Successful restores
  persist only bounded status facts; archive paths, filenames, payloads,
  credentials, and caller-supplied recovery booleans cannot make deletion
  readiness pass.
- **Policy Authoring Model** - routine policy work now prioritizes destination
  meaning, observed library evidence, constraints, review behavior, and routing
  readiness. Scoring, provider state, metadata coverage, and migration analysis
  are no longer normal editing prerequisites.
- **Media Server Authority** - existing library behavior and the media-server
  destination are treated as primary context for intent, while AI and external
  evidence remain bounded inputs rather than policy authority.
- **Policy Data Boundaries** - policy inputs now accept only bounded plain
  own-data records with known source and authority pairs. Inherited values,
  accessors, prototype-pollution keys, stale handoffs, substituted decision
  sources, and altered fingerprints are rejected.
- **Runtime Trace Integrity** - automation, clarification, and learning outputs
  are recomputed from authoritative evidence. Altered actions, dispositions,
  learning metadata, reasons, counts, and trace attributes cannot be trusted by
  downstream persistence.
- **Migration Safety** - migration and compatibility-removal paths require
  validated evidence, intent, workflow, readiness, decision-source, and
  rollback handoffs. Routine authoring remains separate from comparison and
  policy replacement.
- **Tavily Modernization** - Tavily now runs through the same provider contract,
  router, error taxonomy, quota policy, usage accounting, and diagnostics as
  the other web search providers.
- **Classification Stage Contracts** - progress persistence, WebSocket events,
  queue history, RAG-loop stages, parse diagnostics, resume diagnostics, and
  metrics now use stable stage-oriented contracts with bounded trace metadata.
- **Classification and Enrichment State** - classification history now
  distinguishes final outcomes from intermediate evidence, while enrichment
  queue actions synchronize their media-server state immediately.
- **Rating and Profile Consistency** - rating normalization uses canonical
  values across profile generation, scoring, queue priority, and refreshed
  source metadata to avoid stale or double-counted library state.
- **Product Vocabulary** - production modules, diagnostics, telemetry, and
  progress storage use product-domain terms rather than internal delivery
  labels, with regression checks against reintroducing temporary terminology.
- **Dependency and Workflow Maintenance** - refreshed audited server and client
  dependencies, lockfiles, development tooling, and pinned GitHub Actions to
  compatible patched releases.

### Removed

- **Retired Authoring Diagnostics** - removed normal policy-authoring impact,
  replay, parity, provider-readiness, metadata-coverage, and raw-scoring
  surfaces. Migration verification remains bounded, side-effect-free, and
  separate from policy editing.

### Security

- **Resolved Workspace Dependency Alerts** - refreshed the root, client, and
  server dependency graphs to remediate the reported Dependabot alerts and a
  newly disclosed YAML parsing issue. Patched Markdown tooling, YAML parsing,
  link detection, glob expansion, Engine.IO, and body parsing dependencies are
  now pinned through their owning workspace lockfile and verified with clean
  package-lock audits.

- **Policy Authority Enforcement** - policy evidence, intent commands,
  readiness decisions, clarification answers, learning traces, and rebuild
  requests now accept only bounded plain data from declared, permitted sources.
  Inherited values, accessors, prototype-pollution keys, altered fingerprints,
  and unknown fields are rejected at their owning boundary.
- **Rebuild Execution Integrity** - rebuild replacement requires a current
  accepted proposal, a matching rollback snapshot, explicit database locking,
  and terminal audit evidence. Retried requests return the recorded result
  rather than applying another policy write.
- **Secret, Result, and Mention Boundaries** - provider credentials remain
  masked in read models, normalized provider results are sanitized before
  persistence or display, and Discord mentions are constrained through
  allowed-mentions rules and selected server-scoped targets.

### Fixed

- **Cross-Platform Audit Reliability** - policy storage closure audits now
  finish writing their structured JSON before exiting, and static-import
  quality checks preserve the inspected Windows or POSIX path semantics on any
  CI host. Large audit artifacts no longer truncate on Linux runners.
- **Server Dependency Quality Gates** - restored CI validation by removing
  unused server exports and obsolete service singletons, moving root-script
  CLI lifecycle helpers into the root script boundary, and separating complete
  source reachability checks from production dependency checks.
- **Native Intent Conversion Rate Limit** - conversion previews no longer
  consume the protected apply-attempt budget. Administrators can inspect or
  refresh eligibility without blocking a confirmed conversion, while the
  write endpoint remains independently rate limited and now shows its
  server-provided retry message.
- **Policy Storage Completion Audit** - replaced dynamic roadmap-label regular
  expression construction with a bounded line parser, preserving deterministic
  completion checks while removing the remaining static-analysis warning.
- **Policy Storage Closure Validation** - fixed direct Node and Windows
  validation evidence generation by resolving npm and npx through a shell-free
  JavaScript CLI invocation instead of relying on a platform command launcher.
- **Fresh-Install RAG Indexes** - restored the missing text HNSW index in the
  schema snapshot and added an integrity guard so fresh installations do not
  start with a degraded RAG health state.
- **Container Database Startup** - fixed the PostgreSQL/pgvector startup path
  for optimized runtime binaries and an ambiguous PostgreSQL 18 BIGINT-array
  migration expression, preventing affected Docker installations from cycling
  during startup.
- **Initial Account Setup** - prevented authenticated health polling and
  expired-session redirects from interrupting the first-admin setup flow.
- **Ollama Availability Handling** - increased the default cold-start probe
  timeout and treat missing provider or model responses as controlled AI
  availability failures instead of hard classification errors.
- **Media Server Library Removal** - safely closes completed classification
  history before deleting a removed media-server library, avoiding foreign-key
  failures during synchronization.
- **Media Server Setup Actions** - corrected the Configure Media Server route
  and enabled Connect & Save for valid loaded configurations, including setup
  wizard steps.
- **Rating Normalization Loops** - prevented source-sync updates from creating
  a normalization ping-pong loop and corrected overlapping normalization
  counts; stale normalized ratings can now be refreshed from new metadata.
- **RAG Library Identity Resolution** - resolved RAG neighbor library names
  from live library records when historical denormalized names are missing, with
  stable fallbacks in trace sanitization, AI context, and History details.
- **Policy Evidence Anchoring** - prevented hard profile exclusions and weak
  RAG-only, profile-only, or broad compatibility signals from becoming primary
  policy anchors or second-pass adoption targets.
- **pgvector Retrieval Recall** - centralized HNSW recall controls, expanded
  bounded candidate windows, enabled query-local iterative scans, and preserved
  index eligibility through direct vector-distance ordering.

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
