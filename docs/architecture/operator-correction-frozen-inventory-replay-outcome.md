# Frozen inventory replay — outcome

Status: Implemented locally under Unreleased on 24 September 2026.
See the separate [design](operator-correction-frozen-inventory-replay-design.md)
for boundaries, alternatives, official sources and recommendation stack.

## Delivered

- A v3 private input and label-free worker contract with strict bounds for
  fold-local inventory descriptions, relative fit and exact candidate pools.
  V1 score-only and v2 policy/profile inputs remain accepted.
- Read-only capture of the current evaluator's actual inventory retrieval
  request per held-out correction, followed by the existing source and
  representation recheck.
- Candidate replay of frozen inventory evidence using the installed policy
  scoring path and pure ranking/decision projections. Contract drift and
  availability appear as aggregate statuses; the baseline does not claim a
  feature it never had.
- Published/current server lockfile digests in the report, with dependency
  provenance still unverified. This is diagnostic evidence, not an
  attestation or a release decision.

## Verification and limits

Targeted contract, cohort, worker and scorer tests passed (38 tests across
four suites). The full backend unit suite passed (1,404 suites; 41,140 tests),
as did the disposable-database integration suite (149 suites; 1,718 tests,
one skipped), server typecheck/lint, static-import check, copyright check,
Markdown lint and whitespace check. The synthetic
fixture verifies replay mechanics, not movie/TV quality. The offline pair
still omits semantic RAG search, AI adjudication, authoritative signals,
pattern/history, routing and learning. No real correction cohort was captured
in this change, no threshold was modified and no release was created.

From the clean commit, the no-network Docker pair executed the v3 synthetic
fixture in both roles with no worker failures; the candidate consumed its one
frozen inventory response and reported `complete: true`. The v2 and v1
synthetic fixtures also completed without worker failures. These synthetic
outcomes are not real movie/TV accuracy measurements. The published and
candidate server lockfile digests differed, and the runner correctly kept
`dependencyProvenanceVerified: false`.

The repository's connected PR search found zero open PRs on 24 September
2026. None could be selected randomly, implemented or merged.

## Next high-value item

Build and attest separate dependency environments from the published and
candidate lockfiles, then add a side-effect-free adapter for the archived
ranker/decision schema. Once that gate passes, run the private v3 capture on
real screened movie and TV corrections and report case coverage,
unavailability and regressions before considering any routing change.
