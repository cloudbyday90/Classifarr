# Policy Native Pending-Resolution Provenance

## Status

Implemented for canonical `policy.runtime_question_persistence.v1` resolutions.
The browser and Discord both invoke the same authoritative resolver, which now
records a bounded native-selection transition before it records the broader
classification resolution or an eventual routing result.

## Problem

Native pending questions already had two normalized outcomes and a browser-only
alternate-destination path, but the resolver recorded only a generic
`resolved` transition. That lost three distinct facts:

```text
the destination Classifarr suggested
the normalized outcome the operator selected
whether the operator chose another compatible destination
```

Routing happens later and has a different operational result. Treating a
selected destination as a successful route would overstate what has occurred;
treating the result as learning would let a single answer reshape future
policy. Neither is acceptable.

## Official Guidance Reviewed

- [OpenTelemetry semantic conventions for events](https://opentelemetry.io/docs/specs/semconv/general/events/)
  treats a state change or point-in-time occurrence as an event with its own
  timestamp and bounded attributes. A native selection is therefore persisted
  as its own outcome-path transition, not folded into routing or an unstructured
  log message.
- [OpenTelemetry naming guidance](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, lower-case, namespaced identifiers and documented enum
  values. The implementation adds `operator_confirmed_destination` instead of
  mislabeling an operator confirmation as a requester choice.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends minimizing, masking, or excluding sensitive identifiers and
  secrets. The durable patch contains normalized outcome IDs, destination IDs
  and names already needed for classification, reason codes, and guard summary;
  it excludes raw transport labels, actor identities, question text, provider
  data, and item titles.
- [NIST AI RMF Playbook](https://airc.nist.gov/docs/AI_RMF_Playbook.pdf)
  calls for documented human oversight and traceable controls. The persisted
  selection is explicitly separated from the guard decision and later route
  result, making human action auditable without granting it implicit authority
  over future automation.

## Design

```text
canonical persisted native question
  -> server validates presentation and selection binding
  -> policyNativePendingResolutionProvenance.mjs
       -> confirmation: operator_confirmed_destination
       -> alternate choice: operator_manual_destination_change
       -> validated reduction plan -> request-time learning guard
       -> current outcomes remain outcome-only
  -> classificationOutcomeService records native_pending_resolution transition
  -> resolver records resolved transition
  -> browser or Discord route adapter later records route result separately
```

`policyNativePendingResolutionProvenance.mjs` is pure. It accepts the
server-persisted canonical envelope, classification ID, selected active
compatible destination, and the requested option label. It validates the label
only against the envelope-derived presentation:

1. `Resolve current item` maps to `resolve_current_item` only at the suggested
   destination.
2. `Do not learn` maps to `do_not_learn` only at the suggested destination.
3. `Choose another destination` maps to a reversible
   `operator_manual_destination_change` and remains `do_not_learn`.

Anything else is not an authorized normalized outcome. The provenance audit
fails, the authoritative resolver returns a retry-safe conflict, and the
transaction rolls back before it can clear the pending question.

For a complete fingerprint-bound plan, the adapter uses the existing
`policyRequestTimeLearning.mjs` reducer. A tampered or incomplete plan does not
block a valid item-resolution action, but it cannot create a request-time
learning decision: the adapter uses the learning guard directly and keeps the
result outcome-only. This preserves the item workflow while failing closed for
future automation evidence.

The resolver writes the compact `native_pending_resolution` outcome-path
transition in its existing transaction before updating the classification to
`completed`. If this write cannot be confirmed, the transaction fails rather
than producing an untraceable resolution. It then retains the existing
`resolved` transition. Neither transition claims routing success.

The old Discord-only post-route learning adapter was removed. It duplicated the
guard evaluation after routing and created two possible provenance readings for
the same selection. Discord now receives the resolver-owned bounded result and
logs only its stable identifiers.

## Security And Behavior Guarantees

1. The client and Discord cannot authorize outcomes from a visible label; the
   resolver validates it against the current persisted envelope.
2. An alternate destination is accepted only after existing active-library,
   media-type, stale-question, and transaction checks; it is recorded as an
   explicit manual change rather than a confirmation of the suggested library.
3. The request-time event uses only documented enum IDs and a classification
   correlation ID. It omits actor IDs, raw answer labels, title text, prompt
   content, provider state, quota data, and routing details.
4. Both current native outcomes remain outcome-only. The adapter cannot write
   policy evidence, queue a profile refresh, call a provider, consume quota, or
   route media.
5. A malformed native presentation fails closed instead of falling through to
   a legacy rule-generation or manual-label path.
6. The selection and route transitions remain separate so missing mappings and
   later routing failures cannot be interpreted as destination evidence.

## Recommendations

1. Keep `operator_confirmed_destination` distinct from
   `user_requested_destination`; they express different authorities.
2. Persist the compact selection transition in the same transaction as native
   resolution, and fail the resolution when that provenance cannot be stored.
3. Keep the current native outcomes explicitly outcome-only until a future
   question contract defines a reviewed, tier-specific learning action and its
   dedicated persistence adapter.
4. Record route success and missing-mapping outcomes only after the actual route
   adapter returns, as separate transitions that cannot write learning directly.
5. Remove transport-specific policy guard adapters when a generic authoritative
   resolver owns the same decision, rather than maintaining two acceptance
   paths.

## Pros And Cons

Pros:

- Separates suggested, selected, alternate, resolved, and routed facts.
- Uses existing guarded request-time infrastructure instead of a second policy
  learning channel.
- Gives browser and Discord exactly one authoritative behavior.
- Fails closed on malformed native selections while preserving a safe
  outcome-only fallback for invalid proof.

Cons:

- Adds one compact transition to outcome history for every native resolution.
- Historical malformed native envelopes now require retry instead of accepting
  a direct resolution request.
- Route-result provenance remains a separate follow-up because routing occurs
  outside the resolution transaction.

## Final Recommendation Stack

1. `policyRuntimeQuestionPersistenceAdmission.mjs` creates the canonical
   fingerprint-bound native question.
2. `policyNativePendingQuestionPresentation.mjs` derives the allowed display
   actions from that envelope.
3. `policyNativePendingResolutionProvenance.mjs` validates and normalizes the
   selected action and alternate destination.
4. `policyRequestTimeLearning.mjs` evaluates a valid native selection through
   the existing learning guard.
5. `classificationOutcomeService.mjs` persists the bounded selection transition
   before the generic resolution transition.
6. Route adapters record their actual result later and must not conflate it
   with the selection.

## Verification

Focused server coverage verifies:

- confirmation and `do_not_learn` selections;
- alternate destination provenance and reversibility;
- fingerprint-drifted plans remaining outcome-only;
- rejection of a forged alternate-destination label;
- raw label and actor exclusion from the durable patch;
- no direct side effect claim; and
- resolver ordering: native provenance transition, then final resolution.

## Follow-Through

The native pending-route outcome adapter is now implemented in
[Policy Native Pending-Route Outcome Adapter](policy-native-pending-route-outcome.md).
Browser and Discord append a third, outcome-only transition only after their
routing adapters return an actual successful route or a confirmed missing
mapping. Completion remains distinct from routing, and transient failures do
not become policy evidence.
