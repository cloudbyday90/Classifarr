# Policy Request-Time Learning Provenance Cutover

## Status

Implemented as Phase 7R.5, Task 7R.5.2.

This cutover removes the obsolete direct generic question-reduction input from
the request/import terminal admission boundary. A terminal request/import event
can now reach the request-time reducer only through the task- and attempt-bound
queue proof produced during the same queue-owned classification run.

## Problem

The runtime question-reduction plan still has one legitimate role: it is stored
with a normalized pending question so a later manual native selection can be
validated against the original server-created question. Earlier terminal
request/import code accepted that generic plan as a compatibility input as well.
That duplicated authority across two workflows and made it easier for a future
caller to accidentally bypass queue task and attempt binding.

The required distinction is:

| Producer | Evidence path | Learning and routing outcome |
| --- | --- | --- |
| Request/import queue terminal route | Current queue question-reduction envelope | Passes the request-time reducer; remains outcome-only |
| Native pending manual selection | Persisted normalized question and fingerprint chain | Separately validated selection transition through the learning guard |
| Native pending terminal route | Resolver provenance and actual route result | Outcome-only |
| Manual correction | Authoritative corrected destination and exact-item guard | Separate exact-item learning contract |

Only the first row is a request/import terminal admission path. The persisted
plan in the second row is not terminal proof and must not be moved or reused.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state, rejecting invalid transitions, and
  preventing completed steps from being replayed. Queue task and attempt
  binding supply that state for request/import terminal admission.
- [OWASP API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends allowlisting mutable input fields and avoiding automatic binding.
  The request/import contract explicitly accepts only `task`, `classification`,
  and `queueQuestionReduction`; an obsolete property cannot become proof.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  prioritizes workflow integrity and state validation. The source-backed audit
  turns the direct-input removal into a regression check.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports repeatable secure-design verification. Focused unit tests and the
  runtime completion audit make the cutover reviewable and repeatable.

## Options Considered

### Keep The Direct Compatibility Branch

Pros:

- Gives legacy internal callers an explicit outcome-only reason code.

Cons:

- Retains an obsolete authority-shaped input at a terminal boundary.
- Requires ambiguity handling for a path that has no live producer.
- Makes the queue proof less clearly authoritative.

### Merge Native Pending Selection Into Queue Admission

Pros:

- One apparent proof type.

Cons:

- Conflates manual pending resolution with queue terminal routing.
- Breaks the persisted-question validation chain needed after asynchronous
  operator selection.
- Risks changing correct outcome-only route persistence.

### Remove The Terminal Input And Preserve Independent Producers

Pros:

- Gives request/import one authoritative proof path.
- Preserves the pending-question and manual-correction contracts that have
  independently validated evidence chains.
- Reduces compatibility code and removes direct-versus-queue ambiguity.
- Keeps invalid or missing proof outcome-only with no provider, routing,
  profile-refresh, or learning writes.

Cons:

- Any unconverted internal caller cannot use a generic plan at this boundary.
- The producer inventory must be maintained when a new request-time flow is
  introduced.

## Implemented Design

`policyRequestImportDestinationAdmission.mjs` now receives only terminal task,
classification, and queue-proof inputs. It no longer destructures, validates,
or reports a direct generic plan. An ignored extra property cannot suppress a
valid queue proof or create a request-time decision without one.

`policyRequestTimeTerminalRouteIntegrationAudit.mjs` now verifies both sides of
the terminal cutline:

1. The queue processor supplies `runtimeQueueQuestionReduction` to admission.
2. Request/import admission retains outcome-only fallback.
3. Request/import admission source does not contain the removed direct-plan
   input.

The audit reads fixed, server-owned paths and returns only compact status data.
It does not read queue payloads, persist data, route media, call providers,
consume quota, write learning, or queue profile refresh work.

## Final Recommendation Stack

1. Keep `policyRuntimeQueueQuestionReductionProducer.mjs` as the sole terminal
   request/import proof producer.
2. Require `policyRequestTimeQueueQuestionReduction.mjs` to revalidate the
   queue proof against task, attempt, and terminal route state.
3. Keep `policyRequestImportDestinationAdmission.mjs` outcome-only unless that
   queue proof is valid.
4. Preserve `policyNativePendingResolutionProvenance.mjs` as a separate
   persisted-question selection contract.
5. Preserve native pending terminal routing and manual correction as their own
   outcome-only or exact-item guarded contracts.
6. Keep the terminal integration audit in runtime completion coverage so a
   direct compatibility input cannot silently return.

## Verification

Focused tests prove that a supplied obsolete direct property is ignored, cannot
block a valid queue proof, and cannot create a request-time decision without
queue proof. The integration audit test injects the removed source fragment and
expects the audit to fail.

## Next Task

Proceed with **Phase 7R.8, Task 7R.8.1: Runtime Metrics Persistence
Admission**. The component should admit only validated bounded metric and trace
summaries, enforce retention and export policy server-side, and preserve raw
payload, prompt, embedding, and identity suppression.
