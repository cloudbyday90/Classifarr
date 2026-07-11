# Classification Progress Stage Contract Cutover

## Status

Implemented as the first contract and telemetry naming cutover batch. The
later stage-storage cutover removed the temporary phase aliases and renamed the
persisted task queue fields.

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

Those names were externally visible to the client and potentially to operators
or integrations. They were replaced after all in-repository consumers moved to
the durable stage contract and the task queue storage migration could preserve
existing progress data.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends risk-based, outcome-oriented secure development work. This
  contract cutover is additive, tested, and keeps compatibility until callers
  are migrated.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  emphasize stable semantic names for telemetry. The completed storage cutover
  emits only durable stage names for progress events.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces that public identifiers should be chosen carefully and kept stable.
  The cutover therefore adds durable stage fields before removing old phase
  fields.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  is used as a verification baseline for preserving existing application
  controls. This change does not alter authentication, authorization, storage
  queries, or queue mutation behavior.

## Recommendations

1. **Use durable contracts after a complete migration.**
   API responses and WebSocket events expose stage fields only.

2. **Keep lifecycle naming centralized.**
   `classificationProgressStageContract.mjs` owns the stage-only API and event
   shape so lifecycle terminology cannot leak across unrelated services.

3. **Use stage-only reads.**
   Command Center processing UI consumes `currentStage`, `stageIndex`,
   `totalStages`, and `stages` without legacy fallbacks.

4. **Rename storage transactionally.**
   The task queue now uses `current_stage`, `stage_index`, `stage_started_at`,
   and `stage_history`; the migration also converts history-entry keys.

5. **Do not retain aliases without a caller.**
   The storage migration preserves progress data, so phase aliases are removed
   instead of becoming permanent compatibility debt.

## Pros And Cons

Pros:

- All progress storage, API, event, and client fields use one durable term.
- Existing stored task progress survives the in-place column and JSON migration.
- WebSocket telemetry carries stable stage fields without duplicate aliases.
- Focused API, service, integration, and UI tests enforce the new contract.

Cons:

- External beta clients using retired fields must update to the stage contract.

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

No legacy phase aliases remain in progress responses, WebSocket events, or
client processing helpers. Operator UI and storage use stage terminology.

The production naming inventory validates after this batch and reports:

- total phase-coded references: 15,892,
- production references: 7,467,
- rename candidates: 7,489,
- docs/history references: 3,260,
- test or migration evidence references: 5,050,
- obsolete migration tooling references: 93.

## Follow-Up

The completed storage outcome is documented in
[Classification Progress Stage Storage Cutover](classification-progress-stage-storage-cutover.md).
