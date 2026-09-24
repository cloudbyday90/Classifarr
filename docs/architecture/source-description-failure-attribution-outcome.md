# Paired retrieval failure attribution: outcome

Status: Unreleased implementation, September 24, 2026. See the separate
[design, official sources, tradeoffs, and recommendation stack](source-description-failure-attribution-design.md).

## Delivered

The existing `study:evaluate:operator-corrections -- --source-pair --size 300`
command now produces a version-two aggregate report. Each arm partitions genuine
correction cases into leading matches, missing training evidence, missing
destination evidence, retrieval misses, profile/anchor shortlist displacement,
or shortlisted destinations that did not lead. The same counts accompany media,
identity, and observed-library strata. A small ESM metrics module replaces the
inline accumulator; no new scorer or large singleton was introduced.

The report also separates execution status from quality status. Complete cached
comparisons without sampled correction labels say `no_correction_labels`;
blocked/empty comparisons say `not_evaluated`. Counts do not invent labels or
claim accuracy. An evidence-backed candidate outside the final shortlist cannot
be reported as a leading proposal. Prompt presentation rotation is ignored when
measuring rank.

The correction is to evaluation visibility and consistency, not a demonstrated
production-ranking defect. Attribution shows the stage where a destination was
lost, not a causal explanation of why the content belongs in a library. Existing
scoring, grouped holdouts, backfill, music exclusions, routing, and approval
thresholds remain unchanged. No UI, API, dependency, or migration was added.

## Local evidence and verification

Before updating the local container, a read-only aggregate query found no
deployed correction-outcome table, zero correction events, and zero eligible
feedback labels. The current-code evaluation against that older schema could
not complete. No historical labels were reconstructed from status or placement.

Completed validation:

- Full backend unit coverage: 1,421 suites / 41,725 tests passed; 90.35% lines
  and 83.96% branches. The new metrics service has 100% line/branch coverage.
- Full client coverage: 381 files / 5,299 tests passed; 87.76% lines and 77.73%
  branches. The coverage ratchet passed for both workspaces.
- Full isolated PostgreSQL integration run: 156 suites / 1,788 tests passed;
  one pre-existing suite/test remains skipped. The focused evaluation/capture
  integration run also passed four suites / 32 tests.
- Focused evaluator unit run: five suites / 76 tests passed. Coverage includes
  every outcome category, disjoint totals, absent labels/evidence, prompt
  rotation, unshortlisted leaders, gains/regressions, private-content removal,
  media/source strata, and the existing synthetic 300-case path.
- Typechecks, server/client lint, ESM import/mock-shape checks, dependency and
  unused-export checks, Markdown/RAG documentation lint, migration/schema
  integrity, copyright, product-language/delivery-term/runtime-release checks,
  and diff whitespace checks passed. The existing non-literal filesystem-path
  warning in `captureOperatorCorrectionFrozenPolicy.mjs` remains unchanged.

These tests verify measurement behavior, not real-library accuracy. The running
image was retained as `classifarr:rollback-before-retrieval-attribution-20260924`.
A private 79,292,129-byte pre-update PostgreSQL archive was saved under ignored
`.tmp/`; its checksum and archive listing were verified, not a full restore.
Docker's archive-copy operation could not read the running tmpfs file, so the
archive was streamed through `docker exec` and verified against the source hash.

## Authorized local update and real-inventory result

Built clean source commit `2f17b44e369938107aef4228a57dd6f567b4ab1b` using the
existing smart-Compose helper with `build --no-cache --require-provenance`.
The helper verified the clean checkout and recorded its revision in the image.
The build included the production frontend build and fresh dependency installs.
Then used `up -d --no-build --pull never --force-recreate --wait` with the same
persistent mounts and existing configuration. No volumes were deleted. The
existing cross-encoder sidecar was left untouched despite Compose's orphan notice.

The replacement container became healthy, returned HTTP 200 for `/health` and
the application shell, and rejected unauthenticated batch-activity access with
401. Startup applied the previously committed correction-capture migration;
the outcome table is present and empty. The ordered fingerprint of all ten
policies' IDs, destinations, enabled flags, priorities, and automatic/prompt
thresholds is unchanged. No routing settings were edited. Final restart count
was zero. The old image and private database archive remain available; restoring
an old image alone is not a database rollback.

The first read-only run after startup still reported three missing cached
descriptions. At 22:01:03 UTC, the ordinary scheduled worker reported 6,655 cache
hits, three newly embedded descriptions, zero remaining, and no deferred or
isolated descriptions. No manual backfill or separate inference job was started.
The subsequent existing evaluation command completed using cached vectors:

| Measurement | Result |
| --- | --- |
| Selected / requested distinct held-out groups | 300 / 300 |
| Movies / TV | 152 / 148 |
| Active video libraries represented | 10 of 10 |
| TMDB-linked / source-only queries | 297 / 3 |
| Eligible identities / unique descriptions | 6,661 / 6,658 |
| Missing cached descriptions after scheduled refresh | 0 |
| Changed shortlists / leading proposals between arms | 0 / 0 |
| Queries without a proposal in either arm | 0 |
| Usable correction labels | 0 |
| Execution / quality status | `complete` / `no_correction_labels` |

Every correction-only rate remains null, and all correction-outcome counts are
zero because there are no labels, **not because no errors occurred**. The result
shows complete retrieval coverage and no measured proposal change from adding
the three source-only identities in this cohort. It does not establish correct
destinations, equal real-world accuracy, or safe automatic routing. The evaluation
itself made no generation/embedding calls and performed no database writes.

Snapshot fingerprint:
`7049a057daa2221f266906227cd5fa6eaaece5471469fdd5fe98c5801a15f0bc`.
Sample fingerprint:
`e7ab0d9da39719ce0c973a0ccde14947ecfb47a65030c166ab2b4548c2793b89`.
The sample fingerprint matches the earlier blocked comparison; the missing
vectors were filled without replacing the cohort. Private aggregate JSON remains
under ignored `.tmp/`, with no individual media content committed.

## PR and release boundary

The repository-scoped GitHub MCP open-PR search returned zero open PRs on
September 24, including the final recheck. No random PR was available to implement,
and none was merged. There is no release, Git tag, or version bump in this work. The user separately
authorized rebuilding and restarting the local Compose service after testing.

## Next high-value item

Move to **full destination-decision evaluation using the existing correction
capture and decision-evaluation path**, not another sample-size increase or
source-only admission tweak. This completed comparison found no shortlist or
leader changes, and the cache blocker has self-healed. Naturally occurring
corrections can now survive retry/history cleanup in the updated local instance.

As genuine outcomes accumulate, evaluate the actual final recommendation and
review outcome in addition to the retrieval shortlist. Use the new breakdown to
separate evidence gaps from ranking misses, then implement one change addressing
the largest measured failure and rerun the same held-out comparison. Reuse the
existing evaluator; any paid generation requires a separately approved budget.
Until labels exist, do not manufacture them from current placement, claim quality
improvement, raise confidence, or add another approval screen.

Final recommendation stack: automatic retained outcomes → grouped full-decision
comparison → stage-specific ranking fix → paired regression check → only then
consider calibrated reductions in manual review. This sequencing is our
engineering recommendation based on the observed limits, not a claim that the
research sources prescribe this exact architecture.
