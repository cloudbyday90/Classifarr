# Deterministic-Outcome-Aware AI Modes

## Status

Phase 11R.1.2 is complete as of 2026-08-10. This document records the
runtime contract that selects an AI request mode from the current,
server-owned policy outcome.

## Problem

Before this change, the initial policy path sent every non-final ranked policy
outcome to the generic AI classification prompt. The RAG second pass separately
forced verification. Those two paths could ask a provider to select a
destination after the deterministic policy engine had already established that
the outcome was ambiguous or required an operator decision. The legacy path
also inferred verification merely because it had signal context.

That behavior was not a routing-authority bypass: later route gates still
blocked AI-derived routes. It was nevertheless an unnecessary provider call,
made runtime behavior harder to explain, and could present an AI-selected
candidate where the server already knew that only an operator could resolve the
policy outcome.

## Official Research Basis

The design was evaluated against official guidance available for the requested
August 2026 baseline:

- [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
  recommends minimizing an LLM's functionality, permissions, and autonomy,
  while independently mediating downstream actions.
- [OWASP LLM05: Improper Output Handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/)
  requires application-side validation and safe handling of model output before
  it reaches downstream components.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for defined human-AI roles, documented operating limits, and ongoing
  measurement of deployed controls.

## Decision

`classificationDeterministicAiMode.mjs` is a pure, server-owned request-plan
resolver. It accepts only the policy result, active libraries, and an explicit
policy-evaluation-failure signal. It returns immutable bounded facts:

- contract version;
- selected mode;
- whether a provider may be invoked;
- stable server reason code;
- policy action; and
- ranked-candidate count.

It has no provider access, cannot select a route, and cannot mutate a policy,
learning state, task, library, or media-server record.

### Mode Matrix

| Current deterministic outcome | AI mode | Provider call | Server behavior |
| --- | --- | --- | --- |
| `auto_classify` | `skip` | No | Existing deterministic route handling remains authoritative. |
| No policy result or no ranked policy candidate | `classify` | Yes | The legacy signal path makes an explicit generic proposal request. |
| Valid, unique `prompt_confirm` candidate | `verify` | Yes | The provider receives the existing bounded verification prompt. Its result remains advisory and cannot route. |
| `prompt_select` with a valid bounded candidate contract | `adjudicate` | Yes | The provider can compare only two or three server-selected candidates using bounded evidence. Its proposal remains advisory and an operator destination decision is still required. |
| Other `prompt_select` outcome | `abstain` | No | The existing server-owned destination question is generated from ranked candidates. |
| `manual` or `requires_manual_review` | `abstain` | No | The existing server-owned evidence-review question is generated. |
| Missing active destination or unsupported/malformed policy action | `abstain` | No | The operator receives a bounded decision question; generic fallback is not used. |
| Policy evaluation failure | `abstain` | No | The operator receives a bounded recovery decision question; a failure is not treated as no policy. |
| RAG second-pass recheck | Re-resolved | Conditional | The same resolver runs again against the rechecked policy result; RAG can never force verification. |

The default in `classificationAiService.mjs` is now explicit generic
classification. Supplying a signal context no longer changes the request into
verification. The policy path and RAG rerun are responsible for passing the
mode selected by the deterministic resolver.

### Authority Boundary

`verify` is a prompt-role selection, not an authority grant. The provider
capability profile described in [AI Provider Capability And Authority
Modes](ai-provider-capability-authority.md) remains the authority source of
truth. A provider that is only admitted for advisory proposals is not elevated
because the deterministic request plan selected a verification prompt.

In every mode, model output remains data for the server-owned parser and route
safety gate. It cannot authorize media-server routing, learning, policy writes,
notifications, provider calls, or domain-data writes. A verification response
that disagrees with the deterministic candidate already retains that candidate
and requires review.

## Persistence And Privacy

`classificationPersistenceService.mjs` records a small
`deterministic_ai_mode` projection under classification details:

- version;
- mode;
- invoked flag;
- server reason code;
- policy action; and
- candidate count.

The projection rejects unknown values and intentionally excludes item identity,
library IDs and names, policy content, prompts, provider output, provider
credentials, and commands. It uses the existing JSON details column, so no
schema migration is required.

## Alternatives

### Continue Generic Classification for Every Review Outcome

Pros: fewer branches and allows an AI suggestion for every pending item.

Cons: an ambiguous or manually gated policy outcome is already known to need an
operator decision. A generic model request adds latency and privacy exposure
without granting a valid route or resolving the deterministic ambiguity.

Decision: rejected.

### Ask AI to Rank Ambiguous Candidates in a New Diagnostics Mode

This option is now implemented as bounded candidate adjudication. See
[Policy Candidate Adjudication Design](policy-candidate-adjudication-design.md)
for the contract, provider data minimization, retention boundary, and operator
authority model. It deliberately retains a proposed destination but not a
model explanation or reasoning trace.

### Treat Policy Evaluation Failure as Generic No-Policy Fallback

Pros: preserves historic throughput when the policy engine is unavailable.

Cons: turns an internal authority failure into a model-selection request and
makes it indistinguishable from a successful policy evaluation with no match.

Decision: rejected. The result now requires an explicit operator decision.

### Couple This Change to Provider Capability Admission

Pros: a single change could require contract-grade provider verification.

Cons: capability admission is an independent operator-facing compatibility
decision. Combining it with request planning would unexpectedly disable
advisory verification for existing local installations.

Decision: deferred. Provider authority remains independently visible and all
verification output remains advisory regardless of provider location.

## Final Recommendation Stack

1. Select the AI mode only from the current deterministic policy result.
2. Skip provider access for policy automation, ambiguity, insufficient
   evidence, malformed policy outcomes, and policy-engine failures.
3. Use verification only for a valid unique review candidate, and preserve the
   existing route-safety and advisory-authority gates.
4. Reserve generic AI classification for a genuine no-policy fallback, with an
   explicit caller-selected `classify` mode.
5. Re-apply the same decision plan after a RAG policy recheck and persist only
   privacy-bounded mode telemetry.

## Implementation Evidence

- Pure decision plan and persistence projection:
  `server/src/services/classificationDeterministicAiMode.mjs`.
- Initial policy path, explicit policy-failure review, and abstention handling:
  `server/src/services/classificationPolicyPathService.mjs`.
- Explicit legacy generic fallback:
  `server/src/services/classificationLegacySignalPathService.mjs`.
- Rechecked RAG outcome handling:
  `server/src/services/classificationRagLoopStages.mjs`.
- Explicit AI-service default:
  `server/src/services/classificationAiService.mjs`.
- Bounded persistence:
  `server/src/services/classificationPersistenceService.mjs`.
- Focused evidence:
  `server/src/__tests__/services/classificationDeterministicAiMode.test.mjs`,
  `server/src/__tests__/classificationPolicyPathService.test.mjs`,
  `server/src/__tests__/classificationLegacySignalPathService.test.mjs`,
  `server/src/__tests__/classificationRagLoopStages.test.mjs`, and
  `server/src/__tests__/classificationAiService.test.mjs`.
