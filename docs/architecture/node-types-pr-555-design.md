# Node declaration PR 555 review

Date: 2026-10-05.

Rechecked 2026-10-09 for the post-Ollama-update live capture trial: MCP and the
saved CLI login enumerated open PRs 555/556; a fresh `Get-Random` draw selected
555 at the same immutable head below. Repeat the exact two-file trial and the
pre-install runtime-major contract, without substituting the compatible patch.

Rechecked 2026-10-09 for capture guidance: current open candidates were again
555 and 556; the isolated `Get-Random` draw selected 555 at the immutable head
below. MCP supplied its diff. The same runtime-major gate applies. Fresh registry
metadata now also lists a compatible 24.19.2 patch and latest 26.6.5; the selected
PR itself still proposes 26.6.4. Review the 24.x patch separately.

Rechecked 2026-10-09 for backfill-readiness diagnostics: the saved CLI login listed
open PRs 555/556 and a fresh PowerShell `Get-Random` draw selected 555 at the same
head below. GitHub MCP returned its exact two-file diff. Repeat the unchanged
pre-install compatibility gate; retain only a runtime-aligned candidate.

The saved GitHub CLI login found one open PR. A uniform random selection from the
singleton candidate set `[555]` selected [PR 555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `5545605b53c854de8847b44e24fa083ff4218080`. Its immutable diff changes only the
client manifest and lockfile: `@types/node` 24.19.1 to 26.6.4 and `undici-types`
7.24.6 to 8.9.0. No runtime package or installation script is added.

Apply that exact diff locally, run the existing runtime-baseline contract and
retain it only if the supported runtime contract holds. Do not merge, close or
comment on the PR. A failing compatibility gate is reason to reject this batch,
not to relax the test or silently upgrade the runtime.

The repository pins Node 24.21.0 and requires declarations on its deployed major.
[DefinitelyTyped's versioning guidance](https://github.com/Definitelytyped/DefinitelyTyped),
discovered and opened through web search on 2026-10-05, explains alignment of the
declaration major/minor with the described library. Newer type declarations can
describe APIs absent from the deployed runtime even when a typecheck passes.

| Choice | Benefit | Cost / risk |
| --- | --- | --- |
| Apply Node 26 declarations alone | Newer definitions | Violates the explicit Node 24 runtime contract |
| Retain Node 24 declarations — recommended | Types match the deployed major | Latest-major PR remains unimplemented in the final tree |
| Upgrade Node and declarations together | Consistent modern baseline | Separate engine/image/native dependency compatibility project |

Recommendation stack: preserve runtime/type alignment; review Node 24 declaration
updates separately; evaluate a future Node major as a coupled toolchain/image batch.
No dependency installation is needed if the existing static compatibility gate
rejects the exact candidate before installation.
