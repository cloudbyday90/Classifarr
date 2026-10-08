# Frontend build pin alignment

Date: 2026-10-08. Scope: client build/test dependencies, on `main`.
No release, runtime API, database, Compose/template or memory-policy changes.

## Evidence and decision

The [pin audit](dependency-pin-audit-2026-10-08.md) found overrides below the
installed parents' requirements. `npm explain` confirms plugin-vue 6.0.9 requires
pluginutils `^1.0.1`, Rolldown requires `^1.0.0`, and Vitest 5.0.3 requires
es-module-lexer `^2.3.2`. Current overrides force rc.17 and 2.1.0 respectively.

Use this bounded batch:

| Package | Before | Candidate | Purpose |
| --- | --- | --- | --- |
| Vite | 8.3.2 | 8.3.4 | Dev file-boundary checks, HTML transforms and stylesheet preloading |
| PostCSS | 8.5.28 | 8.5.29 | CSS comments, custom properties and style-tag escaping |
| @rolldown/pluginutils | 1.0.0-rc.17 | 1.0.1 | Align with both bundler and Vue plugin |
| es-module-lexer | 2.1.0 | 2.3.2 | Align with Vitest without adopting incompatible v3 records |

Vite 8.3.4 was published after the earlier audit and now requires PostCSS
`^8.5.29` and Rolldown `~1.2.12`. Review its necessary native binding updates
together; do not refresh unrelated packages just because their ranges allow it.
Keep Vitest/coverage paired, Node 24 types, client TypeScript 6, existing lifecycle
script restrictions and unrelated security overrides. Retain exact reviewed
overrides in this batch; removing all overrides is a separate decision.

## Verified official sources

Retrieved using GitHub MCP, npm registry metadata and web discovery on the date
above, rather than assuming tag URLs:

- [Vite 8.3.3](https://github.com/vitejs/vite/releases/tag/v8.3.3) and
  [8.3.4](https://github.com/vitejs/vite/releases/tag/v8.3.4): dev access checks,
  HTML transform paths, CSS/preload handling and bundled dependency changes.
- [PostCSS 8.5.29](https://github.com/postcss/postcss/releases/tag/8.5.29): parser
  and serialization fixes. These notes are not evidence of an application XSS.
- Required transitive updates: [Rolldown 1.2.12](https://github.com/rolldown/rolldown/releases/tag/v1.2.12)
  and [1.2.13](https://github.com/rolldown/rolldown/releases/tag/v1.2.13) include
  chunk initialization, naming, import and watch fixes;
  [nanoid 3.3.20](https://github.com/ai/nanoid/releases/tag/3.3.20) fixes types.
- [pluginutils 1.0.1](https://github.com/rolldown/plugins/releases/tag/pluginutils%401.0.1)
  and [lexer 2.3.2](https://github.com/guybedford/es-module-lexer/releases/tag/2.3.2).
  [Lexer 3](https://github.com/guybedford/es-module-lexer/releases/tag/3.0.0)
  changes import/export records and initialization; do not globally override to it.
- [Vite server options](https://vite.dev/config/server-options): preserve strict
  filesystem access, restricted hosts and origins; bind synthetic probes to
  loopback. Development servers are not the deployed Express server.
- [npm overrides](https://docs.npmjs.com/cli/configuring-npm/package-json/) and
  [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/): overrides deliberately
  replace parent constraints; lockfile review and clean installation remain
  necessary. Preserve `strict-allow-scripts`, never force peer resolution.

## Implementation and verification

1. Add small ESM regressions before changing dependencies. Use real PostCSS,
   module parsing, installed parent/override contracts and a loopback Vite server
   with disposable synthetic files. No live `.env`, provider or application API.
2. Update four exact versions; generate the lockfile with scripts disabled.
   Inspect every package delta and lifecycle-script flag before `npm ci`.
3. Run clean installation, dependency-tree validation, full-scope npm audit,
   tooling contracts, lint, both Vue typechecks, full client coverage, build,
   and production-policy browser tests. Only claim the coverage ratchet with a
   current backend report too. Keep route budgets, timeouts and assertions intact.
4. Commit the validated implementation. Build the local Compose image with no
   cache and clean-source provenance, back up before replacement, verify runtime
   inventory and health, and dump/check schema in a disposable image container.
   Record image identity, test failures/skips and cleanup in a separate outcome.

Fresh PR enumeration found 555 and 556; random selection chose
[556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Trial its exact server manifest/lock
patch against the existing Node-major contract, without merging or changing the
runtime baseline. Reject and revert the trial if incompatible.

## Tradeoffs and recommendation stack

| Approach | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Aligned exact pins plus patch updates | Repairs known parent mismatch; reviewable lock delta | Pins still need recurring review | Use now |
| Remove all overrides | Less maintenance | Can undo unrelated security decisions and change many trees | Defer |
| Force every latest major | New features | Breaks lexer, Vue compiler and Node runtime contracts | Reject |

Finish this frontend batch first. Next, review runtime transport/IP patches;
then update CI action pins and perform release preparation. Review Markdown,
browser/router features and automated pin-drift reporting separately. A clean
npm audit is useful evidence, not proof that every dependency is safe.
