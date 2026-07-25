# Policy Native Runtime Recovery Evidence

## Intent

Native runtime cutover must establish that every enabled, authoritative native
policy still has a usable rollback snapshot without asking an operator or a
maintenance-command caller to assert that fact. This is read-only runtime
evidence. It does not convert, restore, delete, route, or otherwise mutate a
policy.

The result is deliberately separate from compatibility-code deletion. A policy
can automate its native runtime cutover when its own persisted recovery record
is valid; deleting compatibility code remains a release-governance decision
with separately collected backup, support, and approval evidence.

## Official-Source Research

Research was verified on 2026-07-25 against official sources current for the
June 2026 design window.

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  states that a Repeatable Read transaction uses one stable snapshot for its
  successive reads. The existing `REPEATABLE READ READ ONLY` evidence bundle is
  therefore the correct boundary for inventory, authority, and recovery state.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  treats contingency planning and recovery requirements as part of operational
  resilience. Recovery proof must be concrete, current, and tied to the system
  state it protects.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) recommends
  integrating secure development practices into the software lifecycle.
  Database-derived evidence prevents a command-line claim from becoming a
  security decision.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends excluding secrets and sensitive application data from logs. The
  recovery contract therefore exposes only status, counts, and bounded numeric
  policy identifiers, never snapshot payloads, paths, names, or credentials.

## Alternatives

### Caller-Supplied Recovery Flags

Pros:

- simple command interface;
- convenient for isolated test fixture construction.

Cons:

- cannot prove that a snapshot exists for the current installation;
- stale, mistaken, or injected flags can manufacture a ready cutover claim;
- cannot bind recovery evidence to the active authoritative native intent.

### Exporting Snapshot Payloads Into Evidence

Pros:

- gives a maintainer every restore detail in one artifact.

Cons:

- exposes policy payloads and recovery-path details unnecessarily;
- makes logs, support attachments, and exported artifacts sensitive;
- does not improve the boolean question of whether recovery remains available.

### Database-Owned Bounded Recovery Evidence

Pros:

- evaluates every enabled policy with exactly one active authoritative native
  intent, regardless of an installation's library or policy names;
- proves the linked snapshot exists, is not redacted or restored, and has not
  expired;
- retains only aggregate counts and bounded numeric policy-ID samples;
- works automatically inside the existing read-only repeatable-read collection
  window and requires no new operator action.

Cons:

- native policies converted before snapshot creation or after expiration remain
  blocked from a ready cutover state until their recovery condition is repaired;
- this proves policy rollback availability, not the separate release-level
  backup/restore and compatibility-code deletion evidence.

## Final Recommendation Stack

1. Select enabled policies with exactly one active authoritative native intent.
2. Select only the latest rollback snapshot linked to that intent, never its
   `snapshot_payload` or restore path.
3. Mark recovery available only when the snapshot has an identifier, is not
   redacted, has not been restored, and expires after the evidence time.
4. Produce `policy.native_runtime_recovery_evidence.v1` with aggregate counts,
   bounded numeric failure samples, validation, and no raw snapshot data.
5. Feed only the derived `rollbackAvailable` result into native runtime
   cutover. Keep the compatibility-code deletion support stance server-owned
   and fail-closed.

## Implementation Outcome

Implemented:

- Added `policyNativeRuntimeRecoveryEvidence.mjs` as the bounded database
  observation and validation contract.
- Updated native runtime cutover evidence to derive rollback availability from
  that contract and to ignore caller-supplied rollback, deletion, or support
  safety claims.
- Updated execution-plan evidence input normalization to discard those runtime
  and support claims before collection.
- Kept compatibility-code deletion at the server-owned `block_deletion`
  support stance. This does not prevent automated policy conversion or native
  runtime classification; it prevents an accidental code-removal-ready claim.
- Added focused tests for valid, expired, restored, redacted, and absent
  snapshots, output redaction, transaction-owned integration, and input
  stripping.

No schema migration is required because the component reads the existing
`policy_intent_rollback_snapshots` records created during native conversion.

## Non-Goals

- No rollback execution or snapshot mutation.
- No policy conversion, routing, learning, provider, or quota operation.
- No operator UI, approval prompt, or maintenance dialog.
- No automatic compatibility-code deletion.
- No claim that a policy-level rollback snapshot replaces a validated full
  backup/restore artifact for a later destructive release operation.
