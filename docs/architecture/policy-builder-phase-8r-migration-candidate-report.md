# Policy Builder Phase 8R Migration Candidate Report

Status: implemented as the second Phase 8R storage-migration component.

## Problem

Native intent storage should not be applied blindly. Before any SQL migration,
conversion workflow, or runtime read path is introduced, Classifarr needs a
dry-run report that tells operators which existing policies can safely convert
and which require review.

## Official Guidance Reviewed

- PostgreSQL transactions:
  <https://www.postgresql.org/docs/current/tutorial-transactions.html>
- PostgreSQL `ALTER TABLE` and `NOT VALID`/validation patterns:
  <https://www.postgresql.org/docs/current/sql-altertable.html>
- PostgreSQL constraints:
  <https://www.postgresql.org/docs/current/ddl-constraints.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Application Security Verification Standard:
  <https://owasp.org/www-project-application-security-verification-standard/>

## Recommendations

1. Keep the migration candidate report dry-run only.
2. Classify every emitted policy into a single operator-facing readiness state.
3. Use the existing server intent contract as the authoritative compatibility
   projection before native storage exists.
4. Make unsupported legacy shapes explicit; do not silently skip them.
5. Report missing routing targets and stale profile dependencies separately from
   intent validation failures.
6. Bound report size and suppress raw legacy JSON unless maintainer tooling
   explicitly opts in.
7. Include estimated legacy deletion impact, but do not delete or mutate
   anything in report mode.

## Pros And Cons

Pros:

- Operators can understand conversion readiness before storage changes.
- Unsupported legacy policies are visible and actionable.
- The report becomes the input contract for Phase 8R.3 conversion.
- Sensitive or bulky legacy JSON stays out of normal operator output.

Cons:

- The report does not yet create native rows or migration events.
- Some policies may need operator cleanup before conversion can proceed.

## Final Recommendation Stack

- Report service: `policyBuilderPhase8MigrationCandidateReport.mjs`
- Candidate states:
  - `ready_to_convert`
  - `needs_operator_review`
  - `partial_legacy_inference`
  - `unsupported_legacy_shape`
  - `missing_routing_target`
  - `stale_profile_dependency`
  - `blocked_by_server_contract_validation`
- Safety gates:
  - dry-run only,
  - bounded report output,
  - no raw legacy JSON in operator mode,
  - no policy/native/rollback/deletion writes,
  - explicit deletion-impact estimates.
- Next component: Phase 8R.3 Explicit Conversion Workflow.

## Implemented Files

- `server/src/services/policyBuilderPhase8MigrationCandidateReport.mjs`
- `server/src/__tests__/services/policyBuilderPhase8MigrationCandidateReport.test.mjs`

## Outcome

Phase 8R.2 now provides an operator-safe migration candidate report. It uses the
existing policy intent contract to evaluate legacy compatibility projection,
then layers routing target, profile freshness, validation, unsupported legacy
shape, and deletion-impact checks over that contract. Validation rejects reports
that mutate storage, omit policy/reason/deletion-impact details, expose raw
legacy JSON in operator mode, or hide unsupported/routing/stale/validation
blockers behind generic statuses.
