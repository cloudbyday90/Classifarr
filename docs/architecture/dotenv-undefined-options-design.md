# Dotenv optional-settings update design

## Scope — 9 October 2026

Review server dotenv 18.0.6 → 18.0.7 on Node 24.21.0/npm 12.2.0. Keep
Classifarr's ESM bootstrap, external-environment precedence and strict install
policy. No new configuration service, release, schema change or production
deployment is needed. This is a correctness update, not an advisory claim.

## Research and decision

Official sources discovered and retrieved through search/GitHub MCP:

- [Dotenv changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md)
  identifies the two changes in 18.0.7.
- [Undefined-option fix](https://github.com/motdotla/dotenv/pull/1070)
  excludes undefined options from the merge so environment settings survive;
  explicit false values still take precedence.
- [CLI quiet fix](https://github.com/motdotla/dotenv/pull/1071)
  delays the fallback until the file has loaded without overriding an explicit
  shell choice.

Registry metadata for the exact version reports Node >=12, no runtime dependency
or peer additions and no installation lifecycle hooks. Inspect the distributed
diff and lockfile before a clean install; preserve all script decisions and
security overrides. Existing application imports remain ESM even though the
upstream package offers a CommonJS distribution.

| Option | Benefit | Cost |
| --- | --- | --- |
| Retain 18.0.6 | No dependency change | Optional undefined settings can hide intended environment settings |
| Adopt 18.0.7 | Upstream fix, same API and dependency graph | Requires precedence and subprocess regression checks |
| Replace dotenv | One fewer external package | Broader parsing/bootstrap compatibility work unrelated to these bugs |

Recommend the patch, existing bootstrap and synthetic subprocess contracts.
First demonstrate failures on 18.0.6; cover undefined path/quiet/override and
explicit false precedence, plus CLI quiet settings. Run focused and broader
server checks, audit all installed dependencies, then test the exact no-cache
local image. Never read real environment files into a test. Generate the schema
snapshot using the existing disposable database runner after the build.

## Random open PR trial

The fresh open list contained #555 and #556. PowerShell `Get-Random` selected
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`, updating client Node types
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0. Apply its reviewed exact
manifest/lock patch locally, clean-install without scripts, run typecheck and
the existing toolchain policy. Do not merge. If the Node-major policy rejects
it, reverse only that patch and restore a clean policy-compliant installation;
passing TypeScript alone does not authorize Node 26 declarations on Node 24.

## Parallel diagnostic scope

Investigate the reported twelve unresolved source IDs read-only, separately
from dotenv. Compare current capture records with bounded, one-item Plex reads.
Visible titles/posters are not proof of unique provider IDs. Do not reset
imports, select an arbitrary identity, trigger recovery or change shared Plex,
Ollama or Unraid. Record sanitized findings in a separate outcome document.
