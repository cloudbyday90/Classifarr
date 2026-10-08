# Dependency and pin review — 2026-10-08

## Scope and method

Read-only inventory alongside the restore-admission test fix. No dependency,
lockfile, image-base or workflow pin is changed in this round. Use separately
tested batches rather than a blanket update immediately before release.

Reviewed all three manifests and lockfiles, strict install policy, 62 override
entries, Dependabot configuration, Docker build arguments and 14 distinct remote
GitHub Actions repositories. Ran direct and `--all` npm outdated checks, registry
metadata queries, targeted `npm explain`, and full-scope npm audits using
Node 24.21.0 / npm 12.2.0 and `https://registry.npmjs.org/`.

[npm documents](https://docs.npmjs.com/cli/outdated.html/) that the default check
only lists direct dependencies. `--all` includes transitive dependencies;
`wanted` respects the declared range, whereas `latest` is a publisher dist-tag.
Exact overrides can therefore leave `current` equal to `wanted` while preventing
newer releases, and a lockfile can lag even when its range permits an update.

All three npm audits reported **zero vulnerabilities**, including development
packages, at review time. This is not a guarantee of safety or a substitute for
the release's OSV, Trivy, CodeQL and secret checks. Excluding absent optional and
platform packages, `outdated --all` listed 16 root, 85 client and 194 server
package names. These counts overlap and are not vulnerability counts or a list
of packages that should all be forced to their latest major.

## Updates hidden by overrides or locks

| Area | Locked → available | Finding / recommended handling |
| --- | --- | --- |
| Client build utilities | `@rolldown/pluginutils` 1.0.0-rc.17 → 1.0.1 | Override is below plugin-vue's `^1.0.1` and Rolldown's `^1.0.0`; review removal/alignment in the frontend build batch |
| Client test parser | `es-module-lexer` 2.1.0 → 2.3.2 within major 2; latest 3.0.3 | Vitest 5.0.3 requests `^2.3.2`; prefer its supported major, not a forced jump to 3 |
| Markdown lint display width | `string-width` 8.2.0 → parent-requested 8.2.1; latest 8.3.0 | markdownlint 0.41.1 requests exactly 8.2.1; the existing override downgrades it |
| Runtime Socket.IO transport | `engine.io` 6.6.10 → 6.6.11 | Exact override blocks a patch within Socket.IO's range; ping-timeout fix |
| Runtime websocket | `ws` 8.21.0 → 8.22.0 | Override range already permits it; lockfile holds old version. Some parents request narrower ranges, so test websocket consumers together |
| Runtime IP parsing | `ip-address` 10.7.1 → 10.7.3 | Exact override blocks a patch; retain rate-limit and IPv4/IPv6 boundary regressions |
| Client linting | `ignore` 7.0.5 → 7.0.12 | Review patch under existing override; original ESLint parent range is major 5 |
| CSS fixture data | `mdn-data` 2.28.0 → 2.37.2 | css-tree requests exactly 2.27.1; a newer data set is not automatically compatible |
| Markdown math | KaTeX 0.18.2 → 0.19.0 | Already overridden outside micromark-extension-math's `^0.16.0`; review upstream compatibility and parser contracts separately |
| Tooling majors | `which` 6.0.1 → 7.0.0; `json-parse-even-better-errors` 5.0.0 → 6.0.0; `keyv` 5.6.0 → 6.1.0 | Separate API/engine review; parent packages still request older majors |
| Discord HTTP | nested Undici 6.29.0 versus root 8.11.2 | Intentional compatible major for Discord's `^6.27.0`; 6.29.0 remains newest 6.x. Do not force 8.x globally |

Also found inactive overrides: client `ws`, `has-flag`, `supports-color`; server
`source-map-support`, `immutable`, `uuid`. Those packages are absent from their
respective lockfiles. They are not currently installed vulnerabilities, but stale
overrides could constrain a future reintroduction. Review their original security
purpose before removal. In particular, the client `ws` 8.20.1 pin must not be
mistaken for an installed client websocket dependency.

Read-only parent tracing also found ordinary transitive lock lag, including
Axios `follow-redirects` 1.16.0 → 1.16.1 and client Rolldown 1.2.11 → 1.2.13.
Absent optional peers and non-Windows binary packages are not missing installs.

Sources: registry metadata for
[@rolldown/pluginutils](https://registry.npmjs.org/%40rolldown%2Fpluginutils/latest),
[es-module-lexer](https://registry.npmjs.org/es-module-lexer/latest),
[string-width](https://registry.npmjs.org/string-width/latest),
[Engine.IO release notes](https://github.com/socketio/socket.io/releases),
[ws 8.22.0](https://github.com/websockets/ws/releases/tag/8.22.0) and
[ip-address 10.7.3](https://github.com/beaugunderson/ip-address/releases/tag/v10.7.3).

## Direct updates and intentional holds

| Package | Locked | Available | Recommendation |
| --- | --- | --- | --- |
| Vite | 8.3.2 | 8.3.3 | Frontend batch; HTML transform and dev-server path checks need regression coverage |
| PostCSS | 8.5.28 | 8.5.29 | Same build batch; validate style escaping, comments and generated CSS |
| Vue Router | 5.3.1 | 5.4.0 | Separate runtime navigation/focus/history tests; release includes experimental breaking changes |
| Playwright | 1.63.0 | 1.64.0 | Separate browser-tooling batch with matching browser binaries and all intended projects |
| Client TypeScript | 6.0.3 | 7.0.2 | Keep hold until Vue compiler-API integration is deliberately migrated and tested |
| Node declarations | 24.19.1 | 26.6.4 | Keep major 24 for deployed Node 24; 24.19.1 is current within major 24 |

Official release notes retrieved through GitHub MCP:
[Vite](https://github.com/vitejs/vite/releases/tag/v8.3.3),
[PostCSS](https://github.com/postcss/postcss/releases/tag/8.5.29),
[Vue Router](https://github.com/vuejs/router/releases/tag/v5.4.0),
[Playwright](https://github.com/microsoft/playwright/releases/tag/v1.64.0) and
[Vue language tools](https://github.com/vuejs/language-tools/releases/tag/v3.3.12).

Vue-tsc 3.3.12 and jsdom 30.1.2 are current. The installed vue-tsc still resolves
`typescript/lib/tsc` and uses the JavaScript compiler API. Upstream's support for
the `@typescript/typescript6` alias does not mean replacing that API with native
TypeScript 7 is transparent. Root/server already use TypeScript 7.0.2. Retain the
client-only Dependabot exclusion until its migration has a passing design/test.

## Container and CI coverage

No newer targeted platform release was found in the official sources reviewed:
[Node 24.21.0 LTS](https://nodejs.org/en/download/archive/v24.21.0),
[npm/npx 12.2.0](https://registry.npmjs.org/npm/latest),
[Alpine 3.24.2](https://www.alpinelinux.org/downloads/),
[PostgreSQL 18.6 / 17.11](https://www.postgresql.org/docs/release/?force_isolation=true)
and [pgvector 0.8.7](https://github.com/pgvector/pgvector).
Registry inspection of `node:24.21.0-alpine3.24` still resolves to the pinned
multi-platform index `sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`.
Node 26 is Current, not the selected LTS; PostgreSQL 19 remains a beta in the
reviewed release listing. APK packages are resolved from the Alpine branch at
build time, so image inventory and scans must be repeated after every rebuild.

Three action pins have newer releases (resolve tags to reviewed immutable SHAs
when implementing; do not switch workflows to floating tags):

- [setup-node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0),
  `949feb2413d6458794dcd2491c4babbbce0c15c1`, versus pinned 7.0.0.
- [upload-artifact 7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2),
  `cf430e030ddbb5b0abf93d22962f4752f3646cd9`, versus pinned 7.0.1.
- [download-artifact 8.0.2](https://github.com/actions/download-artifact/releases/tag/v8.0.2),
  `9000827ccba6bdab643e8b6fd33ac0654aef8333`, versus pinned 8.0.1.

The other 11 action repositories match their latest applicable action releases.
CodeQL's latest repository release is a **bundle**, not the action: the applicable
v4.38.2 action resolves to our existing pin. Do not substitute the bundle tag.

Dependabot currently checks npm and Actions weekly, but has no Docker entry.
Adding one alone would not cover our build-argument pins: GitHub documents that
[ARG-based image references are not updated](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-private-registries).
Keep an explicit review of Node tag/digest, Alpine, npm, pgvector version/hash,
PostgreSQL packages and fixture images. Design an automated read-only drift
report after this release; preserve coupled-version and provenance gates.

## Decision stack and tradeoffs

1. Finish the restore-admission CI fix and exact-commit/image checks first.
   Benefit: clear failure attribution; cost: optional updates wait one batch.
2. Next bounded update: frontend build/test pin alignment (`pluginutils`,
   same-major module lexer), Vite and PostCSS. Run lint, Vue typecheck, unit
   coverage, build and production-policy browser tests. Benefit: removes actual
   parent-contract drift; cost: toolchain changes need a new image evaluation.
3. Review runtime transport/IP patches and CI artifact actions as separate batches
   before freezing a release candidate. Benefit: current fixes and release tooling;
   cost: network/admission and producer/consumer receipt regressions must rerun.
4. After that, Markdown tooling, optional browser/router features and recurring
   pin visibility. Keep incompatible majors held until their parent integrations
   support them. Do not block a release solely on an unrelated newer major;
   newly discovered exploitable advisories remain release blockers.

No dependency installation or compatibility claim for these candidates is implied
by this inventory. The PR trial and executed checks are recorded in the separate
[restore-admission outcome](restore-admission-session-exit-outcome.md).
