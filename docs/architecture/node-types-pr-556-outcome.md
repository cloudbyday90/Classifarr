# Server Node declaration PR 556 outcome

Date: 2026-10-05. See [design and sources](node-types-pr-556-design.md).

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
