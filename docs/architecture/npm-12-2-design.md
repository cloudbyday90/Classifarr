# npm 12.2 Update Design

Reviewed: 2026-10-02. Scope: npm/npx and dependency-install policy, not an
application dependency sweep, database migration or release.

## Decision

Pin npm and its bundled npx to **12.2.0** in Docker, CI and all three workspace
manifests. Keep Node 24.18.1 for this change; it satisfies npm's declared engine
range. Preserve every locked dependency version, source URL and integrity.

Use the existing workspace boundaries, not a new service or dependency manager.
Commit strict install-script configuration and exact review decisions alongside
each manifest. Copy `.npmrc` into Docker builder stages before `npm ci`.

## Options

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Pin npm 12.2.0 and review installers | Current fixes; consistent builds; new hooks require review | Future installer upgrades need an explicit decision | Adopt |
| Keep npm 12.0.2 | No toolchain change | Misses later CLI fixes | Replace |
| Use a moving npm tag or blanket script approval | Less maintenance | Unreviewed build behavior and dependency execution | Reject |
| Update Node, Alpine and all packages together | One update round | Makes regressions harder to isolate | Separate follow-up |

## Installer Decisions

The old npm 12 default blocked dependency installers. Explicit denials preserve
that behavior; only bcrypt gains narrowly scoped approval.

| Locked installer | Decision | Reason |
| --- | --- | --- |
| `bcrypt@6.0.0` | Allow | Password hashing requires a working native binding; reviewed `node-gyp-build` selects a shipped prebuild or builds a fallback |
| `@scarf/scarf@1.4.0` | Deny | Install telemetry is unnecessary |
| `ssh2@1.17.0`, `cpu-features@0.0.10` | Deny | Optional native acceleration/detection; retain existing JavaScript fallback behavior |
| `@parcel/watcher@2.6.0`, `unrs-resolver@1.12.2` | Deny | Preserve prebuilt platform-binding path; no automatic fallback builds |
| `protobufjs@7.6.5` | Deny | Postinstall version notice is not needed at runtime |
| `fsevents@2.3.3` | Deny | Preserve existing optional-platform installer behavior; macOS remains separately unverified |

All three workspaces set `strict-allow-scripts=true`. Changing a package version
with an installer invalidates its exact approval until reviewed. The regression
tests enumerate lockfile installers and exercise npm itself with offline local
fixtures: unknown is rejected, denied does not execute, allowed executes.
Local source fixtures use source identities because registry name/version
approvals must not authorize arbitrary local packages.

This controls dependency lifecycle hooks, not package runtime code or explicit
project scripts. Environment/CLI overrides remain an operator trust boundary.
No credentials, wildcard approval or automatic `npm audit fix` is introduced.

## Deprecation Handling

Trace warnings before changing application code. The reported Windows DEP0190
originates in VS Code ESLint 3.0.34, not Classifarr. Keep warnings visible and
report the resolver upstream. Do not patch installed vendor bundles, switch to
a deprecated extension setting, or downgrade Node to hide it. See the separate
[diagnosis](../development-tooling-deprecations.md).

## Validation And Recommendation Order

1. Clean installs, installer authorization fixtures and unchanged lockfile graph.
2. Server/client tests, lint/type checks and client production build.
3. Linux image installation, bcrypt and isolated startup/upgrade smoke checks.
4. Node 24.21.0 / Alpine 3.24.2 runtime refresh next, with architecture checks.
5. Review application dependency updates separately; promote no release until
   the existing release acceptance gates pass.

Use short headings, descriptive links and actionable instructions following
W3C writing guidance. There is no UI change or new accessibility-conformance
claim in this maintenance update.

## Official Sources

Sources were discovered and checked online on 2026-10-02:

- [npm CLI changelog](https://github.com/npm/cli/blob/latest/CHANGELOG.md): 12.2.0 released September 30; 12.1 includes install-policy fixes and bundled dependency updates.
- [npm install-script command](https://github.com/npm/cli/blob/latest/docs/lib/content/commands/npm-install-scripts.md) and [accepted opt-in RFC](https://github.com/npm/rfcs/blob/main/accepted/0054-make-scripts-install-opt-in.md): explicit installer review and strict mode.
- [npm install documentation](https://docs.npmjs.com/cli/install/): dependency lifecycle controls.
- [Node deprecation reference](https://nodejs.org/download/release/latest/docs/api/deprecations.html): DEP0190 args-plus-shell warning.
- [VS Code ESLint documentation](https://github.com/microsoft/vscode-eslint/blob/main/README.md?plain=1): runtime and diagnostic tracing settings.
- [W3C writing guidance](https://www.w3.org/WAI/tips/writing/): concise, structured instructions.

The npm registry's `npm@12.2.0` metadata also confirmed the engine range
`^22.22.2 || ^24.15.0 || >=26.0.0`; no Node major update is required.
