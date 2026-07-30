# Policy Runtime Queue Question Reduction

## Status

Implemented as the queue-execution component of Phase 7R.4, Runtime Question
Reduction.

This adapter converts one validated
`policy.runtime_queue_automation_decision.v1` result into a bounded
`policy.runtime_queue_question_reduction.v1` plan. It is a planning boundary,
not a queue worker, persistence component, notification sender, routing
executor, provider client, or learning writer.

## Problem

The generic runtime question reducer correctly consumes a validated automation
decision, but a classification queue handoff also needs to prove that the plan
came from bounded current execution context. Passing a queue envelope directly
to the reducer would either expose queue/provider data or force transport
concerns into the generic product decision contract.

The adapter therefore admits only a ready queue automation decision, recomputes
its audit, forwards only the embedded automation decision and allowlisted
question fields, and returns only opaque task, evidence, and execution
fingerprints with the resulting plan.

## Official Guidance Reviewed

- [OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends cherry-picking response properties, avoiding automatic binding,
  keeping structures minimal, and enforcing schema-based response validation.
  The adapter uses input and output allowlists instead of passing queue objects
  through unchanged.
- [OWASP API10:2023 Unsafe Consumption of APIs](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
  requires validation and sanitization before external or integrated data is
  processed downstream. The adapter re-audits the queue-decision envelope
  before it reaches question planning.
- [CWE-209](https://cwe.mitre.org/data/definitions/209.html) advises exposing
  only minimal details to the intended audience and separating sensitive from
  non-sensitive data. The public result contains fingerprints, reason codes,
  and the bounded plan, never raw task identifiers, queue payloads, or provider
  payloads.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends repeatable secure-development practices that reduce vulnerabilities
  and their recurrence. Deterministic audits plus focused tampering tests make
  this handoff reproducible and verifiable.

## Options Considered

### Call The Generic Reducer From Queue Code

Pros:

- Lowest immediate implementation cost.
- Reuses the existing disposition and question-frame rules.

Cons:

- Allows queue code to bypass independent decision-envelope validation.
- Encourages raw queue context to become an implicit reducer input.
- Leaves no transport-specific provenance contract for later persistence.

### Add Queue Semantics To The Generic Reducer

Pros:

- One service entry point.
- All question planning remains physically co-located.

Cons:

- Mixes reusable product logic with queue transport concerns.
- Broadens the reducer input contract and increases accidental raw-data paths.
- Makes non-queue callers carry irrelevant execution semantics.

### Selected: Dedicated Queue Adapter

Pros:

- Keeps the generic reducer decision-only and reusable.
- Re-audits the queue decision before planning.
- Enforces a small input and output contract at the queue boundary.
- Binds the plan evidence fingerprint to opaque queue evidence.
- Makes the absence of side effects explicit and testable.

Cons:

- Adds a small service and focused test suite.
- A later persistence executor must still revalidate current admission before it
  stores or sends a question.

## Final Recommendation Stack

1. Accept only a ready, re-audited `policy.runtime_queue_automation_decision.v1`
   envelope.
2. Accept only `requestedQuestionFrameId` and the stale-cleanup subset of an
   existing question alongside that envelope.
3. Pass only the embedded `policy.automation_decision.v1` and normalized
   question-specific fields to `buildPolicyRuntimeQuestionReductionFromAutomationDecision`.
4. Preserve only `taskFingerprint`, `evidenceFingerprint`, and
   `executionFingerprint` provenance, never queue identifiers or payloads.
5. Require the question-plan evidence fingerprint to exactly match queue
   evidence before returning a ready result.
6. Recompute the generic plan validation and the adapter audit before a result
   is accepted.
7. Keep every declared provider, queue, classification, routing, question,
   notification, and learning side effect false.
8. Keep persistence, notification delivery, routing execution, and learning
   admission in later, independently validated components.

## Implemented Contract

`server/src/services/policyRuntimeQueueQuestionReduction.mjs` exports:

- `POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_VERSION`
- `POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS`
- `POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS`
- `buildPolicyRuntimeQueueQuestionReduction`
- `buildPolicyRuntimeQueueQuestionReductionAudit`

The public result is one of:

- `ready`: a valid queue-provenance binding and bounded question-reduction plan
  are available.
- `blocked_invalid_queue_decision`: the decision is absent, stale, malformed,
  audit-invalid, or no longer evidence-bound.
- `blocked_unsupported_input`: the caller supplied raw runtime/queue data,
  unsupported question fields, or invalid field types.
- `blocked_invalid_question_plan`: the generic reducer cannot produce a valid
  plan from the validated decision.

Blocked results contain neither a plan nor a usable queue-evidence binding.

## Security And Data Handling

- The adapter uses exact top-level, stale-question, queue-evidence, result, and
  side-effect allowlists.
- It rejects raw queue/provider/payload property names in public output,
  including output audits.
- It does not trust a caller-supplied decision audit; it recomputes the queue
  automation-decision audit before planning.
- It verifies that the generic plan validates and that its decision evidence
  fingerprint matches the queue evidence fingerprint.
- It retains queue provenance only as SHA-256 fingerprints and an attempt
  number. Raw task identifiers and media/provider content are not emitted.
- A question plan can say `createQuestion: true`, but the adapter itself does
  not create, persist, or send a question. Its complete side-effect declaration
  is always false.
- The adapter does not authorize durable learning, policy mutation,
  classification writes, or routing.

## Test Coverage

`server/src/__tests__/services/policyRuntimeQueueQuestionReduction.test.mjs`
verifies:

- a hard-limit queue decision produces a bounded, evidence-bound question plan,
- automatic routes stay silent and routing gaps become configuration actions,
- stale question cleanup consumes only normalized metadata,
- altered decision evidence and unsupported raw inputs fail closed,
- raw output fields and changed fingerprint bindings fail the audit, and
- every claimed side effect fails the audit.

## Outcome

The queue path now has a narrow handoff:

```text
fresh queue evidence admission
  -> queue automation decision
  -> queue question-reduction plan
  -> later persistence or notification admission, only when independently valid
```

No live queue worker or pending-question persistence path is changed by this
component.

## Next Task

Phase 7R.5, Task 7R.5.1 should introduce a request-time destination-evidence
admission contract. It should consume only a validated question-reduction plan
or bounded manual outcome, represent the request-time choice separately from a
successful route, and hand off to the existing learning guard without writing
policy directly.
