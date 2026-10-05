# Node declaration PR 555 review

Date: 2026-10-05.

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
