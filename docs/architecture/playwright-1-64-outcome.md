# Playwright 1.64 tooling outcome

Validation started 2026-10-11 on main. See the
[design and official sources](playwright-1-64-design.md). No release or version bump.

## Implemented

Pinned `@playwright/test` to exact 1.64.0, with matching `playwright` and
`playwright-core` 1.64.0. The final lock diff changes only those three packages;
it adds/removes no packages, lifecycle scripts, platforms or overrides. Installed
the matching Chromium 156.0.8078.4 using `--no-remove`, preserving other projects'
browser installations. Runtime dependencies, Node 24.21.0 and npm 12.2.0 are unchanged.

An ESM tooling contract now rejects a ranged Playwright declaration, mismatched
lock entries, runtime promotion or implicit browser installation. The existing
CI tooling suite runs this contract. Two browser tests now use the current
recovery-history label and open the collapsed advanced diagnostics by keyboard.
No assertions, deadlines, retries, screenshots, runtime UI or safeguards were relaxed.

## Random open PR trial

Fresh enumeration found two open PRs. Random selection chose
[#557](https://github.com/cloudbyday90/Classifarr/pull/557), head
`83d8f8ad94b3025fd00655a6a23e746375af0114`. Its exact proposal was applied locally:
Playwright 1.64.0 plus Node declarations 26.6.4 and undici-types 8.9.0. Strict
installation, dependency-tree validation, all-dependency audit and both client
typechecks passed. The runtime/declaration policy correctly failed: Node 26 types
do not describe the deployed Node 24 runtime.

Restored Node declarations 24.19.2 and undici-types 7.24.6; retained and separately
tested the exactly pinned Playwright portion. This is **partial adoption after a
local trial**, not acceptance of the whole PR. The remote PR was not merged,
closed or edited; no branch was created.

## Validation evidence

All commands used the repository-pinned Node/npm tools.

| Check | Observed result |
| --- | --- |
| Normal strict client `npm ci` | Passed; existing lifecycle policy retained |
| Client `npm ls --all` | Passed |
| Client `npm audit --json`, including development dependencies | Zero reported vulnerabilities at validation time; not a blanket security guarantee |
| Root dependency/tooling tests | 41/41 passed |
| Client ESLint | Passed |
| Both client typecheck scopes | Passed |
| Complete Chromium suite, one worker, zero retries, forbid-only | 75/75 passed |
| Production build and policy-route browser suite | 8/8 passed |
| Full client coverage suite, two workers | 457 files / 6,881 tests passed; statements 87.25%, branches 81.01%, functions 86.88%, lines 89.02% |
| Copyright, ESM syntax and static-import checks | Passed |
| Markdown | 2,115 files passed |

The first 1.64 browser run passed 72/75: one cold auth-page navigation exceeded its
existing deadline, and two expectations were stale. Testing those same three cases
unchanged on 1.63 reproduced the two stale expectations; auth passed. After the
test corrections, the final complete 1.64 run passed 75/75 without retries. An
intermediate exact-regex label correction still failed on template whitespace;
the final exact text locator uses Playwright's text normalization. These failures
are retained as evidence, not hidden by retries or snapshot regeneration.

Backend code, API contracts and database schema are unchanged. No fresh full
backend coverage or combined coverage ratchet is claimed for this tooling batch.
Local browser results are not Firefox/WebKit coverage or remote CI results.

## Local image and database rehearsal

Before replacement, a 75,570,753-byte custom-format database backup passed checksum
and archive-readability verification. The rollback image is
`sha256:b561031e39a4df95c078865c644ee954b4e018277584ad8a56663a3a46aae5be`;
the private backup and rollback tag are retained locally, not committed.

Pending clean-source no-cache build, local-only replacement, health checks and
isolated schema dump. These checks must complete before the final handoff; no
production or shared-provider change is authorized by this document.

## Next item

The newly reported scheduler incident has a confirmed, automatically recovered
database statement timeout. See the separate
[read-only diagnosis](description-refresh-timeout-2026-10-11-outcome.md).
Prioritize safe failure attribution: preserve an allowlisted operation stage,
database error category, duration and shared incident reference through recovery
and scheduler reporting. Profile a disposable restored dataset under controlled
load before changing query behavior or resource budgets.

Then return to the separately researched Vue Router 5.4 tooling batch. Do not
combine that with client TypeScript 7 or Node 26 declarations. The dependency
skill enforced the exact reviewed graph and PR trial; the recovery skill kept
the incident investigation read-only, and the release-evidence skill requires
exact-source/image and isolated-database evidence without implying a release.
