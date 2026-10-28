# GitHub Actions PR 569 outcome

Date: 2026-10-27. The [design](actions-pr569-design.md) records the random draw,
immutable provider diff, official release research, alternatives and safeguards.

## Local implementation

Docker Login uses exact commit 81c6f93d4bc991e510b342a00b419b3bb4efc5c6
(4.7.0) in the four existing release-build/promotion steps. CodeQL init, analyze
and both SARIF upload steps use 9b3254085494b55a0f7c4c2b3d2d52cc712ce370
(4.39.1). The four workflow files match the immutable provider changes.

Two repository-owned contracts also needed their reviewed pin updated: the
promotion validator's exact Docker Login allowlist and the security workflow
test's CodeQL assertion. The first candidate run rejected the stale validator
pin (303 passed, one failed), demonstrating that the allowlist remained active.
The corrected candidate passes; the validator still requires one exact commit
and all existing permissions, event gates, evidence checks and failure behavior.
No package manifest, lockfile, application route or runtime service was changed.

## Verification

Pinned local tools: Node 24.22.1 and npm 12.2.1. No global tool was upgraded.

| Check | Result |
| --- | --- |
| Exact upstream Git tags and MCP action metadata | Candidate commits verified; CodeQL annotated tag peeled to the expected commit; all candidate actions declare Node 24 |
| Baseline workflow/receipt suites | 9 suites, 304 tests pass |
| Final workflow/receipt suites | 9 suites, 304 tests pass |
| actionlint, default settings, all four changed workflows | Pass |
| Server source/test ESLint and TypeScript | Pass |
| Existing publication, provenance and installation-evidence validator CLIs | Pass |

The focused command was run from `server` with `node scripts/run-jest.mjs
--runInBand --no-coverage` and the existing security, Docker pull, publication,
image-promotion, installation, provenance, runtime-installation receipt and
release-candidate evidence test paths. This includes rejection paths for
privileged events, credential leakage, masked failures and missing/mismatched
receipt evidence. No parallel validator was created.

Actionlint was rerun with its default settings after an initial explicit
optional-tool configuration; the final result does not rely on disabling those
checks. Full application coverage, frontend tests and database integration were
not repeated for workflow pins and exact-pin contract updates. No registry login,
hosted CodeQL scan, image rehearsal, release or deployment was executed. Local
contract checks do not establish those remote outcomes or release readiness.

## Delivery and housekeeping

Commit/push and PR housekeeping receipts will be recorded after final document,
whitespace and staged secret checks. PR 569 will be closed as implemented locally,
without merging. The remaining open Dependabot PR 570 will retain its own changes
and be refreshed against the new main with explicit old-head lease protection.
