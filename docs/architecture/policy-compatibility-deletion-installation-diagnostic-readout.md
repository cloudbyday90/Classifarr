# Policy Compatibility Deletion Installation Diagnostic Readout

## Intent

Compatibility-deletion maintenance previously returned only a generic blocked
result. That did not tell an operator whether native policy automation was
blocked or whether only the separate compatibility-code retirement release was
blocked. This component derives a compact readout from validated
execution-plan evidence. It returns only stable readiness booleans, allowlisted
blocker IDs, and one next-step ID.

The readout does not execute or verify a backup restore, create coverage,
support, rollback, diagnostic, or approval evidence, remove paths, or expose
policy names, library names, raw backup metadata, evidence messages, or
database rows. A missing restore verification remains a release-level
compatibility-deletion blocker; it does not make already-ready native policy
automation unavailable.

## Official-Source Research

Research was verified on 2026-07-25 against official sources current for the
June 2026 design window.

- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
  distinguishes backup existence from a tested restore. The readout preserves
  missing recovery verification as a release prerequisite.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  supports the existing read-only repeatable-read evidence collection window.
  The readout uses only that collected artifact.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends useful logs that exclude sensitive details. The contract uses
  fixed IDs and booleans rather than raw evidence.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  treats recovery verification as a resilience control. The readout does not
  replace it with an inferred restore claim.

## Options Considered

### Generic Blocked Status

Pros:

- minimal output contract.

Cons:

- conflates normal policy automation with release-level code retirement;
- requires parsing the larger artifact to identify the correct next action.

Decision: rejected.

### Full Evidence In The Outcome

Pros:

- exposes all available details.

Cons:

- expands the diagnostic and sensitive-data surface;
- makes automation depend on every internal evidence-schema detail.

Decision: rejected.

### Bounded Installation Readout

Pros:

- separately reports native-policy automation and release-deletion readiness;
- exposes fixed blocker IDs and one action only;
- preserves the validated evidence and existing containment boundaries.

Cons:

- detailed investigation still requires the local evidence artifact;
- does not and should not satisfy release prerequisites automatically.

Decision: selected.

## Final Recommendation Stack

1. Accept helper output only when its risk count, risk list, and ready state
   agree; require a ready result's validation to pass while allowing a
   structurally coherent blocked result to retain its expected validation
   findings.
2. Derive native automation from current policy inventory, reconciliation
   state, and native-runtime cutover summaries.
3. Derive release blockers only from allowlisted readiness risk IDs.
4. Return a stable next step distinguishing runtime remediation from release
   prerequisite completion.
5. Keep backup restore, coverage, support, approval, and removal out of the
   readout.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionEvidenceDiagnosticSummary.mjs` as a
  bounded maintenance-outcome reducer.
- Ready and blocked maintenance outcomes now include `diagnostic`, separating
  native policy automation from compatibility-deletion release readiness.
- The helper result is rejected when risk-count and ready invariants do not
  agree, or when a claimed ready result fails validation. Structurally coherent
  blocked results remain observable.
- Focused tests prove the separation, stable blocker ordering, raw-message
  exclusion, and invalid helper-evidence rejection.

Not implemented:

- no automatic backup restore;
- no automatic coverage, support, rollback, diagnostics, or approval claim;
- no policy, database, route, provider, quota, media-server, source-tree, or
  compatibility-code mutation.
