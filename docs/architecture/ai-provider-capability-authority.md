# AI Provider Capability And Authority Modes

## Status

Phase 5R.3 is complete. This document defines the authority boundary for every
AI classification response before later runtime-question and verification work
uses it.

## Problem

Provider location is not a trust boundary. A local model can produce valid JSON
without providing reliable semantic adherence, and a cloud provider can expose
different guarantees for different API paths and models. Treating any model
output as an executable instruction would create excessive agency.

The platform therefore treats model output as data for deterministic services,
not as a command to route media, learn, edit policy, notify an operator, invoke
another provider, or write domain data.

## Official Research Basis

The implementation follows the applicable official guidance reviewed for the
requested June 2026 baseline:

- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
  documents schema-constrained generation but still requires application-side
  validation. Its cloud offering does not support structured outputs.
- [Ollama streaming](https://docs.ollama.com/api/streaming) distinguishes
  streaming from non-streaming responses; strict response handling must account
  for incomplete output.
- [Google Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
  documents schema support as a constrained schema subset, not an application
  authorization mechanism.
- [OpenAI structured outputs in the Responses API reference](https://platform.openai.com/docs/api-reference/responses-streaming/response/web_search_call?lang=curl)
  documents strict JSON Schema support with a supported subset.
- [NIST AI RMF Secure guidance](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented provider/system boundaries, output validation, and
  oversight.
- [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
  identifies excessive permissions and unbounded action as an LLM application
  risk.

## Decision

`aiProviderAuthority.mjs` derives one immutable, server-owned authority profile
per generation. A result exposes a safe `ai_authority` view containing the
provider, model, requested and effective mode, downgrade state, supported modes,
capabilities, and all-false side-effect permissions. It contains no credential,
prompt, raw response, media metadata, or executable action.

### Modes

| Mode | Meaning | Current admission |
| --- | --- | --- |
| `structured_contract` | Provider response is sent through a strict structured-output adapter. | Direct non-reasoning OpenAI and Gemini adapters only. |
| `verification` | Provider response is requested for a bounded verification role. | Direct non-reasoning OpenAI and Gemini adapters only. |
| `proposal` | Model output may support a deterministic candidate or explanation. | All configured providers. |
| `explanation` | Non-authoritative explanation-only role. | All configured providers. |
| `fallback_advisory` | Provider was chosen by fallback and cannot be elevated. | Fallback providers only. |
| `disabled` | No model output is allowed. | Any provider configuration can explicitly select it; no provider selects it by default. |

`openrouter`, `litellm`, custom proxies, local/Ollama, and direct OpenAI
reasoning-model paths do not receive contract or verification authority. The
current direct OpenAI reasoning path does not use the strict schema adapter, so
it is intentionally a proposal rather than contract-grade output. This is a
conservative implementation choice, not a claim that those providers can never
produce structured text.

Unsupported providers are downgraded to an effective `proposal` or
`fallback_advisory` mode. They remain usable as advisory evidence. A caller can
set `requireAuthorityMode` only where a future task truly requires contract
authority; the router then fails closed rather than silently elevating the
provider.

## Output And Side-Effect Boundary

Every initial provider response passes through the same normalizer before the
existing semantic parser, for both local and cloud providers. It strips thinking
blocks and Markdown fences while retaining valid one-line JSON for the parser.

The classification boundary enforces `ai_authority.sideEffects.canRoute ===
false`: an AI-derived candidate requires a deterministic server-owned question
and cannot satisfy final automatic routing. `policy_auto` remains eligible for
routing because it is produced by native policy evaluation, not model output.

The platform does not expose model-selected commands or callbacks. Routing,
learning, policy updates, notifications, provider calls, and domain-data writes
remain owned by separately authorized deterministic services. The only new write
is server-derived aggregate telemetry; model text cannot choose a table, query,
action, target, or payload.

## Capability Telemetry

The `ai_provider_capability_metrics` table stores fixed counters keyed only by
`provider_id`, `model`, and `authority_mode`:

- request count;
- structured parse success;
- semantic contract violation;
- repair attempt and repair success;
- timeout or incomplete stream;
- invalid library reference or action signal; and
- thinking-trace leakage.

It does not store prompts, responses, thinking text, provider credentials, media
identifiers, selected library identifiers, or commands. The write is
parameterized, idempotent by `(provider_id, model, authority_mode)`, and
fail-open for telemetry availability so classification cannot fail because an
observability counter is unavailable.

## Alternatives

### Trust Any Local JSON Output

Pros: no provider capability maintenance and low latency.

Cons: JSON syntax does not establish semantic correctness or authorize
side-effects. This contradicts the authority boundary and OWASP excessive-agency
guidance.

Decision: rejected.

### Make Provider Names Globally Contract-Grade

Pros: simple operator mental model.

Cons: adapter behavior and model/API paths differ. In particular, the existing
OpenAI reasoning path does not submit the strict schema contract.

Decision: rejected. Admission is provider-and-adapter-path specific.

### Record Raw Failure Samples For Debugging

Pros: high-fidelity incident diagnosis.

Cons: retains model output and potentially media or sensitive data beyond what
capability monitoring needs.

Decision: rejected. Use bounded diagnostic handling already owned by the parser
and aggregate metrics for this component.

## Final Recommendation Stack

1. Keep authority server-owned, immutable, and observable on every model
   result.
2. Admit contract/verification modes only when the current adapter actually
   submits a supported strict schema; downgrade every other path.
3. Normalize and semantically parse every response before downstream use.
4. Keep model output declarative and block it from directly authorizing side
   effects, including routing.
5. Monitor capability through privacy-bounded aggregate counters and use those
   counters to guide future provider admission decisions.

## Implementation Evidence

- Authority profile and safe view:
  `server/src/services/aiProviderAuthority.mjs`.
- Provider selection and inspectable runtime status:
  `server/src/services/aiRouter.mjs`.
- Shared output normalization:
  `server/src/services/aiProviderOutputNormalization.mjs`.
- Aggregate metric derivation, persistence, and fail-open recorder:
  `server/src/services/aiProviderCapabilityMetrics*.mjs`.
- Route and question enforcement:
  `server/src/services/classificationRoutingServiceShared.mjs` and
  `server/src/services/classificationServiceCore.mjs`.
- Storage migration:
  `database/migrations/20260803_130000_add_ai_provider_capability_metrics.sql`.

## Next Task

Proceed with **Phase 5R.4, Runtime Clarification Normalizer**. It should consume
the authority and parser facts above to turn uncertainty into one deterministic,
versioned, server-owned question contract.
