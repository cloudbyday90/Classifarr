# Operator-corrected policy replay — outcome

The separate [design document](operator-corrected-policy-replay-design.md)
records alternatives, official sources, safety boundaries and the
recommendation stack.

## Delivered

- Added an opt-in ESM CLI that uses the existing private fresh-policy runtime
  and defaults to zero model generations. A model call requires an explicit
  bounded `--generate-cases` value; no remote-provider fallback is introduced.
- Captured redacted explicit correction rows with the same read-only policy,
  inventory and vector snapshot, and included them in drift verification.
- Restricted sample selection to non-conflicting operator corrections while
  keeping other inventory available for training. Fold exclusion covers every
  copy of a selected description across identities. Raw correction rows are
  removed before policy or prompt preparation.
- Added aggregate correction agreement, abstention, failure and paired-change
  counts for movie and TV. Removed inventory-placement agreement and
  per-library strata from this report to avoid presenting them as corrected
  outcomes. Empty cohorts and invalidated snapshots remain non-promotable.
- Left policies, live routing, thresholds, schema, UI, and the released version
  unchanged. No release was created.

## What this does not prove

The safe replay omits direct source assignment, exact identity, historical
RAG, outcome history, learned patterns and inferred-profile policy rules.
Its labels are explicit operator corrections but not guaranteed blind or
independent of policy authoring. Therefore `accuracy` and
`fullPipelineAccuracy` remain null. The paired policy leader is from the
current run; it is **not** a prior-release comparison. Do not promote this
result into automatic routing.

## Local verification

Focused tests cover the correction-only runner, one-transaction label capture,
snapshot drift, conflicting labels, copied-description holdout, no-label
behavior, aggregate accounting, private-input separation, and CLI validation.
The full backend unit suite passed (1,399 suites, 40,959 tests), along with
security/test lint, type checking, dependency checks, copyright checks, and
documentation lint.
The existing repository integration test covers the underlying operator-label
SQL. A direct host CLI smoke test exited with the generic failure message.
A bounded diagnostic identified a host-side PostgreSQL SASL/password
authentication mismatch, before model inspection or correction capture; no
private-cohort result was claimed. The process closed without changing the
persistent application database. The initial npm 12 argument-forwarding
failure was resolved by documenting the direct Node invocation.

The connected GitHub PR search returned no open pull requests in this
repository, so no random PR could be implemented or merged locally.

## Next high-value item

Build a **true paired release comparison**: freeze an eligible correction
cohort and policy-provenance screen, run the last released classifier and the
current classifier in separate disposable read-only environments against the
same held-out inputs, and compare correct destinations, abstentions, safety
blocks and changed decisions. Reject the comparison if labels were used in
either side's training or policy authoring. This is the missing step before
any claim of full-pipeline improvement.
