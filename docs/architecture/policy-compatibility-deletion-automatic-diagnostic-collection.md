# Policy Compatibility Deletion Automatic Diagnostic Collection

## Intent

An installation must be able to collect its current compatibility-deletion
readiness state without an operator first constructing a JSON input file. The
collection is diagnostic only: it reads current database-owned evidence in the
existing read-only, repeatable-read transaction and reports a bounded ready or
blocked result. It cannot convert policies, approve deletion, remove files,
write policy storage, route media, or call an enrichment provider.

The no-input path is deliberately fail-closed. It does not manufacture test
coverage, a support stance, residual-reference resolution, rollback support,
support diagnostics, or deletion-manifest approval. Those are release-level
facts rather than installation observations. A no-input run therefore provides
the automatic current-state report needed to continue work, but it cannot
become an executable deletion plan by omission.

## Official-Source Research

Research was verified on 2026-07-25 against official sources current for the
June 2026 design window.

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  documents that `REPEATABLE READ` transactions use one stable snapshot for
  their successive reads. The diagnostic reuses the existing read-only,
  bounded collection window rather than combining independent observations.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating verification and secure practices into normal
  development workflows. Automatically collecting owned observations reduces
  error-prone manual handoff without turning unverified assertions into facts.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allowlist validation. The optional input remains constrained to
  the existing reviewed JSON path; omission selects a fixed empty envelope
  instead of accepting interactive flags or free-form values.
- [OWASP CI/CD SEC-09: Improper Artifact Integrity Validation](https://owasp.org/www-project-top-10-ci-cd-security-risks/CICD-SEC-09-Improper-Artifact-Integrity-Validation)
  identifies unverified artifacts as a supply-chain risk. The helper retains
  the exact checkout-to-image provenance check and does not treat a default
  diagnostic as reviewed approval evidence.

## Options Considered

### Require A Hand-Created Input File For Every Run

Pros:

- makes every caller-supplied value explicit;
- requires no command-interface change.

Cons:

- blocks automatic inspection when the only needed facts are already
  database-owned;
- encourages boilerplate JSON that can be stale or copied across installations;
- makes a safe diagnostic unnecessarily difficult to run.

Decision: rejected.

### Default Missing Approval And Coverage Values To Ready

Pros:

- would produce a ready plan with fewer inputs.

Cons:

- converts absence into approval;
- would allow a caller to bypass release-level safety gates;
- contradicts the existing provenance and artifact-integrity boundaries.

Decision: rejected.

### Provide A No-Input, Fail-Closed Diagnostic

Pros:

- allows any revision-matched installation to collect its current state;
- reuses bounded database-owned observations without a manual data handoff;
- preserves explicit reviewed input for coverage, residual-reference, and
  release-safety facts;
- cannot become ready merely because input was omitted.

Cons:

- a default run is expected to be blocked until later release evidence exists;
- it does not eliminate the need for named approval before a destructive
  compatibility-code removal.

Decision: selected.

## Final Recommendation Stack

1. Make the execution-plan evidence CLI accept no `--input` argument and use a
   fixed empty envelope in that case.
2. Make the provenance-bound maintenance runner omit the source-mounted input
   argument when no reviewed input is supplied.
3. Continue collecting database-owned policy inventory, reconciliation state,
   native cutover, and backup/restore evidence in one read-only repeatable-read
   transaction.
4. Preserve the revision-matched image, read-only helper, constrained output,
   and nonzero blocked-result contract.
5. Require separate reviewed evidence for any release-level coverage or safety
   confirmation before execution planning can become ready.

## Implementation Outcome

Implemented:

- `policy:compatibility-deletion-maintenance-evidence` now accepts an omitted
  `--input` option and runs the existing helper without a source-mounted JSON
  file.
- The underlying execution-plan evidence CLI now uses an empty input envelope
  when no input path is supplied and still writes a bounded blocked diagnostic
  under `.tmp`.
- Explicit `--input` remains supported for reviewed evidence. Unreadable or
  non-object input remains a hard failure rather than falling back to defaults.
- Focused tests prove the no-input path omits `--input` from the container
  command, keeps the helper result nonzero when blocked, writes only the
  requested temporary output, and continues to preserve the existing
  containment checks.
- Maintenance outcomes now include a bounded installation readout that
  distinguishes ready native policy automation from blocked compatibility-code
  retirement prerequisites. Its design record is [Policy Compatibility Deletion
  Installation Diagnostic Readout](policy-compatibility-deletion-installation-diagnostic-readout.md).

Not implemented:

- no automatic coverage attestation;
- no automatic support stance, residual-reference resolution, rollback-support
  confirmation, support-diagnostics confirmation, or manifest approval;
- no policy, database, route, provider, quota, media-server, or source-tree
  mutation;
- no automatic compatibility-code deletion.
