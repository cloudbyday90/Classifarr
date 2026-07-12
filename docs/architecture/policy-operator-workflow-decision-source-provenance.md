# Policy Operator Workflow Decision-Source Provenance

## Status

Implemented as the bounded operator-workflow provenance gate for approved
readiness decision sources.

## Problem

Bounded automation readiness admits only approved no-write decision sources and
records a sanitized source summary. The operator-workflow handoff previously
validated evidence fingerprint and quality continuity, but it did not require
that source admission to survive all readiness handoff copies.

That left a business-logic gap: a structurally valid reconstructed readiness
object could omit or replace its upstream decision source before producing an
operator workflow.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side derivation of security-relevant values and explicit
  workflow states. The workflow revalidates source provenance instead of
  trusting a client-like object shape or a previous UI step.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends validating input at each API boundary. The workflow validates the
  readiness wrapper, readiness boundary context, and embedded readiness context
  independently.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for documented security requirements and verification. This gate is a
  small, versioned contract with focused regression tests.
- [OpenTelemetry Context specification](https://opentelemetry.io/docs/specs/otel/context/)
  describes propagating causal context across execution boundaries. Classifarr
  uses a deliberately small source summary for correlation, then validates it
  before treating it as trusted.

## Recommendation

Require one approved source to agree across all bounded readiness handoffs:

```text
readiness source-admission audit
              |
              +--> readiness boundary source summary
              |
              +--> embedded readiness-input source summary
                         |
                         +--> bounded operator workflow
```

The source summary contains only:

```text
sourceId
decisionVersion
admitted
```

The workflow accepts the handoff only when all of the following are true:

1. the outer readiness admission audit passed with no issues;
2. both summaries are admitted and match an allowlisted source contract;
3. both summaries match the outer audit's canonical source ID and decision
   version; and
4. the workflow retains only the verified summary in its own bounded context.

Missing, unapproved, noncanonical, incompatible, or mismatched values block
the workflow before it is returned.

## Pros And Cons

Pros:

- Preserves the existing readiness authority instead of creating another
  readiness engine.
- Stops reconstructed bounded inputs from hiding an unapproved decision source.
- Makes the source that enabled readiness inspectable in the workflow audit.
- Carries no raw model output, library labels, provider payloads, or decision
  body into the normal operator workflow.
- Uses the shared source contract for both admission and projection validation.

Cons:

- Bounded workflow fixtures and future readiness producers must retain all
  three source-provenance copies.
- A source contract upgrade must update the source-admission producer and its
  workflow consumers together.
- This verifies contract continuity, not cryptographic process provenance; the
  existing evidence, intent, learning, readiness, and authorization audits
  remain required controls.

## Final Recommendation Stack

1. Construct decision-source descriptors only in approved server-owned
   decision producers.
2. Admit them in bounded readiness with exact allowlisted source and decision
   versions.
3. Retain only a sanitized source summary in readiness contexts.
4. Revalidate the outer admission and both readiness summaries before building
   an operator workflow.
5. Retain the verified summary in the workflow's bounded context and audit it
   again before later consumers use the workflow.
6. Block on stable risk IDs; do not silently reconstruct or infer provenance.
7. Add future source contracts only with a focused design record, producer
   tests, readiness tests, workflow tests, and compatibility decision.

## Security And Data Handling

- The UI, API caller, model, provider, and media server cannot select an
  admitted source through this workflow contract.
- Untrusted source IDs are not copied into returned workflow provenance.
- The workflow exposes no raw decision, learning, evidence, provider, or
  media-library payload.
- This component does not persist policy, execute routing, refresh profiles,
  perform learning writes, or invoke external services.
- Workflow validation is fail closed when bounded provenance is absent or
  altered.

## Implemented Files

- Shared source contract and provenance validators:
  `server/src/services/policyDecisionHandoffSource.mjs`
- Bounded workflow consumer and audit:
  `server/src/services/policyOperatorWorkflow.mjs`
- Source-contract tests:
  `server/src/__tests__/services/policyDecisionHandoffSource.test.mjs`
- Bounded workflow tests:
  `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`

## Verification

Focused tests prove that:

- matching admission and summaries build a bounded workflow;
- a missing boundary source blocks workflow construction;
- valid-but-different embedded source summaries block workflow construction;
- a tampered workflow source summary fails workflow audit; and
- raw library evidence remains absent from the workflow boundary context.

## Next Component

Use the verified workflow provenance while defining the runtime workflow entry
point. That entry point should expose only the destination-first workflow and
its server-owned next action, never the retired diagnostic panels or raw
bounded contracts.
