# JavaScript Vue event checking: outcome

Date: 2026-10-03. Starting revision:
`9883041e674da4066d2374c80935be387153bb85` on `main`.
Local environment: Windows, Node 24.21.0 and npm 12.2.0.

## Delivered

Reproduced the false-negative JavaScript v-on callback checks with the installed
Vue tooling. The supported listener-prop path checks both explicitly typed
handlers and inferred inline arguments. Changed the native listeners in Input,
Select, Slider, Toggle and Button to this path. The eight-component strict scope
is unchanged; no package, lockfile, compiler relaxation or third-party patch is
part of the mitigation. All new application/test code remains ESM JavaScript.

Button now declares its mouse-event payload and forwards the original event once.
It also ignores synthetic clicks while disabled or loading. Its native button,
keyboard behavior, default type and other props remain intact.

The existing Vue ESLint rule rejects v-on in the enrolled paths and rejects
hyphenated listener-prop keys without `.camel`. Its scope is read directly from
the strict typecheck configuration. It deliberately does not rewrite modifiers,
inline statements or unreviewed screens. No new lint plugin or event abstraction
was introduced. The bounded compiler test runner is now a shared ESM test helper.

See [design, alternatives and official sources](vue-event-checking-design.md).

## Findings during verification

- Baseline typechecks passed while the incorrect JavaScript v-on handler was
  accepted. Passing configuration checks alone did not cover this contract.
- The first browser delivery test failed: hyphenated component listener props
  typechecked but never delivered callbacks. Adding `.camel` restored runtime
  delivery. A lint regression now prevents that spelling mistake in checked paths.
- Two initial negative assertions expected TS2339, but TypeScript reported its
  more specific TS2551 suggestion for `string.toFixed`. The assertions now require
  that exact source-mapped diagnostic; arbitrary compiler failures still cannot pass.
- Temporary exploratory fixtures were removed after they surfaced in normal lint.
  No lint exclusion or error suppression was added to hide them.

## Verification

- Clean client `npm ci` under strict lifecycle policy: passed, 288 packages
  installed. No manifest or lockfile changed.
- `npm ls --all`: passed. npm audit including development dependencies: zero
  reported vulnerabilities on the research date.
- OSV Scanner 2.6.0: 1,143 entries across all three lockfiles, no reported issues.
  Existing advisory-filter configuration is unchanged. These are point-in-time
  scanner results, not proof of overall security.
- Real-compiler contracts: 11 existing plus 12 event contracts, with clean
  positive cases and exact negative diagnostics. Native and component listener
  payloads are exercised independently.
- Real ESLint contracts: 17 tests cover all eight enrolled paths, unsupported
  v-on forms, `.camel`, allowed listener props and the out-of-scope boundary.
- Runtime tests cover original-event identity, no render-time callback, disabled/
  loading suppression, caller/native listener merging and single model delivery.
- Chromium: two tests passed with one worker and no retries. Exact callback
  counts cover all four model controls and Button, alongside keyboard interaction,
  native validity, accessible descriptions and zero unintended submissions/API calls.
- Dependency/toolchain policy suite: 30 tests passed, no skips.

- Final full client coverage after the clean install: **425 files, 6,041 tests
  passed, no skips**, in 234.87 seconds. Statements 86.34%, branches 79.07%,
  functions 85.78%, lines 88.21%.
- Final client lint, API/component typechecks and production build: passed.
  Chromium was rerun successfully after the clean install as well.
- ESM static-import check, npm CLI flag check, copyright and whitespace checks:
  passed. Markdown validation: 1,824 documents, zero errors.
- Gitleaks found no secrets in the staged patch.

The browser runner's existing `NO_COLOR`/`FORCE_COLOR` warning remains visible.
Backend suites, combined coverage ratchet and Docker image/live-data rehearsals
were not run for this client-only change. Do not combine old backend coverage
with the current client report or claim a completed remote CI run from local tests.

## Limits and recommendation stack

This mitigates explicit listener checking in the enrolled components. It does
not fix upstream JavaScript v-on checking, validate all screens or make Vue's
model modifiers fully type-aware. Runtime validation and tests remain necessary.
No upstream issue or PR was opened as part of this work.

1. Keep the bounded listener-prop approach now. Benefit: checked payloads without
   a dependency fork or source-language migration. Cost: less familiar syntax
   and an explicit casing rule.
2. Next modernize PasswordInput: accessible visibility-button name, linked
   label/hint/error, native attribute routing and strict checks.
   Follow-up: [PasswordInput design](password-input-design.md) and
   [outcome](password-input-outcome.md) implement this next step.
3. Enroll further components and screens in reviewed batches. Consider a separate
   TypeScript migration only when its broader tooling/source cost is justified.
4. Retest ordinary v-on when upstream publishes a compatible fix, then remove
   this temporary syntax constraint only after compiler and runtime tests pass.

## PR and release scope

Both GitHub MCP and the saved GitHub CLI login returned zero open Classifarr PRs.
No random PR was available to implement; none was invented, reopened or merged.
Work stays on `main`, with an Unreleased changelog entry. No version bump, new
branch, tag, release, deployment or user-data change is included.

The dependency-update skill kept the compiler decision grounded in the installed
versions and required clean-install/security checks without forcing an upgrade.
Plainspoken guidance kept the conversational handoff short; these documents keep
the detailed findings and limits.
