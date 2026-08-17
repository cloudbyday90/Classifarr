# Native Intent Change Idempotency Receipts

## Status

Implemented as roadmap task **12R.6 Native Intent Change Idempotency
Receipts** on 2026-08-16.

## Problem

An administrator can submit a legitimate, revision-bound native intent change
and lose the HTTP response after PostgreSQL commits it. Retrying that request
with a new key could create another native intent revision. Treating browser
state, a generic policy reread, AI output, or an old compatibility payload as
proof of commit would weaken the native-authority boundary.

## Research

The [IETF Idempotency-Key header draft](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header)
defines the useful baseline: a client sends a unique key, a server binds it to
the request semantics, and a completed matching repeat returns the original
result. The draft was archived when reviewed, so this implementation uses it
as interoperable guidance rather than as a final standard.

[Stripe's idempotent-request guidance](https://docs.stripe.com/api/idempotent_requests?lang=curl)
supports retaining the first result only after execution begins, rejecting
different parameters for a reused key, and retrying when a response may have
been lost. PostgreSQL's [transaction-isolation documentation](https://www.postgresql.org/docs/current/transaction-iso.html)
and [explicit-locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html)
support keeping the mutation and its receipt atomic while using a scoped lock
to coordinate concurrent attempts.

## Decision

Use one short-lived browser-generated `Idempotency-Key` for a single unchanged
native purpose-change attempt. The server persists a compact immutable receipt
only after the transaction has created the next native intent revision and its
migration event.

The receipt binds:

- authenticated administrator ID;
- policy ID;
- expected source revision;
- SHA-256 fingerprint of the server-admitted canonical commands;
- target native intent ID and version;
- migration event ID;
- allow-listed applied command IDs; and
- fixed `applied` result status and receipt version.

It deliberately excludes rule values, compatibility data, library profiles,
classification history, RAG, routing content, provider output, AI output, and
the raw HTTP request body.

## Request And Replay Contract

`POST /api/policies/:id/native-intent/changes` now requires a syntactically
valid `Idempotency-Key` header. The Vue composable creates a cryptographically
random UUID-shaped key, holds it only in form memory, and submits it as a
quoted header value. It never uses local storage, session storage, a cookie,
or a receipt browse endpoint.

Within the write transaction, the server:

1. takes a transaction-scoped advisory lock derived from the key;
2. reads any receipt for that key before locking the policy revision;
3. returns the original bounded applied result if actor, policy, revision, and
   canonical command fingerprint match exactly;
4. returns a bounded `409` when that key is currently in progress;
5. returns a bounded `422` when the key is bound to different semantics; or
6. performs the normal locked revision check, writes the new intent/event, and
   inserts the receipt before the transaction commits.

Malformed, stale, unauthorized, unavailable, incompatible, or rolled-back
requests do not create receipts. A replay reports `change.replayed: true` and
no new storage side effects. Neither the key nor fingerprint is returned to
the browser.

The in-memory key is retained for an ambiguous network or server outcome and
for an in-progress response. It is discarded when the canonical draft or
revision changes, on stale revision, on key reuse, or after a definite applied
result. This prevents accidental reuse for a different intent change while
preserving the only safe retry after response loss.

## Persistence Lifecycle

`policy_native_intent_change_receipts` is append-only. Direct updates and
deletes fail. A replace restore may clear this non-portable operational state
only after setting a transaction-local maintenance permit; the receipt is not
included in configuration backups. A foreign-key cascade that follows deletion
of its parent policy is also allowed, so normal policy deletion does not leave
an unusable application state.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Durable, canonical server receipt | Survives a lost HTTP response, proves the exact committed result, and preserves revision safety. | Adds a compact table, migration, and lifecycle guard. |
| Re-read current revision only | No new persistence. | Cannot prove that the original command committed or return its original result. |
| Persist a browser key in local or session storage | Can survive reload. | Extends retention of operational identifiers in an untrusted client and cannot prove the saved draft is the original request. |
| Issue a new key automatically after failure | Simple client behavior. | Can create a second native intent revision after a committed response-loss request. |
| Store full request, rules, or AI response | Easier forensic reconstruction. | Retains unnecessary policy and provider content outside the authority contract. |

## Recommendation Stack

1. Require a random client key for every native intent mutation.
2. Canonicalize and fingerprint only server-admitted commands, binding the
   fingerprint to actor, policy, and source revision.
3. Use a transaction-scoped advisory lock and a receipt lookup before the
   normal revision lock.
4. Persist the receipt in the same transaction as the new intent and audit
   event; roll back all three on failure.
5. Return bounded replay, in-progress, and key-reuse outcomes without
   exposing keys, fingerprints, rule values, or provider content.
6. Keep retry state in volatile form memory only.
7. Clear operational receipts during replace restore and allow only parent
   policy cascades outside that explicit maintenance path.
8. Do not use the receipt to authorize routing, learning, AI, compatibility
   conversion, or a policy change.

## Verification

Focused unit coverage verifies header parsing, canonical fingerprints,
admission, exact replay, key mismatch, concurrent key handling, and
replace-restore cleanup. Client coverage verifies secure key generation,
header serialization, and same-key retry after a lost response. PostgreSQL
integration coverage verifies one committed revision, one receipt, exact
replay, stale new attempts, and normal policy deletion cleanup.

## Post-Reload Discovery

**12R.7 Authorized Recent Native Intent Change Receipt Discovery** is complete.
It adds a separate administrator-, actor-, and policy-bound 60-minute,
newest-one, read-only status lookup. The projection contains only the fixed
`applied` status and source/target intent revisions, is `no-store`, and never
exposes keys, fingerprints, command values, receipt history, identifiers,
timestamps, raw policy content, or a mutation path. See [Native Intent Change
Recent Receipt Discovery](native-intent-change-recent-receipt-discovery.md).

## Follow-Up

**12R.8 Native Intent Change Receipt Retention And Capacity Guard** must define
the explicit retention, capacity, and transaction-local maintenance-permit
rules for this append-only operational table. It must preserve the replay and
post-reload discovery windows and cannot add a receipt-history browse endpoint.
