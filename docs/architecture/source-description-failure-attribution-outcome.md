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

The separately authorized no-cache Compose update and real-inventory rerun
follow this tested source commit; their results will be appended before handoff.

## PR and release boundary

The repository-scoped GitHub MCP open-PR search returned zero open PRs on
September 24. No random PR was available to implement, and none was merged.
There is no release, tag, or version bump in this work. The user separately
authorized rebuilding and restarting the local Compose service after testing.

## Next high-value item

Run this comparison on naturally captured correction outcomes and target the
largest measured failure category. If cache gaps remain after startup, examine
the existing description-backfill worker and its retry state first. If labels
remain absent, allow normal corrections to accumulate; do not replace them with
placement-derived labels, increase confidence, or add another approval screen.
