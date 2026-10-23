# October Dependency Readiness Review Outcome

Initial research date: October 22, 2026. Baseline main
`05f58c4c367320456ecb0552e3af9a8de3fdae1b`. Both approved patches were subsequently
implemented and locally qualified on October 23, 2026. The
[design](dependency-readiness-2026-10-design.md) records scope and trade-offs;
the initial review and intermediate checkpoints are retained below. The final
section identifies current evidence and the remaining toolchain limitation.

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

## Initial audit finding

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
agree. No host-global Node/npm installation or installer approval changed.

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

A follow-up source sweep found one additional hard-coded 12.2.0 requirement in
the provider-fault workflow validator. Its real CLI rejected the updated checked-in
workflow before correction. The validator now requires 12.2.1 without changing
its permission, receipt, failure-enforcement or tag-only gates; all eight mutation
tests and the actual CLI passed, including new old/moving/missing npm rejection.
The first complete backend coverage attempt was deliberately stopped before
editing this guard, and its private log retained. It is not a passed coverage
run; a fresh complete attempt follows the corrected source.

That complete run finished with 1,879 passing suites, 60,381 passing tests,
one Windows skip and one stale preflight-contract failure. The baseline manifest
already included three additional VM-tool test gates while the assertion still
expected the older list. The test now requires the complete ordered list and
each gate's exact command; its existing mocked failure-propagation cases also
cover the additional gates. No manifest, runner or VM behavior changed, and
no VM-tool command was executed by this correction. Final coverage must come
from a fresh successful run rather than this failed checkpoint.

## Server security patch checkpoint

Following the npm checkpoint, the exact server override was updated to 10.7.4.
Scripts-disabled lock generation changed only that package's version, registry
URL and reviewed integrity; there are no package additions/removals or other
metadata changes. A strict clean install and complete server dependency tree
passed. The development-inclusive server audit now reports zero findings.
This does not cover the npm CLI's separately installed bundled copy.

The parent and an independent investigator both traced Express `req.ip` through
the default limiter key generator and its `isIPv6` guard to `Address6`. Application
constructors do not enable proxy trust and no production direct parser imports
were found. Therefore the installed vulnerable parser is established, but
application attacker reachability is not. No proxy or route setting changed.

Before the patch, the new deterministic regression failed on 10.7.3 because the
instrumented legacy matcher was reached. It refused that operation rather than
running a large CPU-exhaustion fixture; 36 compatibility cases still passed.
After the patch, all 38 dependency cases and the nearest rate-limit/runtime
checks passed: 56 tests across three suites, with focused test lint passing.
They cover constructor/alias rejection for LF, CR and both Unicode line
separators, `isValid`, long valid zones, both CIDR orders and actual local HTTP
quota controls. The fresh, rationale-blind independent candidate review found no
concrete bypass or new regression in the three-file patch and confirmed the
parser aliases converge on the fixed implementation. The deprecated matcher
remains exported upstream but no inspected application/library caller uses it.
Final application/image qualification remains required at this checkpoint.

## Open PR

The fresh GitHub MCP query again returned only open
[PR #568](https://github.com/cloudbyday90/Classifarr/pull/568). The existing
random selection from that singleton was already implemented locally as exact
ESLint 10.13.0; see its [separate outcome](server-eslint-10-13-outcome.md).
This round's clean install, dependency-tree checks and server lint passed with
that version. No duplicate update, PR merge or remote PR mutation was needed.

## Final qualification and remaining risk

Implementation revision `a11e3d95caae4d110a1275180e4a9a4f8d183820` passed complete
server/client coverage and the unchanged-baseline ratchet, browser and disposable
database/TLS checks, an emulated ARM64 bcrypt binding check, and a full no-cache
same-image Compose soak/three-profile recovery rehearsal. See the
[runtime outcome](node-24-22-security-outcome.md) for counts, exact artifact,
receipt hash, the retained first provenance failure and verification limits.
The final documentation commit changes Markdown only; it does not requalify a
new source revision or image.

At `2026-10-23T03:26:15.698Z`, npm 12.2.1 reported complete dependency trees
without problems for root, server, client and the separate private CLI prefix.
Development-inclusive application audits reported zero findings in all three
workspaces. The separate CLI audit reported one moderate finding and zero
high/critical findings. Its bundled `ip-address` remains 10.7.2, also confirmed
inside the actual production candidate. Workspace overrides/audits do not cover
that separately bundled copy.

Inspected CLI SOCKS consumers use `isIPv6` guards or fixed-width byte conversion;
this does not establish a complete CLI trust-boundary assessment or waive the
[advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5).
No vendor files, audit suppressions or installer decisions were changed.
Application remote exploitability was not established, and neither the clean
workspace audit nor this local qualification is a supply-chain safety guarantee.

## Final recommendation stack

1. Retain Node 24.22.1 / Alpine 3.24.3 with the reviewed multi-platform base
   digest, and the exact patched server parser 10.7.4.
2. Retain the separately reviewed npm/npx 12.2.1 patch and strict installer
   authorization. Resolve or explicitly assess its distinct bundled advisory
   during release preparation; do not describe the toolchain as advisory-free.
3. Prepare the release next: agree its version and verify exact-source CI and
   native published-image evidence before publication. No release is created here.
4. Keep the other direct updates as separate, attributable follow-ups; retain
   Node 24 declarations and the client compiler restriction. Resume incident and
   VM troubleshooting after release work, as requested.
