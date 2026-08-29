# Aggregate Ollama Verification-Test Outcome History — Outcome

## Delivered behavior

Classifarr now records a bounded, aggregate-only trend whenever a saved primary Ollama verification test completes and its current capability state is successfully persisted.

- The database keeps one counter per UTC day for three fixed outcomes only: strict verification ready, classification only, and provider unavailable.
- Recording prunes data older than 30 days.
- AI Settings displays the aggregate and a plain-language trend signal. It updates after a successful manual test and can be refreshed manually.
- The trend remains advisory: the current saved verification capability continues to be the only state that admits strict candidate-bound verification.
- The dedicated `/api/stats/ollama-verification-capability-outcomes` endpoint is parameter-free, administrator-only, and separately rate-limited.

## Explicit exclusions

The implementation does not store or return the Ollama host, port, model, model digest, configuration revision/fingerprint, credentials, prompt, model output, raw error, media item, library, policy, routing decision, actor, or per-test record. It therefore cannot be used to inspect a historical configuration or reconstruct individual model calls.

If aggregate persistence fails, the completed test result is still returned and the strict-verification authority is unchanged. The server emits only a fixed operational failure code through its existing logger.

## Validation scope

Automated coverage verifies:

- fixed status allow-listing and rejection of invalid values;
- daily upsert/pruning SQL without caller-controlled timestamps or dimensions;
- no model, prompt, or event fields in the server projection or client render path;
- intermittent, unavailable, and empty trend handling;
- administrator authorization and dedicated limiter placement;
- test-success behavior when telemetry storage is unavailable;
- API wiring and post-test UI refresh behavior.

## Follow-up

Use the trend only after several manual saved tests. If it shows mixed outcomes, inspect the local Ollama service's availability and model state, then run **Test Ollama Verification** again. If results are consistently `classification_only`, the practical next investigation is a compatibility matrix for the installed Ollama version and local model build, using the same fixed schema probe—without relaxing the fail-closed candidate-verification gate.
