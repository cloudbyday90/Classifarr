# Native Policy Initial-Establishment Readiness

## Status

Implemented on 2026-07-16 for Policy Builder roadmap task 8R.3.2.10.3.

## Problem

The first-native-intent transition intentionally rejects library observations,
metadata, RAG results, and AI output as policy authority. An administrator still
needs a concise way to determine whether the transition is available, whether a
previous attempt was recorded or reverted, and which declared rules became
durable authority.

The surface must not grow into another policy editor or make a past manual
action look repeatable. It also must not reveal idempotency keys, request
fingerprints, actor identities, migration metadata, rollback payloads, media
items, observed profile data, routing paths, prompts, or AI data.

## Research

OWASP requires transaction authorization and allowed state transitions to be
enforced server-side. A read surface therefore reports server-owned state only;
it does not accept client claims about eligibility, recovery, or authorization.
[Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)

The IETF Idempotency-Key draft defines a key as a unique retry identifier and
states that it must not be reused with a different payload. The readiness
surface reports that a durable idempotency record exists but never returns the
key or its request fingerprint.
[Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header)

OWASP logging guidance distinguishes transaction/audit trails from security
logs, recommends recording the relevant who/what/when for sensitive actions,
and advises masking or excluding secrets and sensitive data. The endpoint logs
only stable policy and state identifiers, not declared values or recovery
payloads. [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options

### 1. Reuse the policy detail or editor payload

Pros: no new endpoint.

Cons: policy detail includes unrelated compatibility and product projections;
an editor encourages changing data merely to understand state. It also makes it
easy to mix observed-library suggestions with durable authority.

Decision: rejected.

### 2. Return a generic eligible or blocked flag

Pros: a very small response.

Cons: it cannot explain whether a blocked policy has legacy configuration,
native history, a prior first-establishment record, a restored snapshot, or a
recovery condition. Operators would still need database or log access.

Decision: rejected.

### 3. Admin-only bounded readiness and recovery read model

Pros: exposes the exact declared-rule groups, stable recovery IDs, attachment
counts, and state-derived blockers without making any changes or revealing
sensitive transaction data.

Cons: adds a focused endpoint and requires a separate replacement-authority
workflow for later native-intent changes.

Decision: adopted.

## Final Recommendation Stack

1. Read a single policy's first-establishment state through an admin-only,
   side-effect-free endpoint.
2. Report only legacy attachment counts, native-intent counts, stable
   establishment/intent/snapshot IDs, normalized timestamps, and server-owned
   status identifiers.
3. Report a recorded idempotency state, never an idempotency key or request
   fingerprint.
4. Validate persisted declared rules again before returning their exact
   purpose, hard-limit, helpful-hint, and avoid groups. Fail closed to a
   bounded invalid-summary state if storage is malformed or oversized.
5. Describe rollback availability, expiry, payload redaction, inactivity, and
   completed reversion without returning a rollback payload.
6. Log only the policy ID, status, eligibility boolean, and recovery state.
   The GET endpoint never writes, locks rows for update, invokes Arr, starts
   classification, or starts learning.

## API Contract

`GET /api/policies/:id/native-intent/initial-establishment/readiness`

The endpoint is administrator-only and returns a versioned payload with:

- `eligibility`: `canEstablishInitialIntent` and bounded blockers.
- `legacyConfiguration`: preset-attachment and override counts only.
- `nativeIntentHistory`: total and active count only.
- `establishmentHistory`: a non-secret idempotency state, establishment ID,
  intent ID, timestamp, and recovery state.
- `declaredRuleSummary`: revalidated `purpose`, `hard_limits`,
  `helpful_hints`, and `avoid` groups from the recorded initial native intent.
- `sideEffects`: fixed `readOnly: true` and `automationStarted: false` values.

The route returns `404` for an absent policy and a generic `503` for a storage
failure. It does not return database errors.

## Recovery States

| State | Meaning | Action Boundary |
| --- | --- | --- |
| `rollback_available` | The recorded initial native intent is active and its unredacted snapshot is still in its restore window. | Existing protected reversion path only. |
| `reverted` | The snapshot was restored and the first authority was deactivated. | A replacement-authority workflow is required; a second first establishment stays blocked. |
| `rollback_expired` | The restore window ended. | Maintenance review; no automatic recovery. |
| `rollback_payload_redacted` | Retention removed the restore payload. | Maintenance review; no automatic recovery. |
| `native_intent_inactive` | The recorded intent is inactive without a completed rollback. | Maintenance review; no automatic recovery. |
| `rollback_snapshot_missing` | A record is structurally incomplete. | Maintenance review; no automatic recovery. |

## Implementation

`policyInitialIntentEstablishmentReadinessPersistence.mjs` uses read-only SQL
to fetch bounded counts, the single establishment record, and at most 129
declared-rule rows. It never selects idempotency keys, fingerprints, actors,
migration metadata, snapshot payloads, library observations, or routing
configuration.

`policyInitialIntentEstablishmentReadinessContract.mjs` turns those facts into
the stable readiness, recovery, and declared-rule-summary contract. It
revalidates every persisted rule against the strict initial declared-intent
schema; malformed content is not returned.

`policyInitialIntentEstablishmentReadinessService.mjs` catches storage failures
and returns a generic unavailable state. The route maps only absent-policy and
unavailable states to HTTP errors, leaving all normal blockers as a successful,
read-only explanation.

Focused unit, route, and PostgreSQL integration tests prove that the summary
does not expose idempotency or audit secrets, does not issue writes or locking
queries, preserves a reverted history, and executes against the current
schema.

## Follow-up

The initial-establishment stream is now complete. The next 8R work should be
selected from the roadmap's remaining runtime-authority and cutover acceptance
criteria, rather than adding a routine UI editor around first establishment.
