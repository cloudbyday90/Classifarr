# Candidate-bound verification for policy rechecks

Status: Implemented for `Unreleased`
Date: 2026-08-28

## Decision

When RAG second-pass policy evaluation adopts a `prompt_confirm` destination,
Classifarr must send that server-selected candidate through the same
candidate-bound verification admission path as a first-pass confirmation
candidate. Verification remains advisory: it cannot choose a destination or
authorize routing.

## Problem

Previously, `runAiRerunStage` returned an already-adopted policy-recheck
candidate before evaluating the AI stage. A `prompt_confirm` result therefore
entered operator review without either a verification request or the bounded
status that explains why no request was sent. The resulting history method was
`policy_recheck`, which was correct but made the workflow appear to have
ignored AI.

## Design

`classificationRagLoopVerification.mjs` owns the narrow second-pass decision:

1. Detect an adopted `prompt_confirm` candidate.
2. Resolve that candidate only from the server-owned policy result and known
   library list.
3. Rebuild the verification signal context so its suggested library is the
   exact policy candidate.
4. Call the existing `verify` path. Its admission check runs before prompt
   construction, provider locks, profile reads, web searches, and generation.
5. Preserve the deterministic candidate if a budget or resilience gate blocks
   verification, or if a provider error occurs. A successful admission retains
   only the bounded verification status for operator presentation.

This is compatible with the existing provider admission requirement: strict
verification needs a provider with server-enforced structured output and the
verification authority. OpenAI documents `json_schema` structured output and
strict schema adherence for supported models; Classifarr applies the same
principle without assuming that any configured provider is eligible.

## Flow

| Event | Destination authority | AI action | Operator-visible result |
| --- | --- | --- | --- |
| First-pass `prompt_confirm` | Policy engine | Candidate-bound verification admission | Confirmation review plus fixed verification status |
| Recheck upgrades to `prompt_confirm` | Policy engine | Same admission path, bound to rechecked candidate | Confirmation review plus fixed verification status when admission completes |
| Provider is ineligible | Policy engine | No provider request | `provider_capability_unavailable`; confirmation remains available |
| AI budget or resilience gate stops a recheck | Policy engine | No extra request | Deterministic confirmation remains available; trace records the gate |
| Provider error | Policy engine | Request fails | Deterministic confirmation remains available; failure remains traceable |

## Alternatives

### Keep the short circuit

Pros: minimum latency and cost.
Cons: policy-recheck confirmation candidates bypass the established verification
boundary and lack an explanatory verification status. Rejected.

### Run general classification after every recheck

Pros: broad model input and a familiar workflow.
Cons: lets a generative response propose destinations outside the rechecked
policy candidate, increases calls, and weakens the least-authority boundary.
Rejected.

### Candidate-bound verification after `prompt_confirm` rechecks

Pros: reuses the strict contract, keeps the policy engine authoritative,
explains safe non-invocation, and honors call budgets and circuit breakers.
Cons: adds one eligible verification call after a material policy upgrade.
Accepted.

## Security controls

- Only server-owned policy and library data determine the verification
  candidate and signal context.
- Admission fails closed before external work. Provider identifiers, prompts,
  candidate identifiers, model reasoning, and raw responses are not persisted
  in the operator status.
- The existing per-item AI-call budget and resilience gate stay authoritative.
  A blocked or failed verification cannot erase or auto-route the deterministic
  candidate.
- The API presentation remains a fixed allowlist of status identifiers, which
  prevents provider output from being rendered as trusted UI content.

These controls follow the same concerns identified by OWASP for external API
integrations: validate data before downstream use, use secure transport, set
timeouts, and avoid trusting an integrated service as an authority.

## Sources consulted

- [OpenAI API reference: Structured Outputs and strict JSON Schema](https://platform.openai.com/docs/api-reference/responses-streaming/response/output_item?lang=node.js)
- [OWASP API10:2023 — Unsafe Consumption of APIs](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
