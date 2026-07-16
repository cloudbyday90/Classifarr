# Native Policy Initial-Establishment Transition

## Status

Implemented on 2026-07-16 for Policy Builder roadmap task 8R.3.2.10.2.

## Problem

An empty compatibility policy has no legacy preset configuration that can be
converted into native intent. It is therefore not safe for the scheduler,
library profile, metadata, RAG, or AI output to infer its first durable policy
meaning. At the same time, an operator needs a narrow, reversible path to
establish a policy intentionally.

The transition must not turn observed library content into an implicit policy,
overwrite a concurrent legacy change, create more than one first native intent,
or start an external routing action.

## Research

OWASP recommends that state-changing authorization is enforced server-side and
rechecked immediately before execution, so a client cannot bypass or alter the
authorization path. [Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)

For state transitions, OWASP also recommends explicit server-side workflow
state, an idempotency record for retried non-idempotent actions, and atomic
check-and-write operations with locks or transactions. [Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)

PostgreSQL documents that `SELECT FOR UPDATE` serializes conflicting row
writers until the transaction completes. That is appropriate here because the
authority decision is scoped to one policy and its configuration rows rather
than requiring a global serializable transaction. [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)

## Options

### 1. Infer first intent from the library profile

Pros: no operator action and a short setup path.

Cons: current placement, metadata, and AI evidence are observations, not
authority. This silently freezes historical mistakes as policy and violates the
native-authority vocabulary.

Decision: rejected.

### 2. Reuse legacy conversion persistence

Pros: less new code.

Cons: the conversion path assumes attached legacy presets, a materializable
legacy contract, and conversion-specific audit semantics. Reusing it would
blur initial establishment with migration and weaken reversion evidence.

Decision: rejected.

### 3. Explicit operator-declared initial transition

Pros: clear authority source, minimal request data, final transactional
revalidation, idempotency, bounded rollback, and no automatic external work.

Cons: an authenticated administrator must explicitly establish the first
policy meaning.

Decision: adopted.

## Final Recommendation Stack

1. Accept only a small, strict `declared_intent` DTO: purpose, hard limits,
   helpful hints, and avoid rules. It does not accept profile observations,
   starter templates, AI output, arbitrary provenance, or client actor IDs.
2. Derive the authority source, native header source, inference state, review
   behavior, rule roles, and actor from trusted server data.
3. In one transaction, lock the policy, idempotency record, legacy preset and
   override rows, native-intent history, and routing mapping. Revalidate all
   eligibility conditions after the locks are held.
4. Allow establishment only when there are no legacy preset attachments,
   policy overrides, prior native intents, or earlier establishment records.
5. Persist a dedicated idempotency and authority record, native header/rules,
   validation record, routing configuration snapshot, migration event, and
   bounded compatibility rollback snapshot atomically.
6. Copy routing configuration only. Do not invoke an ARR API, route an item,
   launch classification, consume an external quota, or start learning.
7. Preserve the authority record through backups and block a second first-
   establishment attempt after rollback. Future replacement intent work must
   use its own authority transition.

## Implementation

`policyInitialIntentEstablishmentContract.mjs` validates and fingerprints the
small declared-intent request. Its full native contract is server-built with
`source: native_intent`, `inference_state: inferred`, and rule source
`operator_declared_intent`.

`policyInitialIntentEstablishmentService.mjs` owns the transition. It returns
only bounded result identifiers and never exposes the request, profile data,
snapshot payload, or database error.

`policy_initial_intent_establishments` records the one-time establishment,
idempotency key, request fingerprint, operator, native intent, migration event,
and rollback snapshot. The only durable final state is `established`; a
transaction rollback leaves no partial row.

`POST /api/policies/:id/native-intent/initial-establishment` is admin-only and
derives the operator identity from the authenticated request. It is an
integration boundary, not a normal policy-builder save action. A later
readiness surface may invoke it only after showing the exact declared rules and
the no-legacy-configuration condition.

## Edge Cases

| Condition | Outcome |
| --- | --- |
| Client submits profile, template, AI, provenance, or actor fields | Strict request validation rejects the request. |
| Same key and same actor, policy, and declaration | Returns the bounded original result without a second write. |
| Same key with different policy, actor, or declaration | Blocks as idempotency-key reuse. |
| Attached legacy preset or policy override | Blocks; ordinary conversion or maintenance remains responsible. |
| Active or historical native intent | Blocks; this is not a replacement mechanism. |
| Concurrent legacy update or establishment request | Policy and configuration row locks force final revalidation. |
| Missing routing mapping | Persists `missing` routing readiness only; no routing occurs. |
| Any late database write fails | The transaction rolls back header, rules, snapshot, audit, and reservation. |
| Operator reverts the snapshot | Existing reversion deactivates native authority, marks the snapshot restored, and creates a reconciliation hold. A second first-establishment remains blocked by its durable record. |

## Security and Privacy

The route derives the administrator identity from server-side authentication and
does not trust request-provided actor fields. The transition stores only
bounded identifiers and a SHA-256 declaration fingerprint in its audit event.
No library profile distribution, media title, prompt, RAG payload, AI output,
or raw idempotency key is written to the migration event or returned by the
API.

## Follow-up

Task 8R.3.2.10.3 should add a read-only initial-establishment readiness model
and recovery diagnostics. It must explain why a policy is eligible or blocked,
surface a bounded declared-rule summary, and keep the actual authority action
separate from observed library suggestions.
