# Candidate-Bound Verification Capability Change Receipt

## Status

11R.8 is complete on 2026-08-13. AI Settings now retains a minimal receipt
when a successful administrator save changes the saved strict candidate-bound
verification capability. The receipt is a configuration-admission event. It is
not a provider-health report, configuration snapshot, model decision, policy
event, retry command, or routing authority.

## Problem

11R.6 and 11R.7 establish what strict candidate-bound verification is allowed
to do for proposed and saved AI settings. Without a bounded durable event, an
administrator cannot distinguish the current saved state from a prior explicit
configuration change that changed strict-verification admission. Recording the
whole AI configuration would solve that question at unacceptable privacy and
operational cost because it could retain endpoints, model names, credentials,
and settings unrelated to candidate-bound verification.

## Official Research Basis

This implementation was reviewed against official guidance available in August
2026:

- OWASP advises protecting every object-level and function-level API boundary
  with server-side authorization. The receipt endpoint derives its scope from
  the authenticated administrator and does not accept a browser-supplied actor.
  [OWASP API1: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
  and [OWASP API5: Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
- OWASP logging guidance recommends recording security-relevant events while
  excluding sensitive data. Receipts therefore store only fixed status IDs,
  a server-derived actor reference, revision, and timestamp rather than
  provider configuration or credentials. [OWASP Logging Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- NIST SP 800-92 frames log management as collection, protection, analysis,
  retention, and disposal rather than indiscriminate event capture. The narrow
  receipt model preserves an auditable event while avoiding a second
  configuration-history system. [NIST SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final)
- PostgreSQL documents transactions as all-or-nothing and reports a constraint
  violation as an error. The configuration write and plain receipt insert use
  that behavior deliberately: an impossible duplicate revision aborts the
  save instead of silently omitting a receipt. [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  and [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

## Decision

Add an internal `configuration_revision` to the singleton AI provider
configuration. A settings update locks the current row, writes the next
revision in the same transaction, derives fixed before and after capability
status IDs, and appends a receipt only when the status changes. A failed
receipt insert fails the caller-owned transaction, so no configuration change
can succeed without its corresponding transition receipt.

The receipt table stores only:

1. A versioned receipt format.
2. A server-derived `user:<authenticated-user-id>` actor reference.
3. Fixed before and after capability status IDs.
4. The positive configuration revision and server timestamp.

`GET /api/settings/ai/verification-capability/receipts` remains inside the
existing authenticated administrator settings boundary. It derives the actor
on the server, reads that actor's receipts through an `id` keyset cursor,
enforces a maximum page size of 20, runs read-only, sends `Cache-Control:
no-store`, and returns only server-owned status labels. It never calls a
provider or returns configuration data.

The AI Settings view renders the most recent five receipts and supports an
explicit refresh. It does not infer status, render raw fields, poll, or offer
a mutation control.

## Alternatives

### Persist the Full AI Configuration Per Save

Pros: complete before-and-after reconstruction.

Cons: retains provider, model, endpoint, credential, budget, and unrelated
runtime data; duplicates configuration history; broadens the breach and export
surface.

Decision: rejected.

### Record All Settings Saves

Pros: a chronological administrative audit.

Cons: creates high-volume records with no strict-verification value and invites
configuration snapshots or generic audit semantics into this focused boundary.

Decision: rejected. A receipt is emitted only for a strict-capability state
transition.

### Browser-Supplied Actor or Arbitrary Receipt Lookup

Pros: simple client filtering and an administrator-wide history view.

Cons: creates a broken-object-level-authorization risk and makes a receipt ID
look like authority.

Decision: rejected. The server derives the actor and scopes every query.

### Live Provider Probe While Reading Receipts

Pros: could combine historical change with current liveness.

Cons: adds external side effects, provider failures, sensitive diagnostics, and
an incorrect claim that connectivity establishes contract-grade authority.

Decision: rejected. Current admission and explicit connection testing remain
separate operations.

## Final Recommendation Stack

1. Keep a monotonic internal revision on the singleton AI configuration.
2. Lock, write, derive, and append the status-only receipt in one transaction.
3. Store only fixed status IDs, server-derived actor, revision, version, and
   timestamp; never store configuration or classification data.
4. Enforce one insert-only receipt per revision and propagate any insert
   failure to the caller-owned transaction.
5. Serve actor-scoped, keyset-bounded, read-only pages with fixed server-owned
   labels and `no-store`.
6. Keep provider probes, policy changes, routing, learning, retries, and
   configuration mutation outside the receipt read boundary.

## Implementation Evidence

- Migration: `database/migrations/20260813_100000_add_verification_capability_change_receipts.sql`
  creates `candidate_bound_verification_capability_receipts` with explicit
  sub-63-byte PostgreSQL object names.
- Write boundary: `server/src/routes/helpers/aiSettingsPersistence.mjs` and
  `aiSettingsPersistenceConfig.mjs`.
- Receipt contract, repository, actor identity, and read service:
  `server/src/services/classificationCandidateBoundVerificationCapabilityChangeReceipt.mjs`,
  `classificationCandidateBoundVerificationCapabilityChangeReceiptRepository.mjs`,
  `classificationCandidateBoundVerificationCapabilityChangeReceiptReadService.mjs`,
  and `aiVerificationCapabilityChangeReceiptActorIdentity.mjs`.
- Administrator handler and route:
  `server/src/routes/helpers/aiSettingsHandlers.mjs` and
  `server/src/routes/settingsRouteProviders.mjs`.
- Client API and read-only presentation: `client/src/api/settingsProviders.js`,
  `client/src/components/settings/VerificationCapabilityChangeReceiptList.vue`,
  and `client/src/views/settings/AI.vue`.
- Focused tests prove transaction rollback, actor derivation, no caller-owned
  actor choice, keyset pagination, query bounds, fixed status projection,
  privacy bounds, and no provider, policy, routing, retry, or configuration
  side effects while reading.

## Next Task

Proceed with **11R.9 Configuration Revision Integrity And Existing-Installation
Migration Acceptance**. Exercise this new column and receipt table against
fresh and upgraded PostgreSQL installations, prove monotonic revisions and
same-transaction receipt behavior under concurrent settings saves, and verify
schema dump and restoration coverage without adding provider or policy work.
