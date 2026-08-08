# AI Authority Pipeline Acceptance

## Status

Phase 10R, Task 10R.1.1 is complete as of 2026-08-08. This record defines
the isolated acceptance boundary for configured AI authority and records its
implemented outcome.

## Problem

Phase 5R.3 established provider capability and authority contracts. Its unit
coverage proved individual rules, but it did not exercise the complete boundary
from persisted provider configuration through router admission, response
normalization, semantic parsing, authority attachment, and routing restraint.

Calling a configured live provider is not an acceptable replacement for that
acceptance coverage. It would depend on an installation's secrets, budget,
network, provider availability, and model behavior. It would also make a safety
gate nondeterministic.

## Research Basis

- [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
  recommends least privilege, downstream complete mediation, bounded tools,
  and human oversight for high-impact actions. Model output must not authorize
  routing by itself.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for repeatable test, evaluation, verification, and validation in
  comparable deployment conditions, with documented results and monitoring.
- [Docker Compose uses](https://docs.docker.com/compose/intro/features-uses/)
  describes isolated environments as a valid testing use case. The server
  integration harness applies that principle with a disposable PostgreSQL
  database and no external provider process.

## Options Considered

### Call the configured live provider

Pros:

- Exercises a provider endpoint and the operator's current configuration.

Cons:

- Requires credentials and may spend budget.
- Fails for ordinary provider outages, rate limits, or model revisions rather
  than a Classifarr regression.
- Cannot be a repeatable CI or pre-release acceptance gate.

Decision: rejected.

### Keep only isolated unit mocks

Pros:

- Fast and deterministic.

Cons:

- Does not prove that the configured router, strict admission, response
  normalizer, parser, authority projection, and route guard compose correctly.

Decision: insufficient on its own.

### Use the real service boundary with an injected in-process transport

Pros:

- Uses the disposable integration database and the real persisted provider
  configuration path.
- Exercises router admission, schema forwarding, normalization, parser,
  authority projection, and routing restraint together.
- Has no external network, credential, model, budget, or installation data
  dependency.

Cons:

- Does not certify a third-party provider's uptime or model quality.
- Requires a narrow dependency-injection seam in the router.

Decision: selected.

## Recommendation Stack

1. Keep provider authority server-owned and deny unsupported requests before a
   transport is invoked.
2. Make transports explicit dependencies of `AIRouterService`; production keeps
   the real clients while acceptance coverage injects deterministic local ones.
3. Use the existing disposable PostgreSQL integration harness to exercise the
   persisted provider-selection path without accessing an installation's
   provider credentials.
4. Treat response normalization, semantic parsing, authority projection, and
   routing restraint as one acceptance boundary.
5. Keep the resulting AI candidate advisory. A deterministic policy decision
   remains the only route-eligible path.

## Implemented Outcome

`AIRouterService` now accepts explicit cloud and local transport dependencies.
The production singleton retains the existing real transports, while tests can
instantiate an isolated router without global module replacement.

`classificationAiAuthorityAttachment.mjs` owns the small data-only boundary
that attaches the safe server authority projection to a parsed result. The
classification service continues to record only the resulting safe projection
through its existing aggregate capability metric path.

The integration suite uses a disposable database row and in-process transports
to prove all of the following:

- an explicitly disabled authority mode stops before either provider transport;
- a strict verification request without a schema stops before transport;
- a local provider cannot satisfy requested verification authority;
- a schema-bound verified response loses thinking and Markdown wrappers before
  parsing, receives a no-route authority view, and is blocked by the real
  automatic-routing decision.

The fixture contains no real provider secret, makes no outbound request, and
does not mutate classification, policy, routing, or learning data.

## Evidence

- Router dependency boundary: `server/src/services/aiRouter.mjs`.
- Result authority attachment: `server/src/services/classificationAiAuthorityAttachment.mjs`.
- Classification integration: `server/src/services/classificationAiService.mjs`.
- Isolated acceptance suite:
  `server/src/__tests__/integration/ai-authority-pipeline-acceptance.test.mjs`.
- Focused attachment suite:
  `server/src/__tests__/services/classificationAiAuthorityAttachment.test.mjs`.

## Next Task

Proceed with **10R.1.2 Deterministic Policy Decision And Route Outcome
Acceptance**. It must exercise a native-policy classification through the
real policy decision and routing-outcome boundaries, proving that deterministic
`policy_auto` remains eligible while AI-derived and policy-ineligible outcomes
remain distinctly non-routed. It must use an isolated fixture and no media
server or AI provider credential.
