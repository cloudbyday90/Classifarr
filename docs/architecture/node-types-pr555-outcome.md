# Random PR trial: client Node declarations

Reviewed: 2026-10-06. No PR was merged or closed.

The open Classifarr PR pool contained #555 (client) and #556 (server). PowerShell
`Get-Random` selected [#555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `5545605b53c854de8847b44e24fa083ff4218080`.

## Design decision

The PR changes `@types/node` from 24.19.1 to 26.6.4 and `undici-types` from
7.24.6 to 8.9.0. Trial its manifest/lockfile changes locally, before installation,
against the existing runtime-major compatibility gate. Do not weaken that gate
or change the supported runtime to accommodate an unrelated dependency PR.

[DefinitelyTyped's versioning guidance](https://github.com/Definitelytyped/DefinitelyTyped)
ties declaration major/minor versions to the library they describe. Newer types
can describe APIs absent from our deployed Node 24 runtime; the highest registry
version is not automatically the appropriate update.

## Outcome

Applied the PR's two-file dependency diff locally. Ran:

```text
node --test scripts/__tests__/container-runtime-baseline.test.mjs
```

Seven checks passed; `client/ Node declarations stay on the deployed runtime
major` failed: expected `^24.x.x`, received `^26.6.4`.
Restored only the trial's changes. No packages were installed, no lifecycle
scripts ran, and the final manifest/lockfile retain the Node 24 baseline.
This is a tested, rejected local trial, **not an integrated dependency upgrade**.

Recommendation: keep Node 24 declarations until a separately reviewed runtime
major upgrade. Benefit: runtime/type alignment. Cost: Node 26-specific declarations
remain unavailable. Review compatible Node 24 updates separately; do not bundle
other outdated packages into this memory/response-contract fix.

## Phase-study recheck

The subsequent phase-study round randomly selected the same still-open immutable
head from the two-PR pool. The [separate design](node-types-pr555-design.md) records
the decision. Reapplied the exact manifest/lockfile diff locally: again seven gate
checks passed and the client Node-major check failed. Removed only that trial;
no install, merge or retained dependency update. This repeated result is not a new
integration. Other outdated patch candidates remain separate follow-up work.

## Bounded-vector-reader recheck

The next October 6 round freshly selected #555 from the unchanged open pool.
Applied the immutable two-file diff: seven checks passed, one rejected Node 26
declarations against the Node 24 runtime. Reverted only those manifest/lockfile
edits without installing packages or merging. This remains a rejected local trial,
not an integrated upgrade; no compatibility gate was weakened.
