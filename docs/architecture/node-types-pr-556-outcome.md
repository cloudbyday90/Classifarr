# Server Node declaration PR 556 outcome

Date: 2026-10-05. See [design and sources](node-types-pr-556-design.md).

The restricted-restore HTTP batch at base `c752c2cf` freshly enumerated PRs
555/556 and randomly selected 556, still open at
`9d74537d7917c248d15926f37b2e40ceba7559a4`. MCP supplied the same two-file diff;
official registry metadata confirmed the version, dependency and integrity.
Local application again changed nine lines each way: baseline 8/8 passed,
candidate 7/8 passed with the unchanged Node-major check rejecting 26 on Node 24.
Only this trial was removed. No candidate install or remote merge was performed.

The subsequent operator-tuning batch at base
`d540b4e4e84d9be485b7822bc6384c2ecd9492e3` independently enumerated open PRs
555/556 and randomly selected 556 again. MCP confirmed it remained open and
unmerged at the same head. Registry metadata and the exact applied two-file
diff were unchanged: 8/8 baseline tests, 7/8 candidate tests (Node-major failure).
The trial was removed before installation; no PR merge or dependency upgrade.

Rechecked during the selected-configuration batch at base
`df6fd77db323cfc96141b46b36d0063ea5cc6d09`: a fresh random draw from the two
currently open PRs again selected 556 at the same immutable head. Registry
metadata and the two-file diff were unchanged. Repeated the local apply/test/
remove sequence below: 8/8 baseline, 7/8 candidate, then 30/30 tooling checks.

Applied the exact reviewed PR diff locally on main, without merging a branch.
Runtime-baseline tests passed 8/8 beforehand; the candidate passed 7/8 and failed
the unchanged server Node-major alignment check (26 versus deployed 24).
Removed only the trial diff, after which all 30 dependency/tooling checks passed,
including the eight runtime-baseline tests.

The dependency skill kept the test authoritative: no engine relaxation, security
override or test weakening. No candidate install or install scripts ran. Full
candidate audit, typecheck and runtime compatibility are not claimed. The PR is
still open and unmerged; its rejected update is not retained in the checkout.

Keep Node 24 declarations. Review future runtime/type changes together, rather
than accepting the latest declaration major independently.
