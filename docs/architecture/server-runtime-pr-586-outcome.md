# Server runtime PR 586 outcome

Date: 2026-11-09 Eastern. Scope and official November sources:
[design](server-runtime-pr-586-design.md). No release or deployment.

## Local adoption

Uniform random selection chose open [PR 586](https://github.com/cloudbyday90/Classifarr/pull/586),
immutable head 4949ea99f7a88e382582ba121a552f211bbe7ee3. Local server pins are
Undici 8.12.4, express-rate-limit 8.7.3 and discord.js 14.28.1. The PR is not
merged. Both Discord Undici overrides remain 6.29.1. Root/client manifests,
toolchain, application transport, TLS, quotas and replay policy are unchanged.

The lock changes six packages: three direct pins plus builders 1.15.0, REST 2.6.3
and discord-api-types 0.38.58. The latter is a reviewed newer compatible resolution
than the PR's 0.38.57; November 7 upstream notes and registry integrity were checked.
All six integrities match the registry. No additions/removals, install hooks,
override or script-policy changes were admitted. Strict `npm ci` installed 631
packages; complete `npm ls --all` passes.

## Real-library evidence

Isolated children use synthetic loopback HTTP, bounded memory stores, deadlines
and socket/dispatcher cleanup. No provider connection or real credential is used.

| Control | Old copy | Candidate |
| --- | --- | --- |
| Wrong digest surrounded by ASCII whitespace | Missing rejection | Rejects; valid SHA-256/384/512 pass |
| Cross-origin bounce under initial cache key | Origin called only once | Both requests reach origin |
| Same-origin credential redirect alias | Reuses first principal's body | Separate principals and anonymous request reach origin |
| Foreign 304 validating original representation | Reuses original body | Evicts/refetches without generated validator |
| Header forms through reverse cache/redirect composition | Invalid-header-map process failure | Object, flat and tuple controls strip across origins |
| Cache replay exceeding dump bound | Uncaught child-process exception | Request error; next request remains usable |
| Rejecting handler and throwing/rejecting message callbacks | Unhandled child rejection | One Express error; protected route stays closed |

The initial integrity assertion compared an Error with a plain object; it was
corrected to inspect the real type/cause before freezing the old failure. Two
initial cache controls used the wrong scenario/oracle: the advisory concerns
credential-bearing redirects, and refusal of a foreign 304 causes a fresh fetch.
Corrected final fixtures fail against isolated untouched 8.12.3 and pass against
8.12.4. Reverse and ordinary interceptor compositions are both exercised.
The old header-composition fixture aborts during normalization before finishing
the stripping assertions; it does not reproduce the advisory's credential leak.

The final patch suite passes 11 cases. Redirect limits, ordinary same-origin
credentials, hop no-store/vary and legitimate caching controls remain. Three SDK
interactions resolve distinct permission clones without modifying the shared
cached channel; missing permissions stay null. Real message/embed/button/file
serialization remains intact. Baseline 14.27.0 lacks these new fields; no old
permission leak is claimed.

The broader focused run passed nine suites / 138 tests, including actual nested
transport fixtures, window resets and TLS identity/encoding refusal. After lint
fixture-output changes, five wrapper/cancellation/REST/patch suites pass 79 tests.
SDK retry policy, uncertain writes and cancellation remain covered by existing
real local fixtures.

## Audits and remaining boundary

Complete November 9 root/client audits report zero vulnerabilities. Server audit
reports the same five low entries in the existing deepmerge/Jest chain, with no
moderate/high/critical entries in that database. This does not override newer
maintainer advisories. Scanner checks/severities and the exact server-local
rejected-CVE triage expiry on November 16 UTC are unchanged.

Node 24.22.1 still embeds Undici 7.30.1; actual baseline probes reproduce the
tab-surrounded wrong-digest failure there. Standalone 8.12.4 does not fix global
fetch. Nested 6.29.1 copies reject that case and fall outside the six new 7.x/8.x
advisory ranges. Ordinary buffered, binary and streaming app paths still use
Node fetch; standalone fetch serves only the explicit buffered TLS-opt-out path.
No application integrity option/cache-interceptor use was found. These are library
regressions, not a demonstrated application exploit.

Assess corrected Node/npm separately before the next release. Do not override
every major to 8.x, replace global fetch or carry an old beta exception forward.
Keep deferred client compiler, DOM/native-WASM updates and scanner-alert triage
separate.

The final November 9 registry recheck now finds published npm 12.2.2. Its
[official release](https://github.com/npm/cli/releases/tag/v12.2.2), retrieved
through the MCP release collection, lists ip-address 10.7.5 and Undici 6.29.1.
The downloaded, uninstalled npm tarball independently contains ip-address 10.7.5.
This supersedes the older unpublished-package blocker, not the current batch's
toolchain scope. Assess its real strict installer and image graph next; package
availability alone is not installation or scanner acceptance. Node separately
[announces security releases for November 11](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases?trk=public_post_comment-text);
do not claim an unreleased binary has fixed bundled Undici.

## Quality and delivery

Fresh backend coverage passes 1,933 suites / 62,790 tests with one existing skip,
in 757.382 seconds. Statements/lines are 89.28%, branches 86.72%, functions 90.81%;
the unchanged coverage ratchet passes. All 2,045 frozen service/installed-lock
inputs are unchanged. Final fixture-only output/Host checks pass separately.
Lint, types, both Knip modes, ownership, ESM, copyright, policy gates, 97 real
dependency/tooling controls and Markdown checks pass.

All 1,227 qualified client source/configuration/installed-lock/report hashes are
unchanged. Previous client coverage/build/browser evidence is reused, not rerun:
484 files / 7,539 tests and eight production-browser cases. There is no client
source, dependency, build or UI change in this batch.

Scoped maintenance reused the recent full inventory and rechecked the exact
desktop-linux daemon. All three protected containers, four worktrees and 430
image/tag rows remain unchanged. No newly verified stale candidate was selected;
zero files/images were removed. Current evidence, toolchains, recovery assets,
other projects and shared cache were preserved. No storage savings are claimed.

All four intake Dependabot PRs were mergeable before push. Dependabot then closed
586 unmerged at 14:10:53 UTC; no agent merge/closure was performed. The remaining
583, 585 and 587 are mergeable at delivery; 585's head advanced externally. No
agent rebase was needed. Two additional containers appeared during the last local
inventory; their origin is unassessed and they were excluded from this work.
Every originally protected service remained unchanged; zero removals were made.

## Delivery evidence

Implementation subject: 2d5f12dad66e35d46ff28ee198a90495e9d4e350, attempt 1.
All seven source workflows passed:

- [CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/42631772312),
  including server/client tests, browser, database, image and recovery checks.
- [OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/42631773105),
  [Trivy repository scans](https://github.com/cloudbyday90/Classifarr/actions/runs/42631772276),
  [CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/42631772465) and
  [Gitleaks](https://github.com/cloudbyday90/Classifarr/actions/runs/42631772379).
- [Capacity regression](https://github.com/cloudbyday90/Classifarr/actions/runs/42631772394)
  and [copyright](https://github.com/cloudbyday90/Classifarr/actions/runs/42631772077).

Linux CI reran client coverage: 484 files / 7,536 tests, plus eight production-asset
browser cases and fourteen shared-control browser cases. Database CI passed 327
suites / 4,142 tests with one suite and one test skipped. These are remote results,
separate from the qualified local client reuse above.

The downloaded v4 installation receipt names this source and run 42631772312 /
attempt 1. Its candidate is CI-local image
`sha256:bd7cd5b807d630470c15f6fc92efd731ca65ede6f356f140fc93e87d8a1933dc`;
this is not a registry manifest digest or attestation. The downstream readout
independently verified the receipt against workflow source, run/attempt and the
installation job's image output, reporting `repository_acceptance_passed`.
It does not attest an active installation. Publication, image promotion, published
routing/smoke and registry cleanup jobs were skipped. No release or deployment
was performed.

A following documentation-only receipt commit preserves all 7,393 qualified
non-Markdown source/install/report hashes. Its results do not replace this exact
implementation subject's receipts. Current reports and recovery assets remain
protected; no implementation work is left pending in this batch.
