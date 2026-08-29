# Aggregate Ollama Verification-Test Outcome History — Design

## Context

The saved Ollama verification test is deliberately a fixed, media-free JSON-Schema probe. Its current result determines whether Classifarr may use strict candidate-bound verification. Operators also need to distinguish a one-off local problem from repeated incompatibility without turning verification telemetry into a store of provider configuration or model content.

This design was reviewed on 2026-08-29 against current primary guidance. Ollama's generate API supports a JSON Schema in the `format` request property and places generation controls in `options` ([Generate API](https://docs.ollama.com/api/generate)). Its structured-output guidance recommends supplying the schema and validating the response, with temperature `0` for deterministic results ([Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs)).

## Options considered

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Persist each test event with configuration metadata | Detailed incident reconstruction | Retains host, model, diagnostic and timing dimensions that are unnecessary for the operator decision; grows without bound. |
| Keep only the current saved verdict | Minimal data and simple implementation | Cannot distinguish intermittent local issues from recurring incompatibility. |
| Fixed daily status aggregates for a bounded window | Shows recurrence, has small predictable storage, and excludes test content | Cannot reconstruct individual events or tie outcomes to a historic configuration. |

## Recommendation stack

1. Keep the existing fixed JSON-Schema probe and its current saved capability as the sole authority for strict verification.
2. Record only a daily counter and last-observed timestamp for the three possible saved-test verdicts: `verification_ready`, `classification_only`, and `unavailable`.
3. Retain a fixed 30-day window; delete older daily aggregates whenever a new test result is recorded.
4. Publish a parameter-free, administrator-only, rate-limited aggregate read endpoint. Do not accept a client-selected date range, status, model, or provider dimension.
5. Present a deterministic advisory signal in AI Settings: no recent tests, consistently ready, intermittent, classification-only, unavailable, or mixed non-ready. Make the UI state plainly that current saved capability is still authoritative.

The retained aggregate excludes provider identifiers, host, port, model, model digest, configuration revision/fingerprint, credentials, prompts, responses, raw errors, media, policy, route, actor, and individual event identifiers.

## Security and operational boundaries

The endpoint follows the resource-control guidance to constrain record count, execution work, and request frequency ([OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)). Its 30-day fixed window, fixed three-row projection, no query parameters, authenticated administrator boundary, and dedicated rate limiter are defense in depth.

OWASP advises collecting enough information for the intended purpose, but not too much, and treating event data according to its risk ([OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)). The aggregate is therefore operational context—not an audit log—and cannot affect classification, policy decisions, queueing, or capability authority. A failure to write it is logged with only the fixed `persistence_unavailable` code and does not change a completed capability test.

## Module design

```text
saved capability test
  -> capability persistence (authoritative)
  -> best-effort aggregate recorder
       -> daily 30-day database aggregate

admin settings UI
  -> rate-limited aggregate route
       -> history read service
            -> allow-listed projection and advisory signal
```

The modules are intentionally independent:

- `ollamaVerificationCapabilityOutcomeHistory.mjs` owns the fixed contract and sanitized projection.
- `ollamaVerificationCapabilityOutcomeHistoryRepository.mjs` owns parameterized persistence/read SQL.
- `ollamaVerificationCapabilityOutcomeHistoryService.mjs` owns the read composition.
- `statsRouteOllamaVerificationCapabilityOutcomeHistory.mjs` owns authorization, limiting, and HTTP delivery.
- `OllamaVerificationCapabilityOutcomeHistory.vue` has its own allow-list, so an unexpected server field cannot be rendered.
