# Bounded manual suggestion analysis outcome

November 23, 2026 Eastern. See the
[design](manual-suggestion-analysis-result-design.md) for the contract,
tradeoffs, and official sources.

## Delivered behavior

An administrator can opt into `summary-v1` on the existing all-policy
analysis POST. The service enumerates at most 25 enabled policy IDs in
ascending order and attempts at most 24. The extra ID determines whether
there is a continuation. The response includes every attempted policy and
its fixed status, with a 4 KiB JSON ceiling. A completed policy reports
newly created suggestions. A thrown operation is `unconfirmed`, and its
counts are unavailable. A later error does not undo earlier commits.

The next `afterPolicyId` starts a new manual mutation against the current
enabled list. Clients using the new adapter get the existing no-replay
behavior for mutating requests. With no `format`, the administrator POST
still returns the detailed payload. Both modes share the existing manual
analysis slot and use the same per-policy transaction and evidence rules.

## Matched local comparison

Four fresh Windows Node 24.22.3 runs used the same combined fixture with
24 policies, 128 feedback rows per policy, eight repeated keywords per
correction, the production HTTP route, and isolated PostgreSQL. The run
order was detailed, summary, summary, detailed.

| Format | HTTP JSON bytes | Elapsed (ms) | Suggestions saved per policy |
| --- | ---: | ---: | ---: |
| Detailed | 293,804 | 2,521–2,603 | 9 |
| Summary v1 | 2,077 | 2,432–2,435 | 9 |

The summary cut the measured response by 99.3%. Each run verified all 216
saved suggestions against their individual policy counts. Ingestion committed
40 items and 20 queue tasks saved metadata during the response window in each
run. The timings describe these four local runs. The Linux cgroup and database
memory envelope remains a separate measurement.

## Verification

Focused runs passed 110 server tests, 79 PostgreSQL tests, and 52 client API
tests. The PostgreSQL suite checked role refusal, an ordered continuation,
the maximum cursor, and saved writes after a fixture deliberately lost a
result after commit. That result was `unconfirmed`. The client checked
that an explicit continuation sends the exact ID without automatic replay.

Fresh backend coverage passed 64,492 tests across 1,958 suites with one
skip and 89.36% line coverage. The initial client coverage run timed out
while loading the existing Vue lint contract during concurrent testing.
The standalone rerun passed all 7,652 tests across 490 files with 89.69%
line coverage and the existing timeout. The coverage ratchet passed for
both workspaces. The production build, 28 Chromium checks, and 13 client
configuration checks passed. Lint, type checks, ownership, preflight,
ESM checks and the policy gates passed. The root, server and client npm
audits each reported zero findings. GitHub listed no open pull requests
for local adoption or Dependabot rebasing.

## Next recommended item

Design a bounded administrator read for evidence attached to saved
suggestions. Decide separately whether clients need the exact detector
output from a particular run, since that requires capturing results even
when no suggestion is inserted. Compare detailed and summary execution in
the isolated Linux study before choosing a shared memory reservation.
