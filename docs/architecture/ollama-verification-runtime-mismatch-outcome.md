# Ollama verification runtime mismatch outcome

## Delivered behavior

When a tested primary Ollama model’s live digest no longer matches its tested digest:

1. The strict candidate-verification request stops before generation.
2. Streamed generation preserves `MODEL_DIGEST_MISMATCH` for the runtime boundary.
3. The matching saved capability becomes `model_changed` through a conditional database update.
4. AI Settings displays “Ollama model changed since verification” and offers the existing **Test Ollama Verification** action.
5. The fixed mismatch code increments `ai_provider_capability_metrics.model_digest_mismatch_count`; no exception text, digest, endpoint, prompt, output, or media data is persisted.
6. Existing configurations with a current successful primary Ollama test now report verification admission correctly in remediation readiness.

General AI classification remains available according to its existing configuration. Only strict candidate-bound verification is revoked.

## Operator outcome

An administrator should open **Settings → AI → Candidate-Bound Verification**. If the card states that the model changed, run **Test Ollama Verification** after confirming the intended local model is installed. A successful fixed, media-free structured-output test restores strict verification; a failed test keeps it blocked.

The status is deliberately not auto-approved by seeing a model name again. Ollama model names are mutable; the verified digest and the saved configuration identity must match.

## Verification coverage

- Preserved the preflight failure code through streamed generation.
- Tested rejection of incomplete, non-strict, and non-Ollama invalidation attempts.
- Tested the parameterized conditional update and fail-open diagnostic persistence behavior.
- Tested the saved `model_changed` projection and UI re-test indication without endpoint or digest disclosure.
- Tested that remediation readiness admits a current, tested primary Ollama configuration.
- Ran the complete server suite: 862 unit suites / 25,031 tests and 71 integration suites / 860 tests passed; one existing integration suite and test were skipped.
- Ran the complete client suite: 241 files / 3,552 tests passed.
- Passed lint, server and client type checks, the production client build, migration and container schema-snapshot checks, documentation lint, static-ESM checks, and coverage ratchets.

## Follow-up recommendation

Add a small, administrator-only aggregate operational panel that reports the bounded mismatch counter and its last-observed timestamp alongside the current AI Settings capability. It should remain status-only, include no model identity or event history, and be rate-limited/cache-bounded. This would make repeated model retags visible without weakening the current privacy boundary.
