# Policy Library Pending-Answer Evidence Collector

## Status

Implemented as the read-only resolved-answer collector for the policy evidence
envelope.

The collector reads only bounded, destination-library-scoped proof that a
pending policy question was resolved. It emits a fixed resolved state,
timestamp, and stable source key. It does not return the answer text, selected
library label, responder identity, Discord payload, question text, metadata
JSON, or a learning decision.

## Problem

An operator resolving a pending item is meaningful evidence, but it is not an
automatic policy-learning event. The current web and Discord policy-resolution
path records a `resolved` / `policy_question` outcome transition in
`classification_history`. A legacy Discord fallback records a resolved
clarification marker and response JSON on the same row. The evidence engine
needs a small, secure way to observe those decisions without turning the
envelope into a database query service or exposing answer content.

Generic records in `clarification_responses` are intentionally excluded. They
record responses to configurable clarification questions, but do not by
themselves establish a final destination decision. They remain separate from
this resolved pending-item contract until the learning guard can evaluate their
semantics explicitly.

## Official Guidance Reviewed

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
  recommends parameterized queries. The collector uses fixed SQL with bound
  library ID, allow-listed final statuses, resolution-transition marker, and row
  limit.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allow-list validation. Only a positive integer library
  ID and a server-owned final-status list are accepted.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends minimizing and sanitizing event data. The collector neither selects
  nor returns raw answer, user, question, title, or metadata values.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports documented provenance and verification. Stable evidence keys,
  timestamps, bounded results, and an audit make this source inspectable without
  making it authoritative learning.

## Recommendations

1. Use `classification_history` outcome transitions as the primary proof of a
   resolved policy question because both current UI and Discord resolution use
   that shared service path.
2. Retain a narrow legacy Discord fallback: a resolved clarification status plus
   a non-null response marker. Do not deserialize or return that JSON.
3. Exclude generic `clarification_responses` until a later learning contract
   establishes which question types can influence a destination.
4. Read at most 51 rows and emit at most 50 records so truncation remains
   explicit and bounded.
5. Emit every answer into `insufficient_evidence`; the learning guard, not the
   collector or evidence engine, decides whether it is eligible for durable
   learning.

## Pros And Cons

Pros:

- Covers current web and Discord resolution through their shared persisted
  outcome record.
- Preserves legacy Discord visibility without retaining legacy response content
  in the evidence contract.
- Keeps answer evidence review-only and bounded.
- Avoids provider calls, refreshes, routing, policy writes, and learning writes.

Cons:

- Generic clarification survey answers are intentionally unavailable to this
  collector.
- The collector proves resolution occurred but does not describe why the
  selected destination was correct.
- Legacy fallback records are less structured than the outcome-transition path;
  their output remains the same fixed resolved marker.

## Final Recommendation Stack

1. `policyLibraryPendingAnswerEvidenceCollector.mjs` reads persisted resolution
   proof only.
2. `policyEvidenceEnvelope.mjs` receives bounded `pendingItemAnswers`.
3. `policyEvidenceBoundary.mjs` projects those records as insufficient evidence.
4. The learning guard later evaluates eligibility, reversibility, and operator
   authority before any durable policy update.

## Implementation Outcome

The collector returns:

```text
pendingItemAnswers[]
summary
sideEffects
```

Each record has a stable classification-based key, static `resolved` value,
timestamp, and `persisted_pending_answer_requires_learning_guard` reason ID.
The output intentionally carries no answer content. Query failures return a
generic stable risk ID without database error text.

## Security Outcome

- All variable SQL values are parameterized.
- The query is fixed, read-only, destination-library-scoped, and bounded.
- Raw response JSON is checked only for legacy presence and is never selected.
- Answer text, selected-label text, Discord identity, question content, title,
  and metadata payloads are excluded.
- The collector has no provider, quota, media-server, policy-storage, or
  learning side effect.
- The audit rejects summary drift and claimed unsafe side effects.

## Next Step

Implement a separate read-only collector for Arr routing outcomes. It should
distinguish successful, blocked, and skipped routing from the persisted route
records, keep raw request/response payloads out of the evidence contract, and
provide routing evidence to the same envelope.
