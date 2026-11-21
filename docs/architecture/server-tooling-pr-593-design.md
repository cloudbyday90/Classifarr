# Server tooling PR 593 assessment design

November 21, 2026 Eastern. Agreed package assessment at main `28b69d93a`.
A uniform draw from open PRs
590, 591, 592 and 593 selected [PR 593](https://github.com/cloudbyday90/Classifarr/pull/593).
The reviewed head is `675ec1640ac58ad747c497ddadf3ca017116d522`. All four
heads are one commit ahead and zero behind main at intake. They are mergeable
with failing checks. Rebasing in that state would repeat the shared failures.

## Candidate and boundaries

Assess Knip 6.44.1 to exact 6.45.1 and Supertest 7.3.1 to exact 7.3.2 in the
server development workspace. The latter replaces the PR's floating caret
with a reproducible exact pin. Review the coupled OXC parser 0.156.0 package
and 19 optional native binaries, unbash 6.0.4, and Superagent 10.4.2. The candidate
Knip declares a newer smol-toml range than the existing scoped override.
Require actual TOML and Knip regression controls with the existing override
before adoption. Defer an incompatible candidate or assess its override
separately. Newer Knip versions are a separate upgrade.

Keep npm 12.2.2 and Node 24.22.1, existing lifecycle script policy, production
dependencies, lint/analysis settings and server/client/root workspace boundaries.
Review lock generation with scripts disabled first. Require a strict clean
install, full dependency tree, development-inclusive audits and no drift in
production package entries. Validate the exact released package metadata,
integrity, platform support and the upstream release notes before adoption.

Use the installed Knip CLI in normal and production modes, including cold
analysis, the existing dynamic import and TOML controls, and an upstream
behavior relevant to this update. Verify actual HTTP using Supertest against
existing retry route and error controls. Run fresh affected backend coverage,
ownership, lint, type, dependency and documentation gates. Cite exact failures
or skip reasons and add no lint bypasses or relaxed assertions.

| Option | Benefit | Cost or limit |
| --- | --- | --- |
| Adopt the compatible pair locally | Tests the selected PR's analysis and HTTP updates together | Requires review of two independent tool paths and the new native parser graph |
| Adopt only a passing package | Limits risk if one candidate fails its controls | Partial adoption requires a separate lock review and explicit evidence |
| Defer both | Retains an already qualified toolchain | Leaves the selected PR unapplied and postpones its fixes |

Recommend conditionally adopting both on main in a separate commit when the
controls pass. Test the local result and leave the PR unmerged. Recheck branch
ancestry and applicability at delivery before any remote rebase.

## Existing PR gate failures

The selected PR's [synthetic replay job](https://github.com/cloudbyday90/Classifarr/actions/runs/43843056548)
fails with `ERR_MODULE_NOT_FOUND` for server `pino`. Its workflow runs the
replay after checkout and Node setup without installing server packages.
This failure also appears on the other three open PRs. Investigate a replay
job install fix independently from the package update. With the baseline's
installed dependencies, the same replay command passes all eight cases.

The [OSV job](https://github.com/cloudbyday90/Classifarr/actions/runs/43843056575)
reports GHSA-gcqx-w48m-w2h4 in server development dependency deepmerge 4.3.1
after the prior exception expired November 16 UTC. The fetched CNA record
reports REJECTED. GitHub and OSV now mark the advisory withdrawn. Retain the
historical failure as evidence and verify the next push's actual scanner
result with existing policy. The missing replay dependency has a separate cause.
[CNA record](https://github.com/CVEProject/cvelistV5/blob/main/cves/2026/93xxx/CVE-2026-93753.json)
· [GitHub advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
· [OSV record](https://osv.dev/vulnerability/GHSA-gcqx-w48m-w2h4)

## Official sources

Discovered and opened through MCP on November 21, 2026 Eastern. Registry
metadata verified with pinned npm in the server workspace. Knip's patch
includes production subpath reporting and analysis fixes. Supertest's patch
updates its Superagent dependency. npm documents the clean, lock-driven
installation used for validation.
[Knip 6.45.1](https://github.com/webpro-nl/knip/releases/tag/knip@6.45.1)
· [Supertest 7.3.2](https://github.com/forwardemail/supertest/releases/tag/v7.3.2)
· [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/)
