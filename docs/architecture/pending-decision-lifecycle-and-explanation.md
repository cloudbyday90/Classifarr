# Pending Decision Lifecycle And Explanation

## Decision

Classifarr treats a pending classification as a deterministic policy outcome,
not as an opaque score or an AI decision. The Command Center receives a
server-derived explanation that identifies the leading destination, policy
score, applicable thresholds, and bounded evidence facts. A verification model
response is an advisory only: it can confirm the candidate, fail to confirm it,
or name a different configured destination, but cannot create a blocking
question, change policy, route media, or replace the deterministic result.

## Evidence

Evidence is the set of bounded, server-derived inputs used by policy scoring:

- declared destination intent and constraints,
- observed destination profile signals,
- matching confirmed classification patterns and prior outcomes, and
- compatible similar-item or RAG evidence.

The policy result compares this evidence with its configured confirmation and
automatic thresholds. A score between those thresholds means that the system
has a leading destination but requires confirmation; it does not mean that
evidence is absent. The UI uses `Policy confirmation required` rather than the
legacy generic `Missing evidence` label in that case.

The persisted `pending_reason` follows the same distinction for deterministic
`prompt_confirm` outcomes. Existing active records are updated by a
forward-only migration; their stored question payloads and audit history remain
unchanged.

## AI Verification Boundary

The verification input contains the current item context, the deterministic
candidate, and the configured candidate destinations. The model is asked to
confirm or challenge that candidate using the response contract.

The persisted and displayed output is deliberately reduced to:

- advisory status,
- deterministic candidate,
- optional configured alternative destination, and
- a bounded server-authored message describing the relationship.

Raw prompts, raw model responses, free-form rationales, and provider details
are not persisted or shown. They are untrusted input and may contain metadata
that is unnecessary for an operator decision. Historic records that only stored
`AI disagreed with suggested classification` cannot recover the proposed
alternative; the UI states that limitation explicitly rather than inventing an
answer.

## Single Active Decision Invariant

`classification_history.pending_identity_key` identifies an active decision in
this order:

1. TMDB media type and ID.
2. Media-server item ID and media type, scoped by its configured media server
   or source library.
3. Source-library ID, normalized title, year, and media type.

There is intentionally no title-only key. A title collision must remain
separately reviewable rather than being merged incorrectly.

For an identified item, persistence acquires a transaction-scoped PostgreSQL
advisory lock, locks active decisions, marks previous actionable rows
`reclassified` with `clarification_status = superseded`, records the successor
in metadata, reads their unresolved notifications, and inserts the new row. A
partial unique index is the durable backstop against concurrent active rows.
The forward-only migration applies the same conservative rule to existing
TMDB-backed rows; it preserves audit rows and notifications rather than
deleting them.

## Research Basis

The implementation follows PostgreSQL's documented use of a partial unique
index to enforce uniqueness only for a subset of rows, transaction-level
advisory locks for short-lived application-defined coordination, and row locks
to serialize updates to the same decision. The bounded AI projection follows
OWASP guidance to validate and sanitize event data and to avoid retaining
unnecessary sensitive data in logs or operator-facing diagnostics.

- [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [PostgreSQL explicit and advisory locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

Retrying while a task is already pending remains an idempotent success. The
Command Center refreshes its data instead of presenting `duplicate_pending_task`
as an operator error.

## Alternatives Considered

### Persist and show raw AI reasoning

Pros: maximal diagnostic detail.

Cons: exposes untrusted content and potentially sensitive metadata, creates an
unstable operator contract, and lets free-form model language appear more
authoritative than deterministic policy evidence.

### Let AI verification veto a deterministic candidate

Pros: a model can surface a possible alternative.

Cons: makes policy outcomes non-deterministic, increases unnecessary pending
work, and violates the provider authority boundary.

### Delete duplicate pending rows

Pros: simple presentation cleanup.

Cons: destroys audit history and can silently hide a lifecycle fault.

## Recommended Stack

- Deterministic policy evidence and thresholds own the decision state.
- A transactional lifecycle service and partial unique index own the active
  pending-decision invariant.
- The answer contract projects a bounded explanation for the Command Center.
- AI verification is normalized to a privacy-bounded advisory with no policy or
  routing authority.
- Existing records are migrated conservatively and retain their audit trail.
