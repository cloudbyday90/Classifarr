# Server Node declaration PR 556 outcome

Date: 2026-10-05. See [design and sources](node-types-pr-556-design.md).

## 2026-10-09 Ollama model-list investigation

At base `b60f050e`, MCP enumerated the two open PRs 555/556 and a fresh
`Get-Random` draw selected 556, still open at the immutable head below. Official
registry metadata confirmed its integrity and `undici-types ~8.9.0` declaration.
Applied the exact MCP two-file diff: baseline 8/8, candidate 7/8, rejected by the
unchanged Node-major contract. Removed only this trial before installation; no
candidate audit, runtime test or merge is claimed. The repository remains on
Node 24 declarations. Current registry wanted/latest values also identify
compatible Node types 24.19.2, dotenv 18.0.7, Express 5.3.0 and Knip 6.41.0 for
separate scoped reviews; they were not installed in this provider investigation.

## 2026-10-09 fold-purpose evaluation recheck

Freshly selected open PR 556 at `9d74537d7917c248d15926f37b2e40ceba7559a4`.
Applied its exact two-file, nine-line replacement locally: baseline 8/8 passed;
candidate 7/8 passed, with the unchanged server Node-major gate rejecting Node
26 declarations on the supported Node 24 runtime. Removed only that trial before
installation. No candidate audit, typecheck, runtime compatibility or merge is
claimed. Keep the aligned declarations; Knip 6.41.0 is the next separate tooling
candidate identified by the current registry check.

## Earlier checks

The selected-lifecycle batch at base `feaeb7c4` freshly enumerated open PRs
555/556 through MCP and the saved CLI login; a cryptographic random draw selected
556 at the same immutable head below. The official npm registry confirmed both
versions, the dependency constraint and package integrities. Applied the exact
two-file MCP diff: baseline 8/8, candidate 7/8 with the unchanged Node-major test
rejecting 26 on 24. Removed only this trial before installation. No merge,
candidate lifecycle scripts or complete candidate audit is claimed.

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
