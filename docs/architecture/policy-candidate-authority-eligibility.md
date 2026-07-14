# Policy Candidate Authority Eligibility

## Status

Implemented for Phase 8R Task 8R.2.1.

## Problem

The migration candidate report previously evaluated legacy-policy projection,
routing, profile freshness, and contract validity without considering whether
native storage already had an unambiguous active authority. A policy with
multiple active native intent rows could therefore appear ready for conversion
even though the system could not safely identify its current native authority.

Candidate reporting must remain a dry-run operation. It should explain an
authority conflict without exposing native intent payloads or attempting a
repair.

## Official Guidance Reviewed

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents that row-level locks coordinate conflicting writers without
  blocking ordinary readers. The runtime apply boundary continues to lock the
  owning policy row; this reporting component remains read-only.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  describes Read Committed statement snapshots. A dry-run is therefore an
  expiring assessment, not a replacement for authority checks at write time.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends minimizing and sanitizing logged or reported data. Candidate
  output contains only the policy's existing identifier, a conflict state, an
  integrity status ID, and an active-intent count; it excludes native IDs and
  all intent payloads.

## Options

### Leave authority checks to the apply transaction

Pros:

- smallest report change;
- database constraints still protect the final write.

Cons:

- a dry-run can incorrectly present an ambiguous policy as ready;
- operators discover a known blocker only after starting conversion.

Rejected.

### Add a generic operator-review warning

Pros:

- exposes that something needs review;
- avoids a new candidate state.

Cons:

- hides a storage-authority conflict among unrelated warnings;
- can be overlooked by automation that selects ready candidates.

Rejected.

### Compose active-intent integrity into candidate eligibility

Pros:

- prevents an affected candidate from becoming convertible;
- keeps the conflict bounded and explainable;
- preserves the existing candidate shape for clean policies;
- reuses the dedicated integrity report rather than interpreting native rows a
  second time.

Cons:

- post-upgrade dry-run performs one additional metadata-only query;
- direct test builders must supply integrity input when they want to model an
  authority conflict.

Recommended.

## Final Recommendation Stack

1. `policyActiveIntentIntegrity.mjs` remains the sole interpreter of duplicate
   active native intent rows.
2. `policyCandidateAuthorityEligibility.mjs` reduces that report to a
   candidate-local eligibility decision without forwarding intent payloads or
   row IDs.
3. `policyIntentMigrationCandidateReport.mjs` assigns
   `blocked_by_active_intent_authority` before normal conversion readiness and
   emits an explainable blocker reason.
4. `policyPostUpgradeDryRun.mjs` and `policyPostUpgradeApplyGate.mjs` load the
   integrity report together with bounded policy input.
5. Database uniqueness and policy-row locking remain the final concurrent-write
   authority boundary; reporting never repairs or writes storage.

## Implementation Outcome

Implemented:

- Added a modular authority-eligibility service that recognizes repairable and
  invalid-only duplicate active-intent findings.
- Added the explicit migration candidate status
  `blocked_by_active_intent_authority` and an explainable bounded reason.
- Preserved the normal candidate shape for policies without an authority
  conflict. Affected candidates include only `stateId`, integrity status, and
  active-intent count.
- Updated migration candidate validation so an authority conflict cannot be
  downgraded to a ready candidate or emitted without conflict details and a
  reason.
- Wired post-upgrade dry-run and apply entry points to load active-intent
  integrity metadata before building readiness.

## Verification

Focused unit tests cover repairable and invalid-only duplicate groups, clean
candidate shape preservation, validation against downgraded conflict states,
and post-upgrade loader composition. The existing database integration coverage
continues to verify the unique active-authority constraint and historical repair
behavior.

## Next Step

Proceed to native runtime authority selection. Runtime readers should consume
the one-active-intent invariant explicitly and return a bounded integrity error
rather than selecting an arbitrary row if an inconsistent restored or
pre-migration state is encountered.
