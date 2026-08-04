# Policy Runtime Pending-Question Cleanup Apply

**Status:** Implemented for Phase 5R.7.3 on 2026-08-04.

## Purpose

Apply a selected, bounded set of pending-question cleanup plans without
trusting browser-supplied actions, question content, AI/provider content, or
legacy clarification text. This is the write-side companion to the dry-run
inventory in
[Policy Runtime Pending-Question Cleanup Inventory](policy-runtime-pending-question-cleanup-inventory.md).

## Decision

The apply API accepts only `classificationIds` (1-100 unique positive IDs).
It accepts neither an action nor a dry-run report as authority. The server
sorts the IDs, starts one transaction, locks each `classification_history` row
with `FOR UPDATE`, reloads current context, and rebuilds the cleanup plan
before it changes that row.

| Re-evaluated action | Apply behavior |
| --- | --- |
| `regenerate_under_current_contract`, `mark_stale_require_retry`, or `block_learning_permanently` | Delete stored clarification responses, clear `policy_question` and `clarification_response`, reset the retry budget, and place the row in `pending_retry` for the existing automatic fresh-runtime evaluation path. |
| `resolve_outcome_only` | Replay only a versioned, fingerprint-bound runtime answer that still validates against the locked question and an active, matching destination. Write the final outcome without a learning command. Invalid, stale, unavailable, or non-resolution answers become a fresh-runtime retry instead. |
| `none` | Leave the classification unchanged and write a compact audit receipt. |

The apply path does not reconstruct an answer from a free-form legacy response.
It never writes learning evidence. The existing retry scheduler performs the
subsequent full runtime evaluation, which prevents a fresh question from being
manufactured out of obsolete persisted data.

## Audit Record

`policy_runtime_pending_question_cleanup_audits` is append-only. Each applied
existing classification produces one record containing only:

- classification ID;
- server-derived action ID and bounded reason IDs;
- cleanup-plan source version;
- normalized server actor ID;
- result status ID; and
- a server-generated UUID replay receipt.

The migration constrains identifiers and reason ID shape/size and prevents
updates or deletes. It deliberately does not store question text, selected
labels, AI rationale, provider output, metadata, or clarification response
content. It also has no foreign key to runtime classification history so
restore or retention operations are not blocked by a runtime receipt.

## Security Research And Options

Official guidance supports validating authorization and workflow state on the
server instead of relying on a client-controlled sequence, rejecting unknown
input, and retaining audit data without sensitive payloads. PostgreSQL documents
that `FOR UPDATE` prevents concurrent writers and lockers for the locked row,
and recommends a consistent order when taking multiple locks to reduce
deadlocks. [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
and [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
support the admission boundary; [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
supports the row-lock design.

| Option | Pros | Cons |
| --- | --- | --- |
| Trust browser-selected action or a dry-run payload | Small implementation | Enables stale/out-of-order writes and client-controlled cleanup semantics. Rejected. |
| Regenerate from persisted question or clarification text | Immediate-looking result | Reuses stale or unsafe input and can recreate the retired free-form workflow. Rejected. |
| Lock, recompute, then queue the existing automatic runtime retry | Uses authoritative current state, clears unsafe data, and remains platform/library agnostic | Fresh evaluation is asynchronous and depends on the existing scheduler. Selected. |
| Lock, recompute, and replay only a still-valid answer contract | Safely completes interrupted proven outcomes without learning | Applies only when the structured contract, fingerprint, destination, and current state all still validate. Selected as a narrow branch. |

## Final Recommendation Stack

1. Keep the administrator and read-write boundary on the endpoint, and accept
   only selected classification IDs.
2. Lock in ascending classification ID order, regenerate the server plan inside
   the transaction, and treat any changed/invalid state as stale.
3. Route stale or unsafe records through the existing automatic retry queue;
   never regenerate from persisted free-form content.
4. Permit outcome-only replay only after exact runtime-contract and destination
   validation, with learning disabled.
5. Retain only bounded, append-only audit identifiers and receipts. Test
   interrupted, duplicate, cross-library, authorization, and migration cases in
   Phase 5R.7.4.

## Verification

Focused server tests cover stable lock order, fresh-runtime queueing, stale
answer fallback, valid outcome-only replay, no-learning behavior, request-body
allow-listing, authorization, and no-cache responses.
