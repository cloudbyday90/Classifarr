# Ollama verification runtime mismatch design

## Decision

Use a bounded, fail-closed capability transition plus one aggregate counter when a tested primary Ollama model’s digest changes before a strict candidate-verification request. The existing AI Settings capability card is the operator surface; the existing administrator test is the only recovery action.

## Problem

A tested model can be replaced or re-tagged without changing its configured model name. Classifarr already compares the current `/api/tags` digest with the tested digest before generation, so the affected request cannot reach the model. Before this change, however, the error code was dropped by streamed generation, the saved capability remained apparently ready, and the condition had no dedicated aggregate counter.

## Options evaluated

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| Keep the transient preflight error only | No schema change | Operators see a stale ready state; no bounded trend signal. |
| Store raw failure events | Better per-event forensics | Needlessly retains more operational data and increases storage/cardinality risk. |
| Chosen: state transition plus fixed aggregate | Actionable UI, one safe recovery path, low-cardinality metric, no media or model output | No item-level forensic history by design. |

## Chosen stack

1. Preserve the fixed `MODEL_DIGEST_MISMATCH` code when streamed generation rejects a preflight result.
2. Accept that code only when the request was a strict, primary Ollama verification request with a complete saved identity.
3. Atomically change the exact saved `verification_ready` record to `model_changed`, conditional on its model, configuration revision, opaque fingerprint, and expected digest. A new test or settings save therefore cannot be overwritten by a stale worker.
4. Clear the in-process provider configuration cache after a successful revocation, so later requests re-evaluate admission before calling preflight.
5. Count the fixed code in `ai_provider_capability_metrics` and retain only its last-observed timestamp.
6. Project `model_changed` through the existing AI Settings card as “Ollama model changed since verification,” with the existing bounded re-test control.
7. Reuse the same saved capability evidence in remediation readiness, so a current successful primary Ollama test is recognized and a runtime model change is not.

## Security and privacy properties

- The runtime update is conditional and parameterized; it cannot revoke a different or newer configuration.
- Strict verification remains blocked at preflight. The triggering request never reaches model generation.
- The response and UI contain only fixed status, label, message, and guidance. They exclude endpoint, digest, prompt, output, media, policy, library, and credential data.
- The metric’s dimensions remain the existing bounded provider/model/authority tuple. The new observation is a monotonic count plus timestamp, not an event log.
- Persistence failures do not grant access: the request is already rejected by the digest preflight, and a failed state update simply permits the next request to repeat that fail-closed check.

## Research basis (reviewed 2026-08-29)

Ollama’s official model-list endpoint returns a digest for each installed model, which makes it suitable for detecting a re-tagged configured model without trusting the mutable name alone. [Ollama List models](https://docs.ollama.com/api/tags)

OpenTelemetry’s metric model supports pre-aggregated counters and explicitly describes spatial re-aggregation as a cost-control mechanism. That supports retaining a fixed counter instead of high-cardinality failure events. [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)

OWASP logging guidance recommends validating/sanitizing logged fields and excluding secrets and sensitive data. The design stores only a fixed code/count/timestamp and avoids raw provider exception text. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

The read path remains cache-control protected and bounded; the design avoids creating an unbounded diagnostic endpoint, consistent with OWASP’s guidance on unrestricted API resource consumption. [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)

## Migration

`20260829_100000_add_ollama_verification_runtime_mismatch_metrics.sql` adds the aggregate count and timestamp and permits the bounded `model_changed` saved-capability status. It does not create a release.
