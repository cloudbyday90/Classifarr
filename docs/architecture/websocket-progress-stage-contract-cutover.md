# WebSocket Progress Stage Contract Cutover

## Status

Implemented July 11, 2026.

## Intent

Classification progress WebSocket events must have one stable lifecycle field:
`stage`. The broadcast service previously used a phase-only fallback for debug
logging even though the sole internal producer already emits `stage`. Retaining
that fallback allowed a malformed retired payload to be broadcast and kept
temporary delivery vocabulary in a runtime boundary.

## Boundary Audit

- `classificationProgressStageService.mjs` is the only production caller of
  `webSocketService.emitTaskProgress`.
- It builds every event through the durable stage-progress event builder.
- No client WebSocket progress listener accepts a retired field.
- The only phase-only payload was a unit test for the now-obsolete fallback.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends descriptive, unambiguous stable names. `stage` describes a
  lifecycle position; delivery terminology does not.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  supports explicit, risk-based controls at API boundaries. Rejecting malformed
  internal event payloads prevents ambiguous broadcast contracts.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verification of implementation requirements. Focused producer and
  boundary tests prove that valid stage events remain broadcast.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep the fallback | No immediate caller change | Accepts ambiguous payloads and retains naming debt | Rejected |
| Translate a retired field to `stage` | Preserves old callers | Hides malformed producers and creates compatibility debt | Rejected |
| Reject events without a stage | One explicit runtime contract and bounded diagnostics | Invalid ad hoc events are not broadcast | Selected |

## Final Recommendation Stack

1. Require a non-empty string `stage` at the WebSocket progress boundary.
2. Log and skip malformed stage-less progress events.
3. Keep `classificationProgressStageService` as the sole durable producer.
4. Test both valid emission and retired-payload rejection.

## Implementation

- Removed the phase-only logging fallback in `webSocketService.mjs`.
- Added a stage guard before any classification progress broadcast.
- Updated the WebSocket service test to prove phase-only progress is rejected.
- Ratcheted the naming regression baseline from `11/12` to `10/11`.

## Security Outcome

- Classification progress broadcasts use one explicit event shape.
- Invalid lifecycle data is not delivered to task or activity subscribers.
- The service performs no additional storage, command, Git, or network action
  beyond the existing WebSocket broadcast for valid events.

## Verification

- WebSocket and classification progress producer tests pass.
- The production naming inventory validates with no unclassified references.
- The regression audit accepts only the reduced baseline.

## Next Step

Replace the remaining policy-authoring workflow messages that describe their
own phase-based naming restriction with direct durable-policy language.
