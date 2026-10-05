# Startup restore refusal outcome

Date: 2026-10-04 (US Eastern).
Base: `572964e0d6f88064cb22f746cf18dc8f64714af7`.
See the [design, sources and tradeoffs](startup-restore-refusal-design.md).

## Finding and change

[Run 37248416500](https://github.com/cloudbyday90/Classifarr/actions/runs/37248416500)
passed Build and Test and Tests with Database. Installation acceptance failed
at `normal_rejection` after intentionally interrupting a restore. The downstream
release readout correctly blocked; image publication and release did not run.
The tested source was `2621ecae3f2d881d5292f9e62e9ade331e4d8b4e`, not this fix.

The schema worker already rejected unverified restore state, but collapsed its
reason into generic exit 1 while its parent discarded child output. Added a typed
schema refusal and reserved child exit 78. The parent emits only a fixed message
after exit and stream closure, still prevents application startup and stops the
database. Cleanup failures, signals, excess output and unrelated exceptions do
not acquire that classification. Raw child logs remain discarded.

No acceptance predicate was loosened. No schema, dependency, template, API,
permission or version change; no release and no live Unraid access. This does not
resolve unknown legacy ingestion ownership or activate protected conversion.
The saved GitHub CLI login returned no open Classifarr PRs, so no random PR was
available to implement or merge.

## Verification

Focused validation: five suites, 216 tests passed. Server lint and type checking,
CI preflight, ESM import/mock checks and Markdown lint passed. The ownership
review covers only the five changed/new startup dependencies; no unresolved path
was waived. Gate: 19 owned, 272 separately coordinated, 502 unresolved, fingerprint
`d35ba6927620d2b1a5a56135357db6e49942234d6b04aeb271ceb0526b008b84`.

Full backend validation passed: 1,685 suites, 51,950 tests, one skipped, in
319.567 seconds. The existing Linux directory-fsync unit test is skipped on
Windows. Image verification is in progress; results must be recorded before
claiming this regression fixed in a packaged image. No new remote CI success or
native ARM64 result is claimed here.

## Recommendation

Keep the typed refusal and strict real-image restore test. This preserves both
operator diagnostics and fail-closed behavior, at the cost of a small explicit
worker exit contract. The recovery and release-evidence skills guided the
unchanged admission rule, secret-safe reporting and separate image proof.

Next: resume protected startup/restore integration with the verified application
layout. Fully unattended legacy ownership recovery still depends on production
writer isolation; this diagnostic repair must not be presented as that feature.
