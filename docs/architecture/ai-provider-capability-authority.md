# AI Provider Capability And Authority Modes

## Status

Phase 5R.3 is complete and was re-evaluated on 2026-08-08. This document
defines the authority boundary for every AI classification response before
later runtime-question and verification work uses it.

## Problem

Provider location is not a trust boundary. A local model can produce valid JSON
without providing reliable semantic adherence, and a cloud provider can expose
different guarantees for different API paths and models. Treating any model
output as an executable instruction would create excessive agency.

The platform therefore treats model output as data for deterministic services,
not as a command to route media, learn, edit policy, notify an operator, invoke
another provider, or write domain data.

## Official Research Basis

The implementation was re-evaluated against the applicable official guidance
available for the requested August 2026 baseline:

- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
  documents schema-constrained generation but still requires application-side
  validation. Its cloud offering does not support structured outputs.
- [Ollama streaming](https://docs.ollama.com/api/streaming) distinguishes
  streaming from non-streaming responses; strict response handling must account
  for incomplete output.
- [Google Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output?authuser=14&hl=en)
  documents a JSON Schema subset. Schema conformance is a transport property,
  not application authorization.
- [NIST AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  calls for risk-tiered oversight, tracking, documentation, and governance
  across the AI value chain.
- [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
  requires downstream complete mediation rather than an LLM decision for a
  privileged action.

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

### August 2026 Re-evaluation Hardening

The original capability profiles and semantic parser boundary were present, but
the audit found enforcement gaps between an inspectable profile and an actual
generation request. The following controls close them:

- An effective `disabled` mode now rejects before either local or cloud provider
  invocation. It is a no-generation state, not an advisory label.
- A granted `structured_contract` or `verification` request now requires an
  object JSON Schema at the router boundary. Provider capability alone cannot
  represent a strict generation without the adapter submitting that schema.
- Primary and repair responses both pass through the shared normalizer before
  semantic parsing. Thinking traces are counted but removed before parser
  diagnostics are retained.
- A repair result is attributed to the provider and model that produced it. A
  cross-provider or cross-model local repair receives `fallback_advisory`,
  never the source response's cloud verification or structured authority. Its
  bounded provenance retains only server-owned provider and mode facts; see
  [AI Repair Authority Integrity](ai-repair-authority-integrity.md).
- Any `ai` or `ai_*` result that loses its authority view fails closed for
  automatic routing. A `policy_auto` label is route-eligible only when the
  selected library matches a current deterministic `auto_classify` policy
  result; a label alone is never an exception.

## Output And Side-Effect Boundary

Every initial provider response passes through the same normalizer before the
existing semantic parser, for both local and cloud providers. It strips thinking
blocks and Markdown fences while retaining valid one-line JSON for the parser.

The classification boundary enforces `ai_authority.sideEffects.canRoute ===
false`: an AI-derived candidate requires a deterministic server-owned question
and cannot satisfy final automatic routing. `policy_auto` remains eligible only
when the routing boundary proves that it is produced by the current native
policy evaluation for the selected destination, not by model output or an
upstream method label.

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

When repair runs, the initial provider response and the local repair execution
are recorded separately. A primary parse failure cannot be relabeled as a
successful strict response merely because a later local repair parsed.

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

### Trust A Capability Profile Without A Strict Request

Pros: fewer request-time checks.

Cons: a configured provider can receive a normal text request even though its
profile supports structured output. That makes the reported authority stronger
than the executed adapter path.

Decision: rejected. A granted strict mode must include a schema on the specific
generation request.

### Record Raw Failure Samples For Debugging

Pros: high-fidelity incident diagnosis.

Cons: retains model output and potentially media or sensitive data beyond what
capability monitoring needs.

Decision: rejected. Use bounded diagnostic handling already owned by the parser
and aggregate metrics for this component.

## Final Recommendation Stack

1. Keep authority server-owned, immutable, and observable on every model
   result, and deny `disabled` before provider invocation.
2. Admit contract/verification only when a supported adapter submits a strict
   schema on that specific request; downgrade every other path.
3. Normalize and semantically parse primary and repair responses before any
   downstream use or retained diagnostic artifact.
4. Keep model output declarative and fail closed for AI-derived routing when
   authority metadata is absent or advisory.
5. Attribute accepted repair output and aggregate capability observations to
   their actual provider and model; downgrade cross-provider repair.
6. Monitor capability through privacy-bounded aggregate counters and use those
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
- Enforcement and regression coverage: `server/src/services/aiRouter.mjs`,
  `server/src/services/classificationAiService.mjs`, and their focused tests.
- Storage migration:
  `database/migrations/20260803_130000_add_ai_provider_capability_metrics.sql`.

## Next Task

Phase 5R is complete. **10R.1.1 AI Authority Pipeline Acceptance** now proves
the configured authority boundary end to end with an isolated database and
deterministic transport. Proceed with **10R.1.2 Deterministic Policy Decision
And Route Outcome Acceptance**: prove native `policy_auto` routing remains
separate from AI-derived and non-final outcomes without a media-server or live
provider dependency.
