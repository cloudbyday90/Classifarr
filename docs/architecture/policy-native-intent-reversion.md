# Policy Native Intent Reversion

Status: implemented as the transactional native-authority reversion command.

## Problem

The rollback-window contract and snapshot storage prove that Classifarr captured
enough pre-change state, but a snapshot has no operational value until the
runtime authority can be restored safely. A reversion must not select an
arbitrary native version, accept client-supplied snapshot contents, expose the
legacy payload, or leave a partially restored authority state after a failure.

Current conversion and library-rebuild flows do not overwrite
`library_policies` or `policy_presets`. They change the active native-intent
authority. This command therefore restores authority, rather than replaying
legacy rows that remain unchanged. A future conversion that mutates legacy rows
must add a separately versioned, transactionally validated row-restorer; it
must not expand this authority command implicitly.

## Official Guidance Reviewed

- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  defines a transaction as an all-or-nothing group of operations whose
  intermediate state is not visible to concurrent transactions. The command
  commits the authority update, snapshot consumption, and audit event together.
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents that `FOR UPDATE` prevents concurrent writers and lockers from
  changing the same row until the transaction ends. It also recommends a
  consistent lock order and warns against holding transactions open while
  waiting for user input. The command locks policy, snapshot, then native
  intents after the action has already been authorized.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side authorization, server-generated verification data,
  controlled state transitions, a final authorization gate at execution, and
  time-limited authorization. The command evaluates the actor, reason code,
  snapshot ownership, expiry, manifest, and direct-successor relation on the
  server inside its transaction.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  frames recovery and resilience as contingency-planning concerns. The bounded
  snapshot, explicit recovery result, and migration event make the recovery
  action verifiable instead of an ad hoc database repair.

## Recommendations

1. **Restore authority, not an alternate policy model.** Revert to the
   compatibility bridge only when the snapshot intent remains active, or to the
   directly replaced predecessor when its successor remains the sole active
   intent.
2. **Authorize and revalidate on the server.** Require an approved actor source
   and bounded reason code before opening the transaction. The policy API
   derives the actor source and administrator ID from the authenticated request,
   then rechecks all
   authority and snapshot facts while rows are locked.
3. **Fail closed for ambiguous or stale state.** Block expired, redacted,
   malformed, missing, already-inconsistent, or non-direct-successor snapshots.
4. **Make successful reversion one-use and auditable.** Set `restored_at` and
   add a `rollback_applied` migration event in the same transaction.
5. **Keep raw snapshots confidential.** Results contain only bounded IDs,
   target state, and side-effect flags. They never return snapshot JSON,
   actor-free-form input, or legacy custom signals.

## Pros And Cons

Pros:

- A failed write cannot leave native authority changed without an audit event or
  consumed snapshot.
- Reversion cannot silently downgrade to an arbitrary historical native intent.
- A direct predecessor can be restored after an accepted rebuild without
  replaying or duplicating legacy data.
- The compatibility bridge remains available for an initial conversion rollback.
- One-use snapshot consumption prevents replay after a successful restore.

Cons:

- The command intentionally needs an approved server-side caller; it is not a
  generic client-triggered policy update.
- A snapshot with redacted or incomplete payload is blocked even when authority
  could technically be changed, because recovery evidence would be incomplete.
- Retention cleanup after expiry is deliberately a separate component so it
  cannot complicate the atomic authority restoration transaction.

## Final Recommendation Stack

1. `policyNativeIntentReversionContract.mjs` owns action and manifest
   validation, target selection, and bounded results.
2. `policyNativeIntentReversionService.mjs` orchestrates the approved
   transaction without owning SQL details.
3. `policyNativeIntentReversionPersistence.mjs` owns SQL locks, authority
   mutations, snapshot consumption, and migration-event persistence.
4. `policyRollbackSnapshotWindow.mjs` remains the side-effect-free policy for
   rollback eligibility and retention planning.
5. A later retention executor removes expired payloads while preserving minimal
   audit metadata; it must not be coupled to this command.

## Implemented Outcome

`applyPolicyNativeIntentReversion` accepts a policy ID, snapshot ID,
server-authorized action, and server execution time. It:

1. Requires a transaction boundary, approved actor source, and bounded reason
   code.
2. Locks the policy row, the requested snapshot, and all native intent rows in
   a stable order.
3. Rejects expired, previously restored, redacted, malformed, foreign, or
   incomplete snapshots without mutation.
4. Rejects ambiguous active authority and any replacement that is not the
   snapshot intent's direct successor.
5. Either deactivates the snapshot intent to restore compatibility authority or
   deactivates its direct successor and reactivates the snapshot intent.
6. Marks the snapshot restored and writes a bounded `rollback_applied` event in
   the same transaction.

The operational API is `POST /api/policies/:id/native-intent-rollbacks/:snapshotId/apply`.
It is mounted behind the existing administrator policy boundary. Its body only
accepts `reason_code`; actor source, actor ID, snapshot content, target intent,
and execution time are server-owned. A blocked transition returns a bounded
conflict rather than a partial success or raw recovery data.

The service returns no raw snapshot content. The focused test suite covers
initial conversion reversal, rebuild-predecessor restoration, expiry, manifest
redaction, actor gating, missing transaction boundaries, ambiguous authority,
idempotency, and rolled-back persistence failure.

## Security Outcome

- No ordinary policy read or unrelated save can trigger reversion.
- The API ignores client attempts to name an actor or choose an authority; it
  derives a verified administrator identity and `manual_operator` source.
- A client cannot supply authoritative snapshot data or choose a different
  historical native version.
- The final state check occurs after row locks are held, reducing TOCTOU risk.
- Recovery evidence is consumed exactly once on success.
- Legacy policy rows are not changed by this command.

## Next Step

Implement bounded **rollback snapshot retention cleanup**: after expiry, delete
bulky snapshot payloads and retain only the minimal audit metadata documented
by the rollback-window policy.
