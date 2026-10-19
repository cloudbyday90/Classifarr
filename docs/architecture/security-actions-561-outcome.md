# Security action updates from PR 561: outcome

## Implemented locally

Applied the reviewed dependency changes from
[open PR 561](https://github.com/cloudbyday90/Classifarr/pull/561) in implementation
commit `68d144ca9dac816f04c713d9abbedf731d641cd4`, without merging the PR.
Its open state and immutable head
`ed943cbb0e07085552eb97614a0e237d1966079f` were revalidated before editing.
See the separate [design](security-actions-561-design.md) for selection, official
sources, compatibility review, tradeoffs and recommendation stack.

Exactly eight dependency references changed across three workflows:

| Dependency | Previous | New exact source |
| --- | --- | --- |
| CodeQL init/analyze/SARIF, four references | 4.38.3 | 4.39.0 — `6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee` |
| OSV action/reusable workflows, four references | 2.6.0 | 2.7.0 — `b1d267aea5211fa648d9d442fa64b90dbdcbdd36` |

The CodeQL version comments now identify the reviewed patch release. No workflow
trigger, permission, secret, scanner threshold, category, query or failure policy
changed. Dependabot's direct OSV job stays contents-read-only without SARIF upload.
No `pull_request_target`, new publishing path or scanner bypass was introduced.
All CodeQL entrypoints remain coordinated on one immutable source revision.

No npm dependency changed, so no manifest version/install/lockfile refresh or
unrelated dependency PR was included. The root package change only wires the new
archive tooling test into the existing CI/preflight command.

## Validation and limitations

The existing security-scan workflow contract retained its trigger, least-privilege,
failure, query, matrix and SARIF category assertions while updating expected SHAs.
It passed within four affected backend suites totaling 36,325 tests. Gateway
tooling, configured lint/types, preflight, policy, ESM, documentation, whitespace
and secret checks also passed. The separate
[archive outcome](gateway-default-binding-outcome.md) records native image and
local Compose evidence; those do not execute hosted security scanners.

The previous main CI failure preceded these action updates: absent `.tmp` broke
gateway tooling before later build checks. Its root cause was repaired and proved
with fresh-working-directory and real Linux subprocess tests. It is not attributed
to CodeQL or OSV, whose previous jobs had succeeded.

Local YAML tests do not prove hosted analysis, SARIF upload or advisory coverage.
Hosted results for the eventual pushed commit must be read separately. The pinned
OSV wrapper still uses an upstream tagged Docker image; no claim of complete
transitive immutability is made. GitHub's preview action lockfiles need a separate
compatibility study, including reusable-workflow and container-image boundaries.

Recommendation: retain reviewed exact SHAs and least privilege, review actual
hosted results, and keep transitive workflow locking separate from this bounded
version update. No PR merge, new release, tag or production deployment was made.
