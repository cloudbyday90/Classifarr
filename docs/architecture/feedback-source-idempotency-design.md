# Feedback source binding and retry protection: design

## Decision

Follow the [evaluation coverage outcome](feedback-evaluation-coverage-outcome.md)
by binding standalone feedback to a stored classification event. The authenticated
`POST /api/feedback` endpoint currently trusts submitted metadata and original
candidates, and a repeated request can create another vote. No frontend component
currently calls this endpoint.

Require `classification_id`, `selected_library_id` and `selected_policy_id`. Accept
only optional bounded `user_reason` and `user_reason_text` annotations alongside
those IDs. Reject unknown fields instead of silently accepting caller-supplied
candidate evidence. Source title, media identity, metadata, scores and creation
time come from locked classification history. Only completed, verified or routed
events are accepted here; pending decisions use the existing prompt workflow.
Source creation time must be finite and nonfuture; it cannot be replaced with now.
Missing original candidate metadata stays unknown rather than being reconstructed
from the current library assignment. Selected libraries must be active and match
the event media type; selected policies must belong to them.

## Transaction and durable identity

Add a small `policy_feedback_sources` ledger keyed by the classification's bigint
ID. It records the intake kind, normalized request fingerprint, feedback ID and
creation time. A unique source key enforces one feedback observation per event
across standalone intake and new prompt responses. Different classification events
for the same media remain distinct observations.

Standalone creation locks policy, selected library and history in the existing
policy-first order, rechecks the ledger after the history lock, then writes feedback,
learning statistics and the source receipt in one transaction. Exact normalized
retries return the existing feedback ID with HTTP 200 and `replayed: true`; creation
returns 201 and `replayed: false`. Different choices or annotations, a receipt from
the prompt workflow, or a deleted feedback result produce HTTP 409 with a stable
error code. No automatic transport retry is introduced.

Receipts intentionally survive history retention: the source ID is checked against
locked history at creation, but has no cascading history foreign key. A feedback
foreign key uses `ON DELETE SET NULL`, leaving a tombstone that prevents recreating
a deleted vote. Do not guess source IDs for historical feedback. This closes new
ingress duplication without asserting historical independent labels or rewriting
legacy observations. Source history remains mutable elsewhere; accepted feedback
stores the evidence as observed at intake, and a replay does not reinterpret it.

## Modular implementation and security

Use separate ESM modules for input normalization, source receipts and standalone
orchestration. Reuse the classification projection and the transaction-aware
feedback writer. Prompt persistence registers its receipt inside its existing
transaction and retains its existing response/replay contract. Add a named client
API leaf function and contract tests; no new operator form is needed.

Keep the existing authentication boundary, strict ID/text bounds, parameterized SQL
and server-owned evidence projection. A source ID is an identity, not an independent
review label. No additional routing or pattern-write authority is granted. W3C
provenance guidance informs the linkage; this change does not implement RDF or
claim W3C conformance.

## Official research and alternatives

URLs were discovered through GitHub MCP and web search/open tools on 2026-09-07 UTC.
The design uses guidance available by August 2026; live documentation is not an
archived August snapshot.

| Official source | Application |
| --- | --- |
| [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | POST needs an explicit application retry contract; a conflict must not silently change a saved decision. |
| [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) | Unique source identity and a retained receipt enforce integrity beyond an application existence check. |
| [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html) | Use row locks and a consistent acquisition order to serialize competing state changes. |
| [W3C PROV Data Model](https://www.w3.org/TR/prov-dm/) | Identify the source event and preserve derivation information for evaluating evidence quality. |

| Option | Pros | Cons |
| --- | --- | --- |
| Caller-generated retry key only | Familiar and flexible | Different keys can duplicate one event; evidence remains caller-controlled. |
| Dedupe by media ID | Small index | Collapses genuinely different classification events. |
| Unique source receipt (selected) | Automatic identity, durable retries, shared workflow protection | New ledger and stricter external API contract; legacy source IDs remain unknown. |
| Manual review on every intake | More explicit review opportunities | Adds operator work without solving duplicate transport writes. |

Recommended stack: stored source event → strict request projection → transactional
receipt and feedback → current evaluated coverage → existing reviewed suggestions.
Validate concurrency, conflicts, rollback, deletion/retention, unknown candidates
and cross-workflow replay against PostgreSQL. Record results separately in the
[outcome document](feedback-source-idempotency-outcome.md).
