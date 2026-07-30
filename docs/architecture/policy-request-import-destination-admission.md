# Policy Request/Import Destination Admission

## Status

Implemented for request-origin classification queue tasks.

The admission adapter records a bounded terminal routing outcome for `webhook`
and `manual` request/import tasks. It does not infer that a requester selected
the routed destination, and it does not create policy evidence, schedule a
profile refresh, or perform any provider, quota, route, or learning write.

## Problem

The queue already knew a request task's source, classification result, selected
library, and Arr routing result, but it had no bounded bridge to the native
request-time contract. It also treated `result.library` as an object while the
classification service returned it as a string, so `webhook_log` could lose the
routed library name even after a successful classification.

A request webhook or manual submission is an intake event, not evidence that a
user chose a destination. Treating the selected library as a requester choice
would conflate independent facts and let transport payloads manufacture future
policy evidence.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side state transitions and re-deriving security-relevant
  values rather than trusting client-controlled workflow state. The adapter
  uses only the post-classification, server-owned destination and route state.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for secure design practices throughout the development lifecycle. The
  adapter uses a narrow, tested contract with explicit negative cases rather
  than adding learning behavior to the queue processor ad hoc.
- [OpenTelemetry General Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends stable, precise, lower-case namespacing. The admission contract
  uses `policy.request_import_destination_admission.v1` and bounded reason
  identifiers rather than free-form status text.

## Design

```text
authenticated webhook or manual request
  -> queued classification task (source is webhook or manual)
  -> server-owned classification result and Arr routing result
  -> request/import destination admission
       -> terminal routed or missing-mapping outcome only
       -> Policy Learning Guard with do_not_learn
       -> bounded completed-task result
```

`server/src/services/policyRequestImportDestinationAdmission.mjs` is a pure
ES-module service. It accepts only:

- the queue task source and task identifier;
- the server-created classification identifier;
- the normalized selected library; and
- a server-created routing summary and, when present, one opaque
  `policy.runtime_queue_question_reduction.v1` envelope.

It never reads the request payload, title, requester identity, raw provider
output, or routing error text. Only the following terminal states are admitted:

- `route_succeeded` when Arr reports a successful route; and
- `route_failed_missing_mapping` when routing evaluates to `no_mapping` or
  `missing_arr_id`.

Other states, including a below-threshold classification and transport sources
outside `webhook` and `manual`, are explicitly `not_applicable`.

When a valid queue question-reduction envelope is supplied, the adapter first
binds it to the current classification task and attempt through
`policyRequestTimeQueueQuestionReduction.mjs`, then invokes the request-time
reducer. The live queue derives that envelope from declared native intent,
persisted library-profile evidence, and stored routing configuration during the
same classification run. Legacy, mismatched, malformed, stale, or direct-plan
proof remains outcome-only through canonical learning intake and a
`do_not_learn` learning-guard decision; the adapter does not synthesize
evidence from a legacy result or label. The producer design record is [Policy
Runtime Queue Question-Reduction Producer](policy-runtime-queue-question-reduction-producer.md).

The terminal-route integration audit confirms this is the current live
request/import proof path. The queue-bound producer is active and direct generic
plans are retired at this terminal boundary. The audit and its caller inventory
are documented in [Policy Request-Time Terminal-Route Integration Audit](policy-request-time-terminal-route-integration-audit.md).

The queue stores the bounded admission result in the existing completed task
payload after the classification path has already persisted the classification
history and routing outcome. It also normalizes the destination when writing
`webhook_log.routed_to_library`, fixing the existing string-versus-object
result mismatch.

## Recommendations

1. Keep request intake separate from destination selection. Add a future
   `user_requested_destination` event only when a request API actually accepts
   and server-validates a destination choice.
2. Admit only terminal, server-owned routing outcomes. Do not map retries,
   thresholds, provider failures, or free-form errors to native learning
   events.
3. Require a valid task- and attempt-bound queue question-reduction proof
   before calling the request-time reducer. Missing, invalid, stale, direct, or
   competing proof must remain outcome-only.
4. Keep the admission service pure and persist only its bounded summary through
   the existing queue completion path.
5. Maintain the normalized destination result as the single queue-facing
   library representation so webhook history does not depend on legacy result
   shape.

## Pros And Cons

Pros:

- Preserves the distinction between a request, a classified destination, and a
  routed outcome.
- Prevents request payloads and legacy labels from becoming policy authority.
- Records successful and missing-mapping outcomes without enabling direct
  learning or profile refresh.
- Corrects webhook history for classifications that return a library name
  string.
- Is deterministic, side-effect-free, ESM-only, and covered by focused unit
  and queue integration tests.

Cons:

- Legacy, mismatched, and malformed request/import classifications remain
  outcome-only because they cannot supply authoritative native proof.
- The completed task payload is an operational handoff record, not a new
  long-term policy evidence store.
- This does not yet support an explicit requester-selected destination because
  the current request APIs do not expose that product capability.

## Final Recommendation Stack

1. `classificationResultOutcomeSummary.mjs` normalizes the selected destination
   and excludes raw routing errors.
2. `policyNativeClassificationQuestionHandoff.mjs` derives current native
   inputs only from the selected candidate, persisted library profile, and
   stored routing mapping.
3. `policyRuntimeQueueQuestionReductionProducer.mjs` builds one opaque queue
   proof from those current inputs.
4. `classificationServiceCore.mjs` returns queue proof only through its
   queue-specific classification method while retaining the generic plan for
   pending-question persistence.
5. `policyRequestImportDestinationAdmission.mjs` maps only terminal
   request/import outcomes, evaluates the learning guard, and enforces
   outcome-only behavior unless valid queue proof exists.
6. `queueTaskProcessorService.mjs` stores the bounded result with task
   completion and writes the normalized destination name to webhook history.
7. `policyRequestTimeLearning.mjs` remains the sole request-time reducer when
   valid queue proof is available.
8. `policyRequestTimeTerminalRouteIntegrationAudit.mjs` prevents current
   request/import and native pending terminal-route callers from silently
   losing their guarded proof or outcome-only fallback.

## Verification

Focused tests cover successful route admission, missing Arr mapping, absent,
direct, competing, stale, and tampered queue proof, ignored
non-request/unfinished states, queue result persistence, and webhook
library-name persistence.

## Next Step

Proceed with **Phase 7R.5 request-time learning provenance cutover**. Audit
remaining request-time producers and retire obsolete direct-proof compatibility
inputs without changing the independent pending-question persistence boundary.
