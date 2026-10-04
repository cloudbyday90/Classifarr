# Frontend DOM test environment refresh: outcome

Date: 2026-10-04. Starting revision: `85c7bcb8`. Branch: `main`.
Local toolchain: Node 24.21.0 and npm 12.2.0 on Windows.

## Delivered

Pinned client jsdom to **30.1.2**, replacing 30.1.1. Removed its scoped Undici
7.29.1 override; the locked 8.11.2 now meets jsdom's own dependency range.
Other overrides, install-script policy, test isolation and coverage thresholds
remain unchanged. No new service, application runtime dependency, API, schema,
Compose setting or release version changed.

Added five ESM environment contracts to normal Vitest discovery. They test hidden
focus targets, retained selection after form reset, stylesheet edits, checked
state and real loopback HTTP loading/redirect/404 handling after native fetch.
Scripts in retrieved HTML remain disabled. Test windows and the owned HTTP server
are closed in cleanup; no external provider or application data is used.

The [separate design](jsdom-30-1-2-design.md) records the options, official sources
and verification plan. The dependency-update skill required an exact lockfile
review and separate testing of transport compatibility, not just a version bump.

## Lockfile review

Fourteen package records changed version; no package was added. One redundant
nested `whatwg-url` record was removed. All changed records are development-only,
use the npm registry and match its published SHA-512 integrity metadata. No
install hook was added or newly authorized; optional canvas remains uninstalled.

| Package | Before | After |
| --- | --- | --- |
| jsdom | 30.1.1 | 30.1.2 |
| Undici | 7.29.1 | 8.11.2 |
| @asamuzakjp/css-color | 7.0.1 | 7.1.3 |
| @asamuzakjp/dom-selector | 9.2.1 | 9.2.4 |
| @csstools/color-helpers | 6.1.1 | 6.1.2 |
| @csstools/css-calc | 3.4.0 | 3.4.3 |
| @csstools/css-color-parser | 4.2.3 | 4.2.6 |
| @csstools/css-parser-algorithms | 4.0.0 | 4.0.2 |
| @csstools/css-syntax-patches-for-csstree | 1.1.14 | 1.1.15 |
| @csstools/css-tokenizer | 4.0.1 | 4.0.2 |
| @exodus/bytes | 1.15.1 | 1.16.0 |
| data-urls | 7.0.0 | 8.0.0 |
| tr46 | 6.0.0 | 7.0.0 |
| whatwg-url | 16.0.1 + nested 17.1.2 | 17.2.0 |

The [data-urls 8 release](https://github.com/jsdom/data-urls/releases/tag/v8.0.0)
raises its Node minimum, satisfied by our pinned runtime. The
[tr46 7 release](https://github.com/jsdom/tr46/releases/tag/v7.0.0) also raises its
minimum and adopts Unicode 18; [whatwg-url 17.2](https://github.com/jsdom/whatwg-url/releases/tag/v17.2.0)
uses that newer domain-name support. These major transitive changes were reviewed
explicitly rather than assuming jsdom's patch release had only patch dependencies.

## Verification

- On the old installed graph, the four new DOM assertions failed with the
  expected wrong focus/selection/style values. The HTTP case hit its five-second
  deadline; that observation alone does not isolate which old dependency caused it.
  All five passed with the updated graph, including the actual loopback requests.
- Lockfile generation with scripts disabled and then clean `npm ci` under strict
  policy passed. `npm ls --all` reported a valid tree.
- Client npm audit, including development dependencies: **zero findings**, both
  before and after. OSV Scanner 2.6.0: **1,142 entries** across all three lockfiles,
  no issues, no advisory exclusions. These point-in-time results do not establish
  that undiscovered vulnerabilities cannot exist.
- Dependency/toolchain policy tests: **30 passed**, no skips. Client lint and both
  Vue typechecks passed. Production build passed in 1.87s. Copyright and npm CLI
  flag checks passed.
- Chromium modal/preset tests: **7 passed** (11.2s). Production-route browser
  checks: **8 passed** (8.7s), including the existing asset budgets. No retries or
  skipped cases. Existing NO_COLOR/FORCE_COLOR runner warnings remain visible.
- Full client coverage: **432 files / 6,227 tests passed**, no skips, 292.02s.
  Statements 86.60%, branches 79.45%, functions 86.17%, lines 88.48%: unchanged
  from the preceding client report. This is not a controlled speed benchmark.
- Final lint passed without warnings. Markdown validation, diff whitespace and
  the final staged secret scan passed.

The first coverage run found that the new test's trailing timeout argument did not
meet the repository's closing-line convention. Moved the unchanged timeout into
Vitest's options argument and restarted the full run. No assertion, timeout,
coverage threshold or check was weakened.

A lint run overlapping the compiler-contract tests saw an intentionally invalid
temporary Vue fixture. Final lint runs after coverage, once fixture cleanup has
finished. This is validation ordering, not a lint-rule suppression.

Ignored local evidence: `.tmp/jsdom-update-*.log`, audit JSON, registry metadata
and `.tmp/dependency-review-*-outdated.json`. Full backend tests and the combined
coverage ratchet are not rerun for this client-only change; previous backend
coverage is not presented as fresh whole-repository evidence.

## Recommendation stack and limits

1. **Keep the tested DOM refresh.** Better focus/style fidelity and an upstream
   transport dependency range; cost: fourteen reviewed development-package changes
   and same-day-release risk. No measured application speed or memory claim.
2. **Next: review the server's Discord Undici pins.** Both currently force 6.28.1
   within a compatible `^6.27.0` parent range. The official
   [Undici releases](https://github.com/nodejs/undici/releases) list 6.29.0 fixes.
   Test terminal-body/upgrade lifecycle and Discord adapters in isolation before
   changing these production dependencies. Do not force Discord onto Undici 8.
3. **Retain intentional compiler/runtime alignment.** The remaining direct
   `outdated` results are Node 26 types and client TypeScript 7. Keep Node 24 types
   and the documented Vue-compatible TypeScript 6 pin until support changes.
4. **Keep real-browser and human accessibility acceptance separate.** jsdom does
   not prove layout, native modal behavior, screen-reader behavior or WCAG
   conformance. Do not remove browser tests because these DOM tests pass.

GitHub MCP and the saved CLI login both returned **zero open Classifarr PRs**.
No random PR could be selected; none was merged or substituted. No release, tag,
new branch, Docker rebuild or live deployment is part of this round.
