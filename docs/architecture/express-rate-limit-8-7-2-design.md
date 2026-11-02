# Express rate limit 8.7.2 local adoption design

Date: 2026-11-02 (America/New_York). Status: agreed; implemented and verified.
Outcome: [local adoption and audit](express-rate-limit-8-7-2-outcome.md).

## Selection and immutable input

GitHub MCP found five open, non-draft Dependabot PRs, numbered 574 through 578.
One uniform PowerShell Get-Random selection chose
[PR 577](https://github.com/cloudbyday90/Classifarr/pull/577). Its reviewed input
is head b23c2195a321f7cb38ecf3a251c71093ed3880e6 against main
f89e35b68c4420ef03d7d06b459d853d420f0fee. The private selection receipt remains
under .tmp. Do not merge the PR or switch branches.

The PR updates only the server express-rate-limit dependency from 8.7.1 to
8.7.2 and the corresponding lock entry. Adopt its patch locally, pinning the
direct version exactly to 8.7.2 under the repository dependency workflow rather
than retaining the PR's caret. Root and client dependencies are a separate batch.

All five PRs were created today, are mergeable and use the current main base at
intake. None warrants a stale/conflict rebase now. Recheck at delivery and avoid
rewriting fresh branches or sending bot comments simply to manufacture cleanup.

## Rationale and tradeoffs

The upstream release repairs cross-window un-counting when MemoryStore is used
with skipFailedRequests or skipSuccessfulRequests. The maintainer advisory marks
versions through 8.7.1 affected and 8.7.2 patched. Production-source search found
neither skip option in Classifarr; do not claim a demonstrated application exploit
or that this patch resolves unrelated alerts.

| Choice | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Retain 8.7.1 | No dependency change | Retains an upstream advisory and known behavior defect | Reject |
| Exact 8.7.2 | Small reproducible patch with same supported peers | Requires install, transport and audit verification | Adopt locally |
| Batch all dependency PRs | Fewer update sessions | Mixes client, tooling and runtime regressions | Defer |
| Alter rate-limit policy now | Could change request behavior | Unrelated authorization/policy decision | Exclude |

Recommendation stack: inspect registry/release diff, adopt exact version with
scripts disabled for lock review, install under existing reviewed script policy,
then verify actual HTTP limit behavior and the affected quality gates. Preserve
current limit values, stores, test bypasses, headers and authorization boundaries.

## Baseline, installation and validation

Pinned Node 24.22.1 and npm 12.2.1 are installed. npm outdated reports installed
8.7.1, wanted/latest 8.7.2. Registry metadata reports Node >=16 and Express
>=4.11 peers; the existing Express 5.3.0 satisfies that boundary. Review the
published artifact's lifecycle behavior, not only its development prepare
script. Keep strict-allow-scripts and the existing explicit installer decisions.

Inspect the generated lock diff for all additions, removals, transitive changes,
resolved artifact and integrity. Run npm ci with the reviewed policy, npm ls
--all and npm audit --json including development dependencies. Do not relax
scripts, peers, overrides or scanners to obtain a pass.

Exercise an actual Express HTTP limiter across a reset boundary, including a
late failed/completed request and a genuinely over-limit request. Preserve the
current application's normal counting and authentication limiter tests. Run
tooling dependency policy, server lint/typecheck/Knip and the appropriate backend
coverage gates. Report exact failures/skips and audit scope/date separately in
the outcome. No release, deployment or runtime configuration change is included.

## Official sources

Discovered through GitHub/search MCP and opened on 2026-11-02:

- [Maintainer changelog](https://github.com/express-rate-limit/express-rate-limit/blob/main/docs/reference/changelog.mdx):
  the 8.7.2 security entry describes the bounded cross-window counting issue.
- [Maintainer advisory GHSA-j3cq-92fq-qg5f](https://github.com/express-rate-limit/express-rate-limit/security/advisories/GHSA-j3cq-92fq-qg5f):
  affected/patched versions, affected skip options and default-store conditions.
- [Selected repository PR](https://github.com/cloudbyday90/Classifarr/pull/577):
  exact local input and immutable head recorded above; it remains unmerged.

The npm registry metadata was retrieved for exact version 8.7.2 using npm view;
the private receipt includes dependency/engine/peer and distribution integrity
fields. The separate outcome records installation and validation for this batch.
