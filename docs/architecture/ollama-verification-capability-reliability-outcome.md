# Ollama Verification Capability Reliability Outcome

## Status

Implemented on 2026-08-29 for the unreleased next commit. No release is
created by this work.

## Delivered Outcome

The saved local Ollama configuration can now be re-tested using Ollama's
documented generation-request shape. A successful test reports that strict
candidate verification is ready. A completed but unsuccessful test now remains
visibly `classification_only` or `unavailable`, and the toast explains that
strict AI was not admitted.

This resolves the contradictory combination of a completed timestamp with the
message “has not been tested.” It does not weaken policy authority: a result
that is not `verification_ready` still cannot invoke AI during strict
candidate-bound verification.

## Implementation

- Added `server/src/services/ollamaGenerateRequest.mjs`, an ESM provider-payload
  builder shared by streaming and non-streaming generation.
- Moved `temperature` to `options.temperature`; structured requests use
  `options.temperature: 0` while retaining the server-owned JSON Schema in
  `format`.
- Preserved current `classification_only` and `unavailable` capability states
  in the server presentation path without granting authority.
- Added a small client feedback adapter that returns a success toast only for
  `verification_ready`; all other outcomes are fixed, safe warning messages.
- Added unit and view coverage for the request shape, non-authorizing state
  retention, ready feedback, and completed-but-ineligible feedback.

## Security Outcome

- No browser input determines the endpoint, model, schema, or verdict for the
  capability probe.
- The client continues to receive only fixed status IDs and server-authored
  presentation text; it does not receive raw provider responses or connection
  details.
- The server grants strict authority only to a current, primary,
  digest-bound `verification_ready` result.
- `classification_only`, `unavailable`, stale, changed, malformed, and missing
  results remain fail-closed.

## Validation

- Full server unit suite: **869 suites / 25,203 tests passed**.
- Focused server coverage: **4 suites / 62 tests passed**, including the
  schema-and-digest streaming assertion updated for `options.temperature`.
- Focused client coverage: **2 files / 27 tests passed**, including ready and
  completed-but-ineligible capability feedback.
- Server `tsc`, client `vue-tsc`, both lint commands, and the production Vite
  build passed.
- A final security diff review is required before commit; its result is recorded
  in the commit handoff.

The local `gemma4:e4b` fixed-schema probe was exercised only with a media-free
request; no media was routed or persisted by the diagnostic.

## Operator Outcome

1. Open **AI Settings → Candidate-Bound Verification**.
2. Select **Test Ollama Verification**.
3. If the result says **Ollama verification is ready**, retry a pending
   confirmation item; strict candidate verification can call the saved primary
   Ollama model.
4. If it says **classification-only** or **unavailable**, ordinary AI
   classification can still work, but strict candidate verification will not
   call AI. Confirm the saved model is installed and re-test after this update.

## Next Item

Add an operator-facing, aggregate-only record of strict-capability probe
outcomes over time. This would distinguish intermittent local model failures
from a persistent schema-contract incompatibility without retaining prompt,
response, media, or endpoint data.
