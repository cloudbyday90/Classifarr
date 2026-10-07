# Streamed representative-profile verification outcome

Implementation date: 2026-10-07. See the
[design, official research and tradeoffs](representative-verification-design.md).

## Implemented

Representative refresh keeps its full fitting/sidecar-preparation read, but its
independent publication verification now streams bounded batches into the same
private v4 fingerprint. Missing vectors remain valid partial evidence; malformed
present vectors still fail. The verification result contains no vector map.

Fresh corpus, novelty identities and observation-readiness metadata still reach
the staged consumers. Provider/configuration/revision checks, final admission,
cancellation, partial-coverage rules, backfill priorities and retry budgets are
unchanged. The recovery-change skill guided the narrow two-read contract and
regression-first tests. No schema, UI, API, deployment or GC-policy changes.

## Verification so far

- Regression-first repository run: three new failures and ten existing passes.
- Focused representative/recovery/lifetime tests: 16 suites, 219 passes.
- Real PostgreSQL integration: two suites, 22 passes. Includes updates, deletions
  and backfilled vectors between independent reads; batch-snapshot consistency,
  cancellation rollback and actual neighborhood/backfill consumers.
- Lint, typecheck, development/production dependency checks, copyright, static
  imports and Markdown checks passed.
- Initial full backend run: 1,729 passing suites and one failed ownership gate;
  53,786 passing tests, one failed assertion and one Windows-only skip. The failure
  required review of the changed repository file, not relaxing an assertion.
  After review, only its source digest changed; the analysis/classification and
  SQL authority are unchanged. All 39 ownership tests and the gate now pass.
  A complete rerun and image evaluation follow this source checkpoint.

Forced GC is confined to isolated lifetime-test subprocesses. Image profiling
uses natural collection. The Windows directory-fsync skip requires the existing
Linux candidate-image check before final handoff.

## Random PR trial

The two open PRs were #555 and #556. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact client manifest/lock changes
were applied: `@types/node` 24.19.1 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.
Registry metadata confirmed the integrity, dependency and empty script/peer sets.

The unchanged runtime gate returned seven passes and one failure because Node 26
declarations do not match deployed Node 24.21.0. The trial was reverted before
installation; the restored gate passes all eight assertions. No installed-build
or audit claim is made for the rejected candidate; no dependency change or PR
merge is retained. The dependency-update skill preserved that compatibility gate.
Fresh client outdated results also list PostCSS 8.5.29 and Vite 8.3.3 patch updates;
those remain separate reviews.

## Image evaluation

Pending the clean-source no-cache build, bounded catalog cycle and authorized
local test deployment. The prior exact image is pinned as
`classifarr:pre-representative-verification-d1e41da0` before its mutable tag is
replaced. Unraid and the unrelated Harmoniarr deployment remain outside scope.

## Next item

Use the complete-cycle measurements to decide whether another allocation change
is justified. The first representative read still supplies real vectors for
shadow scoring and neighborhood membership validation; removing it requires a
separate validated consumer contract. Do not skip it or weaken admission based
only on RSS. No release, tag, version bump or new branch.
