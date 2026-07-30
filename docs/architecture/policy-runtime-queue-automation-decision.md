# Policy Runtime Queue Automation Decision

## Status

Completed as the queue-execution component of Phase 7R.3, Automation Decision
Contract.

## Problem

The existing automation decision reducer correctly maps a runtime evidence
projection and operational facts to an explicit state, but it did not consume
the queue evidence admission produced immediately before a classification
attempt. Without that bridge, a future queue executor could use a valid general
decision without proving that it was derived from the fresh admitted evidence
for this task attempt.

The adapter must bind the existing decision to that admission without treating
the queue payload as evidence, leaking raw queue data, or performing execution
side effects.

## Official Guidance Reviewed

- [CWE-345: Insufficient Verification of Data Authenticity](https://cwe.mitre.org/data/definitions/345.html)
  identifies accepting insufficiently verified data as an integrity risk. The
  adapter recomputes the admission audit and rejects a non-ready or altered
  admission before constructing any decision.
- [OWASP API10: Unsafe Consumption of APIs](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
  recommends validating and sanitizing data before it reaches downstream
  components. Only the admission's verified projection and three bounded
  operational inputs reach the existing decision reducer.
- [OWASP API8: Security Misconfiguration](https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/)
  recommends enforced payload schemas and avoiding sensitive diagnostic data.
  The result has an allowlisted shape and excludes task IDs, queue payloads,
  and provider payloads.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends repeatable secure-development practices that reduce vulnerabilities
  and prevent recurrence. The adapter is deterministic and has regression tests
  for valid, blocked, tampered, and side-effect-claiming outcomes.

## Options Considered

### Call The Existing Reducer Directly From The Queue Worker

Pros:

- Fewer intermediate values.

Cons:

- Permits a caller to omit the queue evidence admission.
- Does not bind a decision to the classification task attempt.

### Extend The General Automation Reducer With Queue Semantics

Pros:

- One public decision service.

Cons:

- Mixes generic evidence-to-state reduction with queue transport provenance.
- Broadens a stable reusable contract and makes non-queue callers carry queue
  concerns.

### Selected: A Queue-Specific Decision Adapter

Pros:

- Revalidates the server-owned fresh-evidence admission.
- Reuses the existing state and trace contract rather than duplicating it.
- Binds the decision fingerprint to the opaque task and execution fingerprints.
- Fails closed with no usable decision if the admission is malformed or stale.
- Keeps queue mutation, classification, routing, provider calls, questions, and
  learning outside this component.

Cons:

- Adds a small contract layer before the eventual queue executor.
- The following execution task must deliberately consume this result; this
  component does not change the live worker by itself.

## Final Recommendation Stack

1. Build fresh queue evidence for every classification attempt.
2. Require its audit, sanitized projection fingerprint, and execution
   fingerprint before building a queue automation decision.
3. Pass only the admitted projection, routing, classification, and policy
   evaluation facts to the existing reducer.
4. Preserve the existing `auto_route_ready`, `classified_not_routed`, review,
   block, mapping, retry, and insufficient-evidence states exactly as the
   general decision contract defines them.
5. Keep the envelope and decision side-effect-free. A later executor must
   revalidate this envelope immediately before it mutates queue, classification,
   or routing state.

## Implementation Outcome

- Added `policyRuntimeQueueAutomationDecision.mjs`, an ESM-only pure adapter.
- It accepts only a ready queue evidence admission plus `routing`,
  `classification`, and `policyEvaluation` operational facts.
- It recomputes the admission audit, derives the existing automation decision,
  and rejects an invalid base decision.
- A ready result carries only opaque task, evidence, and execution fingerprints
  along with the existing decision. A blocked result carries no decision or
  usable evidence binding.
- Its audit enforces matching admission/decision evidence fingerprints,
  allowlisted public shapes, no raw queue/provider data, and exactly-false side
  effect declarations.

## Security Outcome

- A cached, blocked, malformed, or altered evidence admission cannot authorize
  any decision.
- Raw task identifiers, queue payloads, and provider payloads cannot enter the
  public queue-decision result.
- Classification success without routing remains `classified_not_routed`; it
  cannot claim routing success.
- Decision construction cannot perform provider, queue, classification, route,
  question, or learning side effects.

## Verification

- Focused tests cover fresh auto-route decisions, classified-not-routed,
  blocked/altered admissions, unsupported raw input, fingerprint/output
  tampering, and claimed side effects.
- Existing automation-decision, queue-evidence, projection, and runtime
  inventory suites verify the reused contracts.

## Next Task

Phase 7R.4, Runtime Question Reduction, should consume valid queue automation
decisions and produce only bounded, destination-focused questions for states
that genuinely require an operator. It must not ask about provider, queue, or
internal decision details, and it must preserve the route-versus-classification
distinction.
