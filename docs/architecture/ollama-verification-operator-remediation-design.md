# Ollama Verification Operator Remediation Guide — Design

## Context

The compatibility matrix and saved-capability test provide bounded evidence,
but operators still need a safe sequence for acting on that evidence. This
guide defines that sequence. It deliberately documents manual steps rather
than automating model installation, deletion, configuration changes, service
restarts, or provider requests.

That boundary is important: the matrix is advisory, while a current successful
saved-capability test alone admits the saved model to strict candidate-bound
verification.

## Current guidance

This design was reviewed on 2026-08-29 against current primary Ollama sources:

- `ollama ls` lists locally installed models and `ollama ps` lists models
  currently running in memory ([CLI reference](https://docs.ollama.com/cli)).
- The local `/api/tags` endpoint returns discovered model names and digests,
  while `/api/version` returns the local service version
  ([List models](https://docs.ollama.com/api/tags),
  [Get version](https://docs.ollama.com/api-reference/get-version)).
- Ollama recommends a JSON Schema, local validation, and temperature `0` for
  dependable structured responses
  ([Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)).
- Cloud models use Ollama's cloud service, and structured outputs are not
  supported there; they must not be used to remediate this local strict-output
  diagnostic ([Cloud models](https://docs.ollama.com/cloud),
  [Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)).

## Options considered

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Auto-pull a compatible-looking model | Fastest apparent recovery | Downloads external content and changes runtime capacity without an operator decision. |
| Auto-save the first compatible model | Fewer clicks | Changes routing configuration based on advisory evidence and could select an unintended tag. |
| Return raw provider logs or model output | More diagnostics | Exposes unnecessary provider, media, or implementation data. |
| Manual, state-based runbook with mandatory saved re-test | Clear and auditable; preserves current boundaries | Requires an operator with local-Ollama access. |

## Recommendation stack

1. Treat **Test Ollama Verification** as the starting and ending control. Do
   not infer strict eligibility from the matrix alone.
2. Use the matrix only after a saved capability test reports a local
   structured-output issue or a saved model change needs investigation.
3. Inspect the local environment with `ollama ls`, `ollama ps`, and the matrix
   version/build data; make one explicit maintenance change at a time.
4. If a saved tag is missing, pull only an approved **local** model/tag, check
   it with `ollama ls`, and explicitly save it in AI Settings if it is the
   intended configured model. Do not use a cloud-tagged model.
5. Re-run the compatibility matrix after the one change, then re-run the saved
   capability test. Only its current successful result can re-enable strict
   candidate-bound verification.

## Operator runbook

### Before every branch

1. In **AI Settings**, confirm that Ollama is the saved primary provider and
   record the current saved-capability result.
2. Run **Local model compatibility check** only when the saved capability test
   needs investigation. Preserve only the state, Ollama version, short build
   identifier, and fixed outcome IDs needed for an operations note.
3. Do not copy prompts, media, raw provider responses, credentials, endpoint
   details, or complete logs into a ticket or chat.

### Matrix says local Ollama is unavailable

1. Confirm the saved local Ollama deployment is running through the deployment
   tool appropriate to the host. Do not change the Classifarr provider target
   merely to make a test succeed.
2. From an authorized shell on that same local environment, use `ollama -v` to
   record the installed version. Use `ollama ps` only after the service is
   reachable to inspect currently loaded models.
3. Address one host-level availability issue, then repeat the matrix. If it
   completes, proceed to the matching completed-result branch below.
4. Finish by running **Test Ollama Verification** for the saved configuration.

### Matrix says no eligible local models, or the saved model was not included

1. From the authorized local environment, run `ollama ls` and compare the
   exact installed name and tag with the saved AI Settings model.
2. If the desired approved local tag is absent, an operator may explicitly run
   `ollama pull <approved-local-model:tag>`. Verify the exact tag reappears in
   `ollama ls` before changing Classifarr settings.
3. Do not use a `:cloud` tag as a substitute. The local compatibility matrix
   intentionally excludes cloud-tagged models, and cloud structured outputs
   are unsupported.
4. Re-run the matrix. If the saved model is included, re-run **Test Ollama
   Verification**. If it is still missing, correct the saved model/tag only
   through the normal AI Settings save flow, then repeat the test.

### Matrix completes and the saved model is strict-output ready

1. Treat this as evidence that the fixed local probe succeeded for that build,
   not as permission to route strict candidates.
2. Run **Test Ollama Verification**. If it succeeds, Classifarr's existing
   authority rules can use the saved current result; if it does not, retain the
   failure state and investigate the saved configuration rather than changing a
   policy threshold.

### Matrix completes and only the saved model is classification-only

1. Compare its short build identifier and Ollama version with the entries that
   are strict-output ready. This pattern points to the selected local model
   build rather than a general service failure.
2. Choose an approved local replacement deliberately; verify it in the local
   `ollama ls` inventory, save it through AI Settings, run the matrix, then
   run **Test Ollama Verification**.
3. Do not delete the previous model automatically. Retain it until the
   replacement has completed the saved capability test and normal operational
   acceptance.

### Matrix completes and several local models are classification-only

1. Treat this as a local Ollama/runtime investigation. Record the matrix
   version and use `ollama ps` to inspect loaded-model and resource state.
2. Apply one approved service or model-build maintenance change at a time.
   Avoid increasing parallelism or loading multiple large models simply to
   force a result; that can worsen local memory pressure.
3. Re-run the matrix and finish with **Test Ollama Verification**. Escalate
   only sanitized state/version/build information if the pattern persists.

## Explicit non-actions

- Do not automatically call `ollama pull`, `ollama rm`, `ollama stop`, or
  `ollama serve` from Classifarr.
- Do not change the saved host, port, provider, policy thresholds, or strict
  verification admission based only on a matrix row.
- Do not replace a missing local model with a cloud-tagged model for strict
  verification.
- Do not persist raw model output, prompts, media, endpoints, or credentials
  as remediation evidence.
