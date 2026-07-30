# Policy Runtime Queue Question-Reduction Producer

## Status

Implemented as the Queue Question-Reduction Producer Cutline for Phase 7R.5.

The live classification queue now produces one opaque
`policy.runtime_queue_question_reduction.v1` envelope from current
server-owned evidence. Request/import terminal-route admission consumes that
envelope only. The prior generic question-reduction plan remains internal to
classification for existing pending-question persistence; it is no longer a
request-time proof source.

## Problem

The queue had independently implemented evidence, automation-decision, and
question-reduction contracts, but no live producer supplied the envelope to the
request-time adapter. The live queue instead passed a generic plan directly
from classification. Activating both paths would create two proof sources for
one terminal route, making provenance and replay reasoning ambiguous.

The producer must derive fresh evidence during the classification run without
using raw queue payloads, provider data, cached projections, or a second
classification/routing execution.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-enforced state transitions, server-derived sensitive
  values, replay resistance, idempotency, and invariant testing. The producer
  derives proof only from the current server-owned classification context and
  binds it to task type, attempt, and a hashed task identity.
- [OWASP API6:2023 Unrestricted Access to Sensitive Business Flows](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)
  calls for controls around sensitive automated flows. The producer has no
  provider, queue-mutation, routing, persistence, question, or learning side
  effect and cannot be invoked through the normal classification HTTP payload.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  prioritizes workflow integrity, authorization boundaries, and validation.
  Source-backed integration checks require the queue-specific classification
  call and prohibit a direct terminal proof handoff.
- [NIST SP 800-204A](https://csrc.nist.gov/pubs/sp/800/204/a/final)
  recommends explicit, resilient service boundaries. The producer composes
  small validation contracts instead of adding queue behavior to a singleton
  classifier or broadening the generic reducer input.

## Options Considered

### Keep The Direct Generic Plan

Pros:

- No new queue integration work.
- Existing pending-question persistence continues unchanged.

Cons:

- Does not bind terminal request-time proof to queue task and attempt.
- Leaves the separately designed queue proof contracts inactive.
- Encourages a generic plan to serve two different authority roles.

### Rebuild Evidence In The Queue Processor

Pros:

- Places all queue behavior in one file.

Cons:

- Couples queue orchestration to native authority/profile/routing derivation.
- Risks duplicate classification and accidental raw payload use.
- Makes the producer hard to test independently.

### Selected: Dedicated Producer Inside Classification Handoff

Pros:

- Reuses the same current selected native runtime, persisted profile, and
  stored routing inputs already used for the generic plan.
- Rebuilds queue evidence instead of accepting a cached projection or decision.
- Returns only an audited opaque envelope to the queue completion result.
- Retires direct proof at request/import admission while preserving the
  generic plan's separate pending-question persistence role.
- Keeps every producer side effect explicitly false.

Cons:

- Adds a small producer module and queue-specific classification method.
- Generic and queue reductions are both calculated in memory for the same
  authoritative inputs because they have different downstream contracts.

## Final Recommendation Stack

1. Build native evidence inputs only after a selected library matches a
   validated native runtime candidate.
2. Read only the persisted library profile and stored routing configuration;
   do not call media servers, providers, or quota services.
3. Pass the bounded task context plus fresh evidence input to
   `policyRuntimeQueueQuestionReductionProducer.mjs`.
4. Compose queue evidence admission, queue automation decision, and queue
   question reduction; re-audit each stage before continuing.
5. Return only the ready opaque envelope to queue completion. A blocked result
   returns no proof and causes the established outcome-only fallback.
6. Route queue work through `classificationService.classifyQueueTask`; do not
   accept a queue task context from the normal HTTP classification payload.
7. Pass only `runtimeQueueQuestionReduction` to request/import admission.
   Direct generic plans are explicitly retired there.
8. Keep the existing generic plan internal to pending-question persistence,
   which independently revalidates it before materializing a question.

## Implemented Design

```text
QueueTaskProcessorService
  -> ClassificationService.classifyQueueTask(task, payload)
  -> native classification handoff
       -> current persisted profile + stored routing mapping
       -> generic plan for pending-question persistence only
       -> queue producer
            -> fresh queue evidence admission
            -> queue automation decision
            -> queue question-reduction envelope
  -> request/import destination admission
       -> task/attempt-bound queue admission
       -> request-time learning guard or outcome-only fallback
```

`server/src/services/policyRuntimeQueueQuestionReductionProducer.mjs` is a
pure ES module. It accepts exactly:

```js
{
  task,
  runtimeEvidenceInput,
  routing,
  classification,
  policyEvaluation,
}
```

It returns a ready envelope only when all three existing queue contracts are
ready and audit-valid. It emits neither the task object, task id, queue
payload, profile input, operator signal values, provider data, nor cached
projection/decision data. Blocked results expose no queue proof.

`classificationServiceCore.mjs` adds `classifyQueueTask(task, payload)`. Only
the queue processor calls that method; it narrows the task to `id`, task type,
and attempt before passing it to the native handoff. Queue-mode classification
returns `runtimeQueueQuestionReduction` and sets
`runtimeQuestionReductionPlan` to `null` for the terminal queue result.

`policyRequestImportDestinationAdmission.mjs` accepts queue proof as the sole
terminal proof source. A supplied direct plan is recorded as retired and falls
back to `do_not_learn`; both proof forms together remain ambiguous and also
fall back.

## Security And Outcome

- A queue proof is bound to a hashed task identity, `classification` task type,
  attempt, fresh evidence fingerprint, and execution fingerprint.
- Cached evidence projections and cached automation decisions are rejected by
  the existing queue evidence-admission contract.
- Queue task transport data and runtime evidence inputs cannot appear in the
  producer result or audit.
- Queue proof generation performs no queue mutation, provider call, routing,
  classification execution, question persistence, notification, or learning
  write.
- Invalid, missing, stale, cross-task, cross-attempt, direct, or competing
  proof remains an outcome-only request-time decision.
- The runtime inventory and terminal-route integration audit require this
  producer and its queue-only handoff, preventing silent reintroduction of the
  direct terminal path.

## Verification

Focused tests cover:

- ready opaque production from fresh current inputs;
- rejection of cached evidence and unsupported raw input;
- rejection of raw output exposure and claimed side effects;
- native handoff production without raw task/classification leakage;
- suppression of direct terminal proof in queue-mode classification;
- queue processor use of `classifyQueueTask` and queue-envelope admission;
- request/import fallback for retired direct and competing proof; and
- source-backed terminal-route integration and runtime-completion audits.

## Next Item

Proceed with **Phase 7R.5 request-time learning provenance cutover**: evaluate
the remaining request-time event producers and remove any obsolete
direct-question-proof compatibility inputs that are not required for pending
question persistence. Keep native pending routing outcome-only unless it has a
separate, validated evidence chain.
