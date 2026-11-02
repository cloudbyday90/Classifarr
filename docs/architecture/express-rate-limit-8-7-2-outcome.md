# Express rate limit 8.7.2 local adoption outcome

Date: 2026-11-02 (America/New_York). Status: locally implemented and verified.
Design: [selection, tradeoffs and official sources](express-rate-limit-8-7-2-design.md).

## Applied change

Randomly selected open [PR 577](https://github.com/cloudbyday90/Classifarr/pull/577)
was reviewed at immutable head b23c2195a321f7cb38ecf3a251c71093ed3880e6. Its
express-rate-limit 8.7.1 to 8.7.2 patch was implemented locally on main, using an
exact 8.7.2 direct dependency under repository policy. No PR merge occurred.

Lock generation used scripts disabled. Review found only the direct version,
resolved artifact and integrity changing; no package additions, removals or
transitive version changes. The published lock entry has no install-script flag.
The registry's development prepare script does not require allowing a new
installer. npm ci passed under unchanged strict-allow-scripts and existing
explicit installer decisions; npm ls --all and tooling dependency policy passed.
Node 24.22.1 and npm 12.2.1 were used throughout.

## Behavior and audit

Two actual Express HTTP regressions first failed on installed 8.7.1. A held
request crossed the MemoryStore reset boundary; its later skipped response
incorrectly reduced the current window's count. Both skipFailedRequests and
skipSuccessfulRequests scenarios passed on 8.7.2 and correctly returned 429 for
the next excess request. The tests control only the clock reading while using
actual HTTP responses and the default store.

Application limit values, stores, headers, test bypasses and authorization
policy are unchanged. Production-source search found neither affected skip
option; this is dependency hardening, not proof of an application exploit or a
complete security assessment. The full backend run also covers existing limiter
consumers; its final receipt is recorded in the
[fence outcome](capture-finalization-fence-outcome.md).

On November 2, full server npm audit including development dependencies reported
32 findings: 3 low, 29 moderate, 0 high and 0 critical. A separate audit of the
original main lockfile produced the same counts and affected package set. Every
affected node is development-only in the reviewed lockfile. The audit feed did
not remove an entry for this patch; the maintainer advisory and before/after HTTP
regression are separate evidence. These results do not establish absence of
other vulnerabilities.

The backlog includes ESLint, Jest and Testcontainers dependency chains. Some
suggested automatic fixes are major downgrades or unavailable; none was applied.
Assess their supported upstream remedies in a separate tooling batch without
disabling scanners, lifecycle restrictions or peer checks.

## PR and delivery boundary

GitHub MCP recheck found PR 577 still open and mergeable at the reviewed head;
all five Dependabot PRs remain open. They were fresh and based on the intake main
commit, so no stale branch was rebased or rewritten during implementation.
The delivery source and remote main matched the intake base before commit;
none of these fresh PRs needed a stale-branch rewrite. A branch merely falling
behind this local implementation is not evidence that its independent update
needs rebasing. No bot message, PR merge, release, deployment or application
policy change was performed. Root/client updates remain separate. Full backend,
fresh frontend, dependency/quality checks and the coverage ratchet passed, as
recorded in the linked fence outcome.
