# October Dependency Readiness Review Outcome

Initial research date: October 22, 2026. Baseline main
`05f58c4c367320456ecb0552e3af9a8de3fdae1b`, with approved Node/Alpine edits in
progress. No additional package or npm update has been implemented at this point.
The [design](dependency-readiness-2026-10-design.md) proposes separately agreed
patches; this document records checks, not future test results.

## Available direct updates

Fresh `npm outdated --json` used private Node 24.22.1 and npm 12.2.0. Root has no
outdated direct packages. Versions below distinguish installed, allowed/wanted
and registry latest; availability is not a security finding.

| Workspace | Package | Current | Wanted | Latest |
| --- | --- | --- | --- | --- |
| Server | dotenv | 18.0.8 | 18.0.8 | 18.0.9 |
| Server | eslint-plugin-n | 18.4.1 | 18.5.0 | 18.5.0 |
| Server | knip | 6.41.0 | 6.41.0 | 6.42.1 |
| Client | postcss | 8.5.30 | 8.5.30 | 8.5.31 |
| Client | vite | 8.3.4 | 8.3.4 | 8.3.5 |
| Client | typescript | 6.0.3 | 6.0.3 | 7.0.2 |
| Both | @types/node | 24.19.2 | 24.19.2 | 26.6.5 |

Official sources were discovered through MCP and reviewed, not constructed from
version guesses. [dotenv](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md)
changes CLI empty-path handling; [PostCSS](https://github.com/postcss/postcss/blob/main/CHANGELOG.md)
corrects source-map escaping. [Vite 8.3.5](https://github.com/vitejs/vite/releases/tag/v8.3.5)
touches build/preload hashing, development serving, resolution and bundled tools.
[eslint-plugin-n 18.5.0](https://github.com/eslint-community/eslint-plugin-n/releases/tag/v18.5.0)
updates Node support/builtin knowledge and rules.
[Knip 6.42.0](https://github.com/webpro-nl/knip/releases/tag/knip@6.42.0) and
[6.42.1](https://github.com/webpro-nl/knip/releases/tag/knip@6.42.1)
change plugin/resolution/test-framework detection. None is being installed merely
because it is newer. Keep Node declarations on major 24 and preserve the reviewed
client compiler restriction.

## npm candidate and its limitation

Registry metadata and the [official release](https://github.com/npm/cli/releases/tag/v12.2.1)
identify npm 12.2.1 as latest. Its unchanged engines
`^22.22.2 || ^24.15.0 || >=26.0.0` admit Node 24.22.1. It fixes registry
`allowScripts` key recording under linked installation and refreshes bundled
dependencies; registry metadata has no dependency lifecycle install hooks.

A download-only `npm pack --ignore-scripts` did not install or execute the
candidate. The archive's computed SHA-512 integrity matches registry metadata:

```text
sha512-bKCmFRVT/BB+YPEYbZwQ1XUI3N5t4xKSpU1MxOjo7z3iWzKBJ0ZXRC1xFdEN+TC7N5TdywaBzf2dMXGJq/e2PQ==
```

Reading its bundled manifest confirms `ip-address` 10.7.2, still in the affected
advisory range. Existing private npm 12.2.0 contains 10.5.0. This is a distinct
toolchain exposure assessment, not a claim that the CLI is remotely exploitable
in this setup. No vendor patch or advisory suppression was performed.

## Fresh audit finding

Development-inclusive audits report zero findings for root/client. The server
audit reports two moderate package entries for one advisory: `ip-address` and its
`express-rate-limit` parent. No high/critical findings are reported in that result.
`npm explain` traces the installed exact 10.7.3 override to production
`express-rate-limit` 8.7.1, whose `^10.2.0` range admits patched 10.7.4.

[CVE-2026-111997 / GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5)
concerns quadratic synchronous IPv6 zone parsing in versions through 10.7.3.
The [maintainer release](https://github.com/beaugunderson/ip-address/releases/tag/v10.7.4)
provides 10.7.4; metadata reports Node >=12 and no installer hooks. Exact SRI:

```text
sha512-DWBMKyeM25D70nrIiTkgQth59/G+naKOTep6huF9j+GmeK3DMD60Zvxg5d5qQnz+38AHgou6ean2LECX+lrKDg==
```

This audit does not prove application reachability. No hostile traffic was sent
to live services. Recommend the narrow server patch before release, plus the npm
maintenance patch with its residual bundled-advisory limitation explicit. Other
updates remain separate follow-ups. Final Docker qualification is pending the
agreed candidate state; no new release-readiness claim, commit or publication is
made by this review.

## npm 12.2.1 implementation checkpoint

The user explicitly approved both proposed patches. Following runtime commit
`466abed53`, npm/npx 12.2.1 was installed only in ignored private tooling from
the already integrity-verified archive. Both executable entry points report
12.2.1. Docker, all four CI installation commands, three package-manager/engine
requirements, lock roots, installer-policy regression and active setup docs now
agree. No global Node/npm installation or installer approval changed.

Scripts-disabled lock generation changed only the npm engine at each root,
with structural equality for every other field. Strict clean installs and full
dependency trees passed for all three workspaces. Development-inclusive audits
still report zero for root/client and the same two server moderate entries;
the separate server patch has not been applied at this checkpoint.

All 59 toolchain checks passed through the actual npm 12.2.1 CLI, including real
unknown/denied/allowed installer fixtures. A deliberate old-CLI run of the new
executing-version test failed as required: 12.2.0 cannot masquerade as the new
baseline. The local-file fixtures verify existing installer authorization, not
the upstream linked-mode registry bookkeeping bug specifically. npm's bundled
ip-address remains 10.7.2; no CLI-advisory remediation claim is made.

Full application and image qualification follows the separately committed server
patch so that results bind to the final candidate state.

## Open PR

The fresh GitHub MCP query again returned only open
[PR #568](https://github.com/cloudbyday90/Classifarr/pull/568). The existing
random selection from that singleton was already implemented locally as exact
ESLint 10.13.0; see its [separate outcome](server-eslint-10-13-outcome.md).
This round's clean install, dependency-tree checks and server lint passed with
that version. No duplicate update, PR merge or remote PR mutation was needed.
