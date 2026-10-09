# Server Node declaration PR 556 review

Date: 2026-10-05.

Rechecked 2026-10-09 during fold-purpose evaluation work. A fresh `Get-Random`
draw from the current open PRs 555/556 selected 556 at the same immutable head.
The official registry and freshly opened DefinitelyTyped guidance still support
the decision below. Server outdated: Node types current/wanted 24.19.1, latest
26.6.4; Knip current 6.40.0, wanted/latest 6.41.0 (separate follow-up).

The saved GitHub login found open PRs 555 and 556. A uniform `crypto.randomInt`
draw from `[555, 556]` selected [PR 556](https://github.com/cloudbyday90/Classifarr/pull/556),
immutable head `9d74537d7917c248d15926f37b2e40ceba7559a4`.
Its two-file server diff changes `@types/node` 24.19.1 to 26.6.4 and `undici-types`
7.24.6 to 8.9.0. No lifecycle script is added. Registry integrity and dependency
metadata for 26.6.4 match the reviewed diff.

Apply the exact diff locally on main without merging a PR. Run the unchanged
runtime-baseline check before and after. Reject the candidate before installation
if it violates deployed Node 24 alignment; do not weaken the test to retain a PR.

[DefinitelyTyped versioning guidance](https://github.com/Definitelytyped/DefinitelyTyped),
discovered and opened on 2026-10-05, aligns declaration major/minor with the described
library. New declarations may expose APIs unavailable in the deployed runtime.

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Node 26 declarations alone | Latest definitions | Violates the supported Node 24 contract |
| Keep Node 24 declarations — recommended | Matches the deployed runtime | Latest-major PR remains unapplied |
| Upgrade runtime and declarations together | Consistent newer baseline | Requires a separate image/toolchain compatibility review |

Scoped outdated results report server current/wanted 24.19.1 and latest 26.6.4;
transitive consumers accept newer majors. Preserve runtime alignment, review
compatible 24.x updates separately, then evaluate a coupled future runtime upgrade.
