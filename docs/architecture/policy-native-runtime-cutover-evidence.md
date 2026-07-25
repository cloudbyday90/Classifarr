# Policy Native Runtime Cutover Evidence

## Intent

Make native runtime cutover evidence reflect the current installation, not a
representative policy object supplied by a maintenance command. The report is
read-only and is used only to gate later compatibility-path deletion planning.

## Official-Source Research

Research completed on 2026-07-25 against official sources current for the
June 2026 design window.

- PostgreSQL documents that Repeatable Read uses a stable transaction snapshot
  for successive reads. A read-only verification should collect its related
  policy, native-intent, and reconciliation evidence in that same snapshot.
- PostgreSQL table expressions support the joined and derived read models
  needed to select enabled policies without depending on their display names or
  library names.
- OWASP logging guidance supports recording the event outcome and the minimum
  necessary attributes. Cutover evidence therefore contains counts, statuses,
  source traces, and at most bounded numeric policy identifiers for failures,
  never raw policy payloads or library names.
- NIST SSDF recommends producing and protecting evidence for software changes.
  A native-runtime read must be proven before it can support a later deletion
  decision.

Sources:

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL table expressions](https://www.postgresql.org/docs/current/queries-table-expressions.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Alternatives

### Caller-Supplied Representative Policies

Pros:

- small, simple input;
- useful for isolated unit tests.

Cons:

- an empty or stale sample can claim a native-read failure where the current
  database is valid;
- cannot prove installation-wide cutover state;
- lets a maintenance input influence an authoritative observation.

### Database-Derived Complete Runtime Read Evidence

Pros:

- evaluates every enabled policy regardless of operator naming or library
  layout;
- keeps policy inventory, reconciliation state, and runtime evidence aligned
  in one snapshot;
- produces bounded diagnostics without exposing policy payloads;
- no policy, native-intent, rollback, or deletion side effects.

Cons:

- reads the enabled-policy set and native-intent child rows for each report;
- requires batched reads and tight output limits for large installations.

## Final Recommendation Stack

1. Use a `REPEATABLE READ READ ONLY` transaction for all execution-plan
   evidence collection.
2. Load all enabled policy read models and attach active native-intent rows in
   batches through `policyNativePolicyReadService.mjs`.
3. Classify converted authority from the persisted native-intent authority
   state, not command input.
4. Verify each converted path is an active, valid native read and each remaining
   unconverted path is a compatibility read.
5. Emit bounded counts, traces, and failed policy IDs only; never emit names,
   raw policy payloads, credentials, or provider results.
6. Keep rollback and compatibility-deletion gates separately declared and
   blocked until their own later checks pass.

## Implementation Outcome

`policyNativeRuntimeCutoverEvidence.mjs` now loads the complete enabled-policy
runtime read set from the transaction-owned database client. It delegates
native row attachment to the existing batched reader and passes only the
derived converted and unconverted sets to the cutover verifier.

`policyNativeRuntimeCutoverVerification.mjs` now assesses all supplied policies
and reports aggregate counts. An empty converted or unconverted set is marked
not assessed, avoiding a manufactured fallback result. Failure details remain
bounded to numeric policy IDs.

The evidence-bundle CLI drops caller-supplied converted and unconverted policy
samples. Its input is restricted to later gate and safety declarations; current
policy inventory and runtime reads are database-owned.

## Non-Goals

- No compatibility path deletion.
- No policy conversion, policy write, rollback snapshot write, or migration
  event write.
- No new operator workflow, approval, or UI surface.
- No change to the separate backup, restore, support, or deletion readiness
  gates.
