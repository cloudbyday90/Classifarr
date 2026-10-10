# PR 556 local trial outcome

Date: 2026-10-09. Decision: tested locally, rejected and restored; not merged.
See the [design and official sources](pr-556-node-types-design.md).

## Candidate and results

Applied the exact reviewed server manifest/lockfile changes from PR 556 head
`9d74537d7917c248d15926f37b2e40ceba7559a4`: `@types/node` 26.6.4 and
`undici-types` 8.9.0. Used the pinned Node 24.21.0 and npm 12.2.0, initially
without lifecycle scripts, then with the repository's strict reviewed policy.
No global toolchain or other dependency changes were made.

| Check | Candidate result |
| --- | --- |
| Clean install, strict policy | Passed; 632 packages installed |
| `npm ls --all` | Passed |
| Full server `npm audit --json` | Zero reported vulnerabilities |
| Server typecheck | Failed: Discord delivery `BodyInit`/`FormData`/`File` mismatch |
| Tooling dependency tests | 39 passed, 1 failed: server declaration/runtime-major guard |

`discordDeliveryWriter.mjs` fails at its existing request-body boundary because
the new declarations disagree with Discord's Undici types (`webkitRelativePath`
is required on the new `File` type). No cast or disabled check was added to hide
the mismatch. Passing an audit does not establish compatibility.

Restored the exact original manifest and lockfile, then ran `npm ci` under the
same strict policy. Server typecheck passed and all 40 tooling dependency tests
passed. This before/after result attributes the candidate failures to the type
update; no dependency changes remain in this commit.

## Next dependency work

The registry check also found a compatible-major declaration update, 24.19.2,
plus dotenv 18.0.7, Express 5.3.0 and Knip 6.41.0. These are observations, not
approved compatibility or security claims. Review the Node 24 declaration patch
first as a separate bounded update; evaluate Express and the tooling changes in
their own batches. Node 26 runtime migration remains separate.
