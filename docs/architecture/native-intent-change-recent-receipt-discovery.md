# Native Intent Change Recent Receipt Discovery

## Status

Implemented as roadmap task **12R.7 Authorized Recent Native Intent Change
Receipt Discovery** on 2026-08-16.

## Problem

An administrator can safely replay an unchanged native intent change while the
purpose-maintenance form remains mounted, but an HTTP response loss followed by
a reload clears the volatile browser idempotency key. A generic policy reread
cannot prove that a change by the current administrator committed, while a
receipt-history endpoint would expose operational data beyond the recovery
need.

The recovery path must therefore state only whether this administrator made one
recent, committed change to this policy. It cannot reveal a key, command,
receipt identifier, timestamp, raw policy content, AI content, compatibility
data, route state, learning state, or any mutation authority.

## Research

[OWASP API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
and the [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
recommend server-side authorization for every object request and deny-by-default
least privilege. [OWASP API3:2023 Broken Object Property Level
Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
also supports an allow-listed response projection rather than returning a
persistence model.

[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines `GET` as a
safe retrieval method. [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html)
defines `no-store` as the response directive for preventing caches from storing
the request or response. PostgreSQL's [SET
TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)
reference supports the fixed repeatable-read, read-only database boundary.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Separate actor- and policy-bound newest-one reader | Recovers one useful status after reload, preserves least privilege, and contains the data surface. | Adds a narrow endpoint and a small client read. |
| Reuse the idempotency replay reader | Less code. | Makes keys, fingerprints, and applied command data reachable from a status read. Rejected. |
| Browser `localStorage` or `sessionStorage` | Fast same-browser indication. | Retains operational state in an untrusted client and cannot enforce server ownership. Rejected. |
| Administrator receipt history | Supports broader investigation. | Creates pagination, retention, and cross-operator disclosure concerns outside this recovery task. Rejected. |
| Generic policy reread | No receipt endpoint. | Does not establish that the current actor made the change or that the observed revision is the receipt outcome. Rejected. |

## Final Recommendation Stack

1. Require an authenticated administrator and a stable positive actor ID before
   the lookup; derive both actor and policy scope on the server.
2. Accept no query parameters, cursor, actor, window, receipt ID, or other
   caller-controlled selection criteria.
3. Read at most one `applied` receipt for that actor and policy from the fixed
   60-minute server window in a repeatable-read, read-only transaction.
4. Project only `resultStatusId`, `sourceIntentVersion`, and
   `targetIntentVersion`, or `recentChange: null`.
5. Mark the successful response `Cache-Control: no-store`; the browser keeps
   the status in component memory only.
6. Treat discovery as an informational recovery hint. It never replays a
   mutation, calls an AI provider, selects a route, changes learning, or
   grants policy authority.

## Implemented Design

`policyNativeIntentChangeRecentReceiptDiscoveryPersistence.mjs` owns the
separate three-column projection from
`policy_native_intent_change_receipts`. Its indexed lookup filters by the
server-derived `actor_id` and `policy_id`, fixed applied status, and the fixed
server window before selecting the newest single row. It cannot load an
idempotency key, fingerprint, rule values, receipt ID, event ID, timestamps, or
raw policy data because those fields are absent from the query projection.

`policyNativeIntentChangeRecentReceiptDiscoveryService.mjs` owns the
repeatable-read, read-only transaction and converts a qualifying row into the
validated read-only contract. Invalid rows and database failures fail closed to
a bounded unavailable result.

`GET /api/policies/:id/native-intent/change-receipts/recent` is
administrator-only and rejects malformed IDs, missing stable actor identity,
and every query parameter. Its only successful response is the validated
contract and `Cache-Control: no-store`.

The purpose-maintenance composable makes the read after it has loaded the
current server-owned native purpose. A qualifying result adds a passive notice
that a recent change by the current account reached a target revision. The
notice contains no retry control, receipt reference, timestamp, command, or
other persisted value; a just-applied change refreshes authority without
running discovery again.

## Verification

Focused tests cover the exact SQL projection and fixed window, transaction
mode, malformed storage result fail-closed handling, administrator and actor
authorization, query rejection, no-store response behavior, client contract
validation, and the passive UI notice. PostgreSQL integration coverage proves a
real committed native-purpose receipt is discoverable only through the bounded
actor-and-policy lookup.

## Follow-Up

**12R.8 Native Intent Change Receipt Retention And Capacity Guard** is the
next task. It must define an explicit bounded retention and maintenance permit
for operational receipts without deleting a record still required by replay or
recent-status discovery, adding receipt history enumeration, or treating
cleanup as routing, learning, AI, or policy authority.
