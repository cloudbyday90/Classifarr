# Server tooling PR 593 assessment outcome

November 21, 2026 Eastern. Local assessment from main `28b69d93a`.
[Design and alternatives](server-tooling-pr-593-design.md).

## Package and lock review

The selected [PR 593](https://github.com/cloudbyday90/Classifarr/pull/593) head
`675ec1640ac58ad747c497ddadf3ca017116d522` contributes Knip 6.45.1 and
Supertest 7.3.2. Pin both exactly. Scripts-disabled lock regeneration matches
the reviewed PR graph with the direct Supertest declaration pinned instead of
using a caret. All 25 changed package entries are development-only. They
include OXC parser 0.156.0 and its 19 native bindings, the associated types,
unbash 6.0.4 and Superagent 10.4.2. Direct package integrity values match npm
registry metadata. The existing Knip smol-toml 1.9.0 override is exercised by
the actual TOML contract.

Strict `npm ci` added 631 packages with the repository's existing script
decisions and npm 12.2.2 on Node 24.22.1. The full server dependency tree
passes. Fresh development-inclusive npm audits report zero findings for root,
server and client.

## Observed tests

The installed Knip 6.44.1 CLI reported two enum flags as unused when a consumed
member combined them. The 6.45.1 CLI reports only the independent unused flag
in the same fixture. This exercises the upstream enum-usage fix while requiring
a real unused-member finding. Existing dynamic import, TOML, cache, tagged export
and missing import controls pass. Both repository Knip modes pass with and
without caching. Actual Supertest HTTP checks pass alongside the persistence
and retry controls. Six focused suites pass 160 tests. Four isolated PostgreSQL
suites pass 67 tests, including HTTP retry admission and lineage producer checks.
[Upstream enum analysis change](https://github.com/webpro-nl/knip/commit/2bedd7bc154feaa1d6a6abcb9111e1de4897c215).

Fourteen workspace quality gates pass, including lint, type checks,
dependency declarations, inventory ownership, policy gates, ESM and copyright.
The dedicated dependency suite passes 119 tests with its existing Linux-only
WASI test skipped on Windows. Markdown lint passes for all 2,568 files.

Fresh backend coverage passes 1,955 suites and 64,071 tests with one existing
skip. Coverage is 89.36% statements, 86.86% branches, 90.91% functions and
89.36% lines. The unchanged coverage ratchet passes. The local client reports,
installed lock hash and all 1,232 client source inputs were checked for drift.
This batch reuses that client evidence.

The local maintenance inventory retained the same 56 containers and 478 image
entries on the pinned daemon. Container state, health, start times and image
identities matched intake. No files, images or shared resources were retired.

## CI and next work

The November 16 PR failures show the replay job missing `pino` on checkout and
OSV reporting the deepmerge advisory. The same replay command passes all eight
cases with installed server dependencies. GitHub and OSV now mark the advisory
withdrawn. Keep the replay job's dependency setup as a separate CI follow-up and
verify scanner behavior on the pushed source under existing policy.
[GitHub advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
· [OSV record](https://osv.dev/vulnerability/GHSA-gcqx-w48m-w2h4).

At intake, all four Dependabot heads were one commit ahead and zero behind
main. Verify ancestry and applicability again after the change lands. The
observed PR failures preceded these local package changes. Two other PRs also
have their own server test failures. PR 590 changes the scanner pins while the
contract still expects the old SHA. PR 592 fails four dotenv CLI controls.
Rebasing by itself would leave those issues to resolve. The primary product
follow-up is the owner-checked retry transfer in the separate lineage design.
