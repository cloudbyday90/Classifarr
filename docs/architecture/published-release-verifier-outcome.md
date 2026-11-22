# Published release verifier outcome

November 22, 2026 Eastern.

The [design](published-release-verifier-design.md) is implemented as a
read-only release-runbook command. It authenticates the immutable v4
asset, checks the exact successful tag attempt and required jobs, and
verifies the index, native manifest and config digests in both registries.
It reads the version tag and `latest` twice and reports the observed state.

## Verification

- 522 focused release, workflow and installation tests passed. The new
  tests cover wrong attempts, incomplete jobs, mismatched signed native
  subjects, outdated aliases, changes during inspection and bounded errors.
  The real CLI exits nonzero for unsupported arguments.
- The signed `v0.49.4-beta` asset passed historical verification. Both
  registries returned the same trusted index, with each native manifest
  and config digest matching the signed routing subjects. Both the version
  tag and `latest` matched before and after inspection. The strict v4
  verifier returned a blocked result for that v3 release.
- Repository preflight, server test lint, Markdown, static imports and the
  coverage ratchet passed. GitHub listed no open PRs.

The verifier records the current registry observations. A future alias move
can change them, and a manual promotion retry remains separate from the
original automatic attempt. Live end-to-end v4 verification awaits the first
approved v4 release. This change did not create a release or deployment.

## Next development item

Return to the [classification UUIDv7 assessment](classification-uuidv7-readiness-outcome.md).
The current schema still stores the History primary key as `BIGINT` and uses
`INTEGER` for intake receipts, manual routing checks and reclassification
references. The retry boundary also admits only positive `INTEGER` targets.
Start by tracing the intake and retry identity paths against their persisted
references and replay contracts. Choose a bounded compatibility change before
introducing any new identifier format.
