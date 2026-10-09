# Node declaration PR 555 outcome

Date: 2026-10-05. See [review and recommendation](node-types-pr-555-design.md).

Rechecked again on 2026-10-09 for backfill-readiness diagnostics. Open candidates
were 555 and 556; a fresh `Get-Random` draw selected 555 at the same immutable
head. Applied the exact GitHub MCP diff on main: 8/8 baseline, 7/8 candidate
(client Node-major mismatch), 8/8 after reversing only the trial. Official npm
registry metadata matched the candidate dependencies and both package integrities.
No candidate install or merge occurred. Current client `npm outdated` also lists
Playwright 1.64.0 and Vue Router 5.4.0 as compatible-range candidates, and the
separately held TypeScript 7.0.2 major. None are included in this diagnostic change.

Rechecked 2026-10-09 for the evaluation-activity batch. The saved GitHub CLI login
listed open non-draft PRs 555 and 556; a PowerShell `Get-Random` draw selected 555,
still at `5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact manifest and
lockfile diff locally on main. On pinned Node 24.21.0, the existing compatibility
gate passed 8/8 before, failed 1/8 with the candidate, and passed 8/8 after removing
only the trial. The failed check was the client Node declaration major (26 versus
deployed 24). The candidate was rejected at this pre-install gate: no dependency
installation, candidate runtime testing, merge or PR modification is claimed.

Repeated during the saved-deployment admission batch: a fresh GitHub MCP/CLI
enumeration found open PRs 555 and 556. A `node:crypto.randomInt` draw selected
555, still at `5545605b53c854de8847b44e24fa083ff4218080`. The exact two-file
trial again reproduced 8/8 baseline versus 7/8 candidate. Only the trial was
reversed; no package installation or merge occurred.

Applied the exact two-file diff from open PR 555's immutable head locally on main,
without fetching or merging a branch. The existing runtime-baseline test passed
8/8 before the change, then failed 1/8 with it: the client declaration major was
26 while the deployed Node major is 24. This is a reproduced compatibility-policy
failure, not evidence that every application API breaks at runtime.

Removed only that trial diff; the unchanged baseline test then passed 8/8 again.
The complete dependency/tooling test set then passed all 30 tests.
No packages were installed, install scripts executed,
security overrides relaxed or runtime versions changed. The PR remains open and
unmerged; its update is not retained in the final tree. Full install, audit,
typecheck and browser tests of the rejected candidate are not claimed.

Registry metadata confirmed 26.6.4 and its `undici-types ~8.9.0` dependency and
matched the reviewed lockfile integrity. Scoped `npm outdated` reported the client
installed/wanted version as 24.19.1 and latest as 26.6.4. It did not identify a
newer compatible 24.x update for this batch.

Keep Node 24-compatible declarations now. Evaluate a future runtime major and its
types together as a separately tested image/toolchain update. The dependency skill
kept the experiment scoped and prevented weakening the compatibility gate.
