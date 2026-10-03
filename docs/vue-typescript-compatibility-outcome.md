# Vue TypeScript compatibility outcome

Date: 2026-10-03. Local execution: Windows, Node 24.21.0 and npm 12.2.0.
Starting revision: `788d888256c6c899b0bebbced82f70fa7b69a59d` on `main`.

## Delivered

Retained the current stable Vue 3.5.43 and vue-tsc 3.3.12. The frontend TypeScript
compiler remains 6.0.3, now explicitly pinned; no resolved dependency version or
integrity changed. TypeScript 7.0.2 remains in the root/server workspaces. The
reason is compiler API compatibility, not an unsupported Vue runtime. See
[the design and official sources](vue-typescript-compatibility-design.md).

Refactored the client compiler configuration into shared ESM/bundler settings,
the existing API/configuration project and a strict component project. The normal
`npm run typecheck` command now runs both scopes, so the existing CI step checks
Badge, Button, Card and Spinner as well as the API files. The API project's
existing non-strict settings are preserved. The component project enables strict
templates and does not load the legacy wildcard Vue declaration or Node globals.

Removed the unused `ignoreDeprecations` setting after a successful baseline check.
Documented Badge's string-keyed style lookup with JSDoc; its props, rendered HTML,
classes and fallback behavior are unchanged. New tests cover all five badge
variants, an unknown variant, slots, the default and reactive updates.

The ESM compiler suite runs the installed Vue CLI with bounded time, V8 heap and
output, without a shell or inherited credentials. Synthetic fixtures exercise
valid imports/refs/templates, real common components through the workspace alias,
and five invalid cases: a real component prop, an implicit-any parameter, a
JSDoc assignment, a template expression and a child-component prop. Only the
expected source-mapped diagnostic satisfies a negative test.

## Verification

- Original client typecheck: passed before edits; the split API/component checks
  and client lint pass after the refactor.
- Compiler contract: seven tests passed. A deliberate temporary `noCheck: true`
  mutation made all five negative cases fail while both positive cases passed.
  The mutation was removed before final checks; no suppression was retained.
- Clean `npm ci` under strict lifecycle policy and `npm ls --all`: passed.
- Lockfile review: only the root client manifest range changed from `^6.0.3` to
  `6.0.3`; no package additions/removals, new scripts or override changes.
- npm audit including development dependencies: zero reported vulnerabilities.
- OSV Scanner 2.6.0: 1,143 entries across all three lockfiles, zero issues and no
  advisory exclusions. This is point-in-time evidence, not a security guarantee.
- Dependency/toolchain policy tests: 30 passed, no skips.
- Production client build, ESM static-import check, npm CLI flag check, copyright
  and whitespace validation: passed.
- Full client suite with coverage: **421 files, 5,974 tests passed, no skips**.
  Statements 86.28%, branches 79.02%, functions 85.70%, lines 88.16%.
  This includes all seven compiler contracts and seven Badge regression tests.
- Markdown validation: 1,820 documents, zero errors. Gitleaks found no secrets
  in the staged patch.

No backend code or dependency changed. Full backend tests, combined coverage
ratchet, browser/image rehearsals and Docker rebuilds were not rerun for this
compiler/configuration-only batch. New client coverage must not be combined with
an old backend report to claim fresh whole-repository coverage. This does not
establish release readiness or fix earlier intermittent installation failures.

## PR availability and next steps

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs.
No random PR could be selected or implemented, and none was merged. No replacement
PR was invented. No branch, version bump, tag, release, live deployment or user-data
change is part of this work.

Recommendation stack:

1. Keep Vue 3.5.43 + vue-tsc 3.3.12 + TypeScript 6.0.3 with the executable checks.
   Benefit: supported checking without extra packages. Cost: no native TS 7 client
   speedup and extra compiler/test execution time in CI.
2. Next, enroll the shared form controls (Input, Select, Toggle and Slider) in
   strict component checking. Model event targets and prop types accurately;
   preserve behavior and test interactions rather than introducing `any` casts.
3. Expand strict checking through the remaining UI in reviewed groups. These
   four components and fixtures are not evidence that all Vue screens are checked.
4. Revisit TS 7 after Microsoft ships its API and Vue releases compatible tooling.
   Do not switch to a Vue prerelease or duplicate native compiler without a need.

The dependency-update skill kept the compiler decision tied to upstream support,
required lockfile/install review and retained negative diagnostic checks rather
than forcing an incompatible version upgrade.
