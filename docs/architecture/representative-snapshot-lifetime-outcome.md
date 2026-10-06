# Representative snapshot lifetime outcome

Date: 2026-10-06. [Design, tradeoffs and official research](representative-snapshot-lifetime-design.md).

## Implementation and regression evidence

Representative candidate preparation now ends before the independent verification
read. Both full snapshots, provider inspection/verification, exact source keys,
configuration/revision checks, coverage validation and publication checkpoint remain.
Recovery commits require explicit fresh input, constructed outside the scope that
held the old snapshot. Shadow scoring and committing no longer share that context.
No caller snapshot is cleared or mutated. Admission, deadlines, cache limits,
backoff and production GC behavior are unchanged.

The isolated reachability regression covers a fresh fit and a cache hit, both with
and without real pending shadow/recovery callbacks. It tracks the snapshot, vector
map and a vector, forcing GC only inside a disposable synthetic test subprocess.
Against the previous source, both ordinary cases failed while the deliberately
retained control passed. Against the refactor, all three passed. This proves the
first snapshot can be collected at the second-read boundary; it does not establish
natural collection timing or memory savings under production load.

Failed image studies now preserve allowlisted numeric phase peaks. Non-summary
lines retain their 16 KiB limit; summaries allow at most 64 KiB, 128 phase entries,
and the same overall 8 MiB input / 256 checkpoint limits. Unknown names, negative,
fractional or non-finite values and raw payload fields are excluded. No scanner,
study deadline or acceptance assertion was weakened.

Focused validation passed 16 suites / 236 tests. Server typecheck, lint, both
dependency-analysis modes, 40 tooling tests, static imports and copyright checks
passed. The ownership gate passed without changing its reviewed hashes or claiming
historical unresolved writer paths resolved. The broader affected backend run
passed 176 suites / 2467 tests. Image results follow below.

## PR trial

Fresh random selection again chose open #555 at
`5545605b53c854de8847b44e24fa083ff4218080`. The exact client manifest/lockfile diff
was applied locally. The Node-major policy test failed (seven passed, one failed):
Node 26 declarations do not match deployed Node 24. Only those trial changes were
reverted; all eight policy tests subsequently passed in the 40-test tooling run.
No install, retained dependency update or merge. The unrelated PostCSS/Vite patches
reported by `npm outdated` remain a separate potential batch.

## Image evaluation

Before building, a new private database archive (75,625,425 bytes) passed checksum
and archive-list verification. The previous image
`sha256:570d5cec73e7cfc65e62bec989aa53ceb6fd9d2a618af891c446a1dd92a96233`
was retained as `classifarr:pre-memory-7b0fba6c-974e-40a3-977b-e0801a98ca54`.
This archive verification is not a restore rehearsal. No Unraid access.

No-cache build, unchanged single-catalog study and local Compose/schema evaluation
are pending. The prior run's incomplete revalidation result remains unchanged.

## Recommendation

Retain safeguards and both verification reads. Judge this bounded lifetime change
using the same natural-clock workload; do not equate forced-GC reachability tests
with a production memory fix. Select the next allocation target only after the
image measurement, recording any incomplete result as such.
