# Operator-correction release-pair boundary — outcome

The separate [design document](operator-correction-release-pair-boundary-design.md)
contains the choices, tradeoffs, source basis, and final recommendation stack.

## Delivered

- Correction-label SQL now includes observation time without reading title,
  free-text reason, prompt, response, or media metadata.
- The private correction replay snapshots active scoring-source edit times
  with labels and fingerprints both. It excludes pre-policy-edit, untimed,
  and unverifiable-source corrections before selecting cases. Private rows
  do not reach policy or prompt preparation. Its report says the screen is
  temporal only and keeps independent-label and routing authority false.
- A small ESM offline comparator verifies the pinned `v0.48.4-beta` commit,
  current checkout commit, bounded exact-shape artifacts, cohort hashes,
  common frozen-input claims, and one-to-one movie/TV cases. It reports
  paired destination gains and regressions separately from abstentions,
  failures and safety blocks, with no case identifiers in output.
- No schema, live policy, threshold, routing, API, UI, or release changed.

## Verification and limitation

The full backend unit suite passed (1,400 suites; 40,999 tests). The targeted
correction-label database integration suite passed (three tests), exercising
both observation-time and policy-source SQL against disposable PostgreSQL.
Server security/test lint, type checking, dependency checks, documentation
lint, copyright checks, and diff whitespace checks passed.
The comparator's tests use synthetic artifacts. No real baseline artifact
exists: the pinned release predates this replay, and no isolated release-code
classifier adapter has yet run against the same frozen cohort. The comparator
cannot attest external files. **Do not interpret structurally comparable
artifacts as measured classifier improvement.** The previous host-side live
replay also remained blocked by PostgreSQL SASL/password authentication, so
no private-cohort metric is claimed here.

The connected GitHub search returned no open pull requests, so there was no
random PR to implement locally or merge.

## Next high-value item

Build the disposable pinned-release classifier adapter, using the already
rehearsed release schema path and a synthetic correction cohort first. It
must accept only the same frozen private input as the current runner, suppress
all routing/learning/receipt writes and provider fallback, emit the bounded
case-token artifact, and prove its code commit and input digest. Only then run
the structure comparator on real paired, provenance-screened data.
