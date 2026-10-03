# Lint tooling refresh outcome

Date: 2026-10-03. Started on clean `main` at
`62f547ea976192b04b5ec37bbb81f016b64c8272`. See the
[design, alternatives and official sources](lint-tooling-refresh-design.md).
No release, version bump, branch, deployment or live database change is included.

## Delivered

- Client and server: ESLint 10.11.0 → 10.12.0, globals 17.12.0 → 17.13.0,
  and Node declarations 26.6.2 → 24.19.1 to match the deployed Node 24 major.
- Server: Node lint plugin 18.3.0 → 18.4.1 and security plugin 4.0.1 → 4.2.0.
- The existing server security scope now rejects literal U+3164 and U+FFA0.
  Normal international text and explicit Unicode escapes remain valid. This
  does not sanitize user input or change media metadata.
- ESM tests exercise actual lint configurations: native imports, missing imports,
  dynamic evaluation, hidden/bidi characters, focused tests, browser globals,
  native button markup and undefined Vue components.
- The existing toolchain suite now checks manifest/lockfile Node-type alignment.
  Node 24.21.0 and npm 12.2.0 remain unchanged; no global installation was updated.

Reviewed lockfile changes are limited to those packages and `undici-types`
8.9.0 → 7.24.6, selected by the Node 24 declarations. This is a declaration
package, not a runtime Undici change. The Node plugin's new `js-yaml` dependency
resolves to the already-reviewed 5.4.2 installation. No package entries, installer
permissions, overrides or production dependencies were added or removed. The
existing nested Node 18 types owned by `@types/ssh2` remain untouched; they are
not the application's direct Node API declarations.

## Findings resolved during validation

The new alignment tests failed against the original Node 26 declarations, and
the backend lint regressions exposed the missing invisible-character rule before
the update. Both now pass without weakening existing rules.

Node 24 typings exposed an inferred `string[][]` passed to `URLSearchParams`.
The HTTP helper now explicitly describes its existing `[string, string][]`
shape using JSDoc. Six regression cases preserve nullish omission, no spurious
question mark, false/zero/empty values, string conversion and encoded Unicode,
spaces and delimiters. No request behavior, TLS policy or API contract changed.

The ownership gate initially failed only with `parser_review_changed`. All 751
reviewed source and analysis digests still matched under ESLint 10.12.0. The
review manifest changes only its parser version, not any source fingerprint,
classification, rationale or gate logic. The passing scanner still reports
2,895 scanned files, 140 candidates, 307 analysis gaps and 495 unresolved
entries; `productionCompatible` remains false. These counts describe conservative
static review, not proof of runtime ownership or a count of defects.

The first frontend lint-contract attempt used a file URL transformed by the
Vitest environment. It was corrected to the repository's `import.meta.dirname`
pattern. Test isolation and the production/test lint scopes were not changed.

## Verification

All local checks use pinned Node 24.21.0/npm 12.2.0. Initial lockfile generation
disabled lifecycle scripts; subsequent clean installs used the unchanged strict
install policy.

- Clean client/server `npm ci` and full dependency trees: passed.
- Client/server npm audits, including development dependencies: zero findings.
- OSV Scanner 2.6.0: zero findings across all three lockfiles, 1,143 package
  entries, with no exclusions added. Scanner image:
  `sha256:71ad04ab2f8798be47870f9b18817ad317c2f8f2f97aa6726ba10d5578bc174a`.
  These results describe known advisories on this date, not guaranteed safety.
- Both workspaces' type checks: passed after the tuple annotation.
- Backend focused run: 6 suites, 124 tests passed, including HTTP transport,
  cancellation/response limits, lint contracts and ownership scanner/gate tests.
- Frontend focused run: 2 suites, 7 tests passed.
- Full frontend coverage: 419 suites, 5,956 tests passed, zero skips. Line
  coverage 88.16%, branch coverage 79.02%; isolation and worker limits unchanged.
- Frontend production build: passed.
- Toolchain/install-policy regressions: 30 tests passed, zero skips.
- CI preflight: copyright, ownership drift and both Knip modes passed.
- Final full lint, static-import and ESM mock-shape checks: passed.
- Markdown lint, whitespace check and staged secret scan: passed.

The full backend suite, a new combined coverage ratchet, browser accessibility checks and
production-image rehearsal are not claimed for this tooling batch.

## PR availability and existing CI failure

GitHub MCP and the saved-login GitHub CLI returned no open Classifarr PRs. A
second CLI check also returned an empty list. No random selection was possible;
no closed PR was substituted, and nothing was merged.

The starting commit's [installation job](https://github.com/cloudbyday90/Classifarr/actions/runs/37142677429/job/111260170320)
failed during this work. It passed fresh setup, backfill recovery, published
startup/export and volume migrations, then reported an exited container after
`container_killed_during_restore`. The job recorded exit 1, no OOM and no recognized
startup signal. That failure predates this patch; these logs alone do not identify
its cause. The database job passed. None of those results validates this new patch.

## Recommendation stack

The interrupted-restore follow-up is recorded in the
[diagnostics investigation](architecture/restore-ci-diagnostics-outcome.md).

1. Inspect the new commit's CI and reproduce the interrupted-restore startup
   failure with the exact image in a disposable environment. Diagnose before
   changing health deadlines or recovery assertions; keep release gates blocking.
2. Resume bounded Testcontainers/Supertest/Knip updates after that investigation.
3. Keep the Vue TypeScript 7 migration separate.
4. Review primary UI workflows for keyboard, focus, accessible names, live status
   and contrast with automated and manual checks. Lint success is not WCAG proof.

The dependency-update skill kept this batch limited to compatible lint tools and
runtime-aligned declarations. The benefit is clear failure attribution and
reproducible installs; the cost is additional review when parser versions or
types expose assumptions. Prefer that process over a blanket tooling upgrade or
suppressed validation errors.
