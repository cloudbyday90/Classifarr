# AI Repair Authority Integrity

## Status

Phase 11R, Task 11R.1.1 is complete as of 2026-08-10. This document defines
the authority and observability boundary for an accepted AI response repair.

## Problem

The classification service may repair a malformed provider response with a
second, lower-temperature local Ollama request. Before this task, the parsed
repair response inherited the original provider authority. A malformed cloud
verification response repaired by local Ollama could therefore appear as a
cloud verification result and increment cloud capability telemetry as a
successful parse.

AI-derived results already cannot route, learn, mutate policy, notify, invoke
providers, or write domain data. The defect did not grant those permissions,
but it misrepresented the producer, effective authority, and capability data.

## Official Research Basis

- [OWASP LLM05: Improper Output Handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/)
  recommends zero-trust validation and mediation for model output before it
  crosses downstream boundaries.
- [OWASP LLM01: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
  identifies external and model-derived content as untrusted and recommends
  explicit trust boundaries with deterministic controls.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for repeatable, documented evaluation and production monitoring.

## Alternatives

### Retain The Original Provider Authority

Pros: no additional authority or telemetry behavior.

Cons: falsely attributes a local repair to the original provider and can retain
an effective `verification` mode that the repair execution did not earn.

Decision: rejected.

### Repair Through The Original Strict Provider Adapter

Pros: preserves one-provider provenance and could retain strict transport
semantics when that adapter supports the repair contract.

Cons: the existing repair contract is a local pipe-format normalizer, not a
provider-neutral strict-schema request. Reworking every provider adapter is a
separate capability project and would reduce recovery availability today.

Decision: deferred; evaluate only with a provider-model conformance suite.

### Conservative Local Repair Attribution

Pros: identifies the producer that created the accepted repair, preserves local
recovery availability, and prevents elevation to strict or verification
authority across providers.

Cons: one classification can produce two aggregate capability observations and
requires consumers to distinguish original generation from accepted repair.

Decision: selected.

## Implemented Contract

`classificationAiRepairAuthority.mjs` owns the repair authority boundary.

- A repair performed by the same Ollama provider and exact same model preserves
  that existing advisory profile.
- A cross-provider repair, or an Ollama repair using a different model, receives
  a new server-owned `fallback_advisory` profile for the configured local repair
  model. Its contract grade is false and every side-effect permission is false.
- An unsuccessful repair retains the original response authority because no
  repair result was accepted as the classification output.
- Each repair attempt retains a bounded `repair_provenance` record with only
  source and repair provider IDs, models, effective modes, fallback flags, and
  cross-provider or cross-model booleans. It never retains prompts, model text,
  item metadata, credentials, library IDs, or commands.
- The original generation and repair execution record separate aggregate
  capability observations. The primary record retains the malformed parse and
  repair outcome; the repair record represents the actual local request. Metric
  storage remains parameterized and fail-open.

No existing history is rewritten. Historical repair provenance was not
persisted, so reconstructing it would be speculative.

## Verification

- Pure authority tests cover cloud-to-local downgrade, same-model local repair,
  local model changes, and bounded provenance.
- Classification service tests cover cloud verification repaired by Ollama,
  same-model Ollama repair, failed cloud repair, and two provider metric
  observations.
- Existing authority-pipeline acceptance continues to prove that all AI-derived
  authority profiles have no route capability.

## Final Recommendation Stack

1. Attribute accepted output to the provider and model that produced it.
2. Downgrade cross-provider or cross-model repairs to `fallback_advisory`.
3. Keep repair provenance bounded, server-derived, and free of content.
4. Count primary and repair executions separately in aggregate telemetry.
5. Keep deterministic route and policy authority separate from every AI result.

## Next Task

Proceed with **11R.1.2 Deterministic-Outcome-Aware AI Modes**: invoke AI as a
bounded verifier only for a unique deterministic candidate, use advisory
diagnostics or abstention for ambiguous policy outcomes, and reserve generic
classification for genuine no-policy fallback.
