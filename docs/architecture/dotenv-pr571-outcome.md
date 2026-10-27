# Dotenv PR 571 outcome

Date: 2026-10-27. The [design](dotenv-pr571-design.md) records the random
selection, immutable provider head, exact version and tradeoffs.

## Local implementation and checks

The server now pins dotenv 18.0.9. Its manifest/root lock entry and package
version, integrity and resolved tarball match the reviewed provider diff.
Parser changes in the same final lock are separately documented in the
[security outcome](runtime-parser-security-outcome.md). No install-script
permission or runtime configuration-loader change was needed.

The added CLI regression fails on 18.0.8 with EISDIR for an empty DOTENV_PATH.
It passes on 18.0.9 using a synthetic temporary .env file while retaining an
external value and quiet output. Existing side-effect import, explicit paths,
override options, missing-file behavior and ordinary parsing controls pass.
The combined focused run passes all 94 tests; 19 belong to the dotenv suite.
The repository .env and host DOTENV settings are excluded from these child tests.

Clean install, package-tree validation, server lint/typechecking, both Knip
scans, ESM checks and 59 dependency-tooling tests pass. Full backend coverage
passes 1,881 suites and 60,470 tests, with one existing skip. Three disposable
PostgreSQL integration suites pass 76 tests. The security outcome records exact
commands, coverage and audit limits. No PR has been merged.

## Pull-request housekeeping

PRs 569 and 570 still have their previous heads despite the earlier documented
Dependabot rebase requests. PR 573 targets qs 6.17.0 and remains a separate minor
update. The connected GitHub tool has no branch-update operation. The
[official GitHub CLI command](https://cli.github.com/manual/gh_pr_update-branch)
supports rebasing, but the local CLI authentication returns HTTP 401. Existing
Git remote credentials remain the fallback: use temporary detached worktrees,
compare each PR's relative change before/after and push its existing ref with an
explicit old-head lease. The application checkout stays on main; no new branch
is created. After the validated main commit is pushed, refresh those PRs against
that exact main and record observed results. Close PR 571 as implemented locally
after the push; closing is not a provider merge. Final receipts are pending.
