# Node declaration PR 555 outcome

Date: 2026-10-05. See [review and recommendation](node-types-pr-555-design.md).

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
