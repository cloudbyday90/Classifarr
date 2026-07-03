# Classification Progress Stage Contract Cutover

## Status

Implemented as the first Phase 9R.3 contract and telemetry naming cutover
batch.

## Problem

The Phase 9R.2 module cutover renamed classification progress implementation
files to stage terminology, but the public progress contract still exposed only
phase-shaped fields:

- `currentPhase`,
- `phaseIndex`,
- `totalPhases`,
- `phaseStartedAt`,
- `phaseDuration`,
- `phases`,
- `phaseMetadata`,
- WebSocket `phase`.

Those names are externally visible to the client and potentially to operators
or integrations. They cannot be removed in one step without breaking existing
clients, but new code should not depend on them as the primary product
language.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends risk-based, outcome-oriented secure development work. This
  contract cutover is additive, tested, and keeps compatibility until callers
  are migrated.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  emphasize stable semantic names for telemetry. Stage terms are now emitted
  as the durable progress event names while legacy phase aliases remain.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces that public identifiers should be chosen carefully and kept stable.
  The cutover therefore adds durable stage fields before removing old phase
  fields.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  is used as a verification baseline for preserving existing application
  controls. This change does not alter authentication, authorization, storage
  queries, or queue mutation behavior.

## Recommendations

1. **Use additive contracts first.**
   API responses and WebSocket events now include stage-first fields while
   retaining legacy phase aliases.

2. **Centralize aliasing.**
   `classificationProgressStageContract.mjs` owns the stage-to-phase alias map
   so compatibility does not leak across unrelated services.

3. **Move clients to stage-first reads.**
   Command Center processing UI now consumes `currentStage`, `stageIndex`,
   `totalStages`, and `stages`, falling back to legacy fields only when needed.

4. **Do not rename storage in this batch.**
   Database columns `current_phase`, `phase_index`, `phase_started_at`, and
   `phase_history` remain unchanged until a storage migration can be planned and
   rollback-tested.

5. **Defer alias deletion to a later gate.**
   Phase aliases should remain until compatibility coverage proves no current
   client or persisted event reader depends on them.

## Pros And Cons

Pros:

- New code can use durable stage terminology immediately.
- Existing clients and stored task progress remain compatible.
- WebSocket telemetry now carries stable stage fields.
- Compatibility is testable through one mapper and focused API/UI tests.

Cons:

- Payloads are temporarily wider because both stage and phase names are present.
- Database column names still contain phase terminology.
- Compatibility aliases must be tracked so they do not become permanent
  unnoticed debt.

## Final Recommendation Stack

- Contract mapper:
  `server/src/services/classificationProgressStageContract.mjs`
- Server stage contract emitters:
  - `classificationProgressStageQueries.mjs`
  - `classificationProgressStageService.mjs`
  - `webSocketService.mjs`
- Client stage-first readers:
  - `client/src/composables/useProcessingDetails.js`
  - `client/src/components/command-center/ProcessingPanel.vue`
  - `client/src/components/command-center/ProcessingDetailsSheet.vue`
  - `client/src/views/CommandCenter.vue`
- Focused validation:
  - `classificationProgressStageContract.test.mjs`
  - `classificationProgressStageService.test.mjs`
  - classification progress route and lifecycle tests
  - Command Center processing tests

## Outcome

Classification progress API responses now include:

- `currentStage`,
- `stageIndex`,
- `totalStages`,
- `stageStartedAt`,
- `stageDuration`,
- `stages`,
- `stageMetadata`.

WebSocket progress events now include:

- `stage`,
- `stageIndex`,
- `totalStages`.

Legacy phase aliases remain in the same payloads for compatibility. Operator UI
copy now says stage instead of phase, and client processing helpers prefer the
stage contract while retaining fallback reads for older payloads.

The production naming inventory validates after this batch and reports:

- total phase-coded references: 15,892,
- production references: 7,467,
- rename candidates: 7,489,
- docs/history references: 3,260,
- test or migration evidence references: 5,050,
- obsolete migration tooling references: 93.

## Remaining Work

The next compatible cutover should decide whether task queue storage columns
can remain as historical implementation detail or should be migrated to
stage-named columns with compatibility views/readers:

- `current_phase`,
- `phase_index`,
- `phase_started_at`,
- `phase_history`.
