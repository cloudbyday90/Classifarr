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

PRs 569 and 570 retained their previous heads after the earlier documented
Dependabot rebase requests. PR 573 targets qs 6.17.0 and remains a separate minor
update. The connected GitHub tool has no branch-update operation. The
[official GitHub CLI command](https://cli.github.com/manual/gh_pr_update-branch)
supports rebasing, but the local CLI authentication returns HTTP 401. Existing
Git remote credentials worked. Rebases used temporary detached worktrees and
explicit old-head force-with-lease protection. The application checkout remained
on main; no new branch was created. The temporary worktrees were removed after
the remote updates were verified.

The tested code commit, 6bcaea15c36d09919fd57ffa13f602ae2eace971, was pushed
to main and its remote SHA verified. PR 571 was then closed without merging.

| PR | Verified rebased head | Verification |
| --- | --- | --- |
| 569 | 448411f504713b581cb471585b3cc7581df68ec2 | Identical relative patch in `git range-diff` |
| 570 | 808ca1a680af4eeedc9a2ef25532c09b9a9c1a83 | Identical relative patch in `git range-diff` |
| 573 | 50cff01c07b192626b12ceb83560f7f3ad5d86a4 | Only qs override and qs package record change from new main |

All three heads have that tested code commit as their direct parent. GitHub MCP
reports them open, unmerged and mergeable. For PR 573, the rebase conflict was
resolved by preserving the full new main graph, retaining its original
`>=6.17.0` override and immutable provider qs 6.17.0 lock record, then regenerating
the lock with scripts disabled. Structured comparisons verify no other manifest
or lock changes. Main retains its exact 6.16.1 security override.

These are observed rebase receipts, not a claim that PR 569/570/573 changes passed
local feature tests or new remote CI. Their implementations remain outside main;
only randomly selected PR 571 was implemented and tested locally. Dependabot's
asynchronous status banner may lag the verified Git refs. No ignore command,
provider merge, release, tag or deployment was used. The final documentation
receipt is a separate main commit after these rebases.
