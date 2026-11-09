# Client tooling PR 584 assessment outcome

Date: 2026-11-09 Eastern. Status: assessed five-package subset installed locally;
delivered on main; local and source-CI qualification passed. See the separate
[design and tradeoffs](client-tooling-pr-584-design.md). No release or deployment.

## Selected subset and reviewed graph

Uniform selection chose [PR 584](https://github.com/cloudbyday90/Classifarr/pull/584)
from four open, mergeable candidates at 2026-11-09T11:38:31.066Z. MCP retrieved its
immutable proposal at 1d01257e3bc4c8fc1a0e2214826351d5fa3e1b8b. Only five exact
direct pins are adopted locally: Vite 8.3.6, Vitest and coverage-v8 5.1.0,
Playwright 1.65.0 and globals 17.14.0.

The lock review changes 31 package records plus root dependency declarations,
without package additions/removals or new install hooks. Coupled changes include
Vitest's Istanbul 2.1.0 libraries, Rolldown 1.2.18 with matching platform bindings,
Oxc types 0.156.0, Magic String 1.4.5 and Tinybench 6.2.3. Rolldown's November 9
release and registry/native integrity were reviewed through official sources.
Actual local native execution is Windows x64; other platform execution is not
claimed. No application runtime dependency, root/server lock, override or script
approval changes. Strict clean installation and npm ls --all pass.

Retain vue-tsc 3.3.13 with TypeScript 6.0.3 and its coherent compiler graph. The
candidate 3.3.14 integrity is identical to the previously demonstrated failing
artifact; that deferral is reused, not represented as a new candidate run. Retain
jsdom 30.1.3 and Tailwind core/PostCSS 4.3.3. A DOM major migration and the later
Tailwind 4.3.5 native/WASM fixes remain independent assessments.

## Verification and audit

All 13 real tooling controls pass, including exact runner/provider alignment,
complete project discovery, isolation, actual covered/uncovered V8 functions,
negative exits, hooks, filters and stale transformed-cache rejection. The added
real Vite build retains query-bearing and ordinary lazy CSS dependencies, with
static CSS controls. Dependency/toolchain policy controls pass 97 tests.

Complete audits include development dependencies: root/client report zero;
server retains five low-severity entries in the existing deepmerge/Jest chain,
with zero moderate/high/critical workspace findings. No scanner triage, severities
or expiry changed. The server-local rejected-CVE triage still expires November 16
UTC. The separate bundled npm/ip-address residual is not repaired or reauthorized
for a later release by these workspace results.

Both client typecheck scopes, lint, server type/lint, Knip, ownership and ESM
checks pass. The final full client coverage run passes 484 files / 7,539 tests in 231.96
seconds. Coverage is 87.93% statements, 82.17% branches, 87.72% functions and
89.60% lines. Fresh build and all eight production-browser tests pass against
new dist assets; both new Chromium controls pass, including saved legacy values,
actionable refusal, unchanged retry identity, cookie paths and inert actionability.
Backend coverage passes 1,931 suites / 62,720 tests with one existing skip; two
post-review tests also pass in the final focused run without changing production
source. The current two-report coverage ratchet passes unchanged. Delivery
receipts follow below.

Early browser runs exposed fixture defects: the broad API mock intercepted a
source module as JSON, and exact label-text lookup did not identify the select.
Restricting interception to /api/ paths and using the exact accessible combobox
role/name resolves them. Concurrent compiler-fixture writes also caused observed
reloads; final browser runs followed coverage completion. No application syntax,
assertion, timeout or browser security check was relaxed.

All four original PRs were mergeable at delivery intake. After the push,
Dependabot automatically closed #584 unmerged at 2026-11-09T12:36:10Z and opened
[PR 587](https://github.com/cloudbyday90/Classifarr/pull/587) for the four remaining
grouped updates. The issue event identifies dependabot[bot] as the closing actor;
mergedAt is null. The four currently open PRs (583, 585, 586 and 587) are mergeable.
The agent did not merge, close or rebase PRs; no genuinely stale applicable branch
was found. Next dependency work is a coherent Tailwind 4.3.5
native/WASM assessment, a fixed compiler artifact and an independent jsdom major
migration. Existing scan alerts still require separate evidence-based review.

## Artifact maintenance

Removed 21 verified generated policy-maintenance logs older than fourteen days,
576,239 bytes in total, after exact path, size, timestamp and hash revalidation.
No images, shared cache, container, volume or recovery asset was removed. All
three protected service identities/states and four registered worktrees remain
unchanged. Docker image/tag rows remain 430 from this batch intake; an earlier
pre-task inventory had 445, so that external difference is not attributed to this
cleanup or claimed as reclaimed storage. Current evidence and toolchains remain.

## Pushed source receipts

Source/tooling subject: 44cf88e51fbd451b9a2d7505f5dfb820c5a337ea on main.
[CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/42618058045),
[OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/42618058544),
[Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/42618058443) and
[Gitleaks](https://github.com/cloudbyday90/Classifarr/actions/runs/42618058222)
all passed. Existing open scan alerts remain 118 CodeQL plus four Trivy; all 122
most-recent instances reference this source, with no newly opened alerts since
push. This is execution/coverage evidence, not remediation or validation of those
findings. The separate npm residual and existing deepmerge triage remain explicit.

[Full CI](https://github.com/cloudbyday90/Classifarr/actions/runs/42618058044)
passed, including full server/client tests, database integration, fresh
installation/upgrade acceptance, a verification image and all startup/shutdown/
queue-recovery smoke checks. Capacity and copyright workflows also passed.
Only delivery-record documentation changes follow this source/tooling subject.

Image publication/promotion and registry cleanup jobs were skipped. The delivery
record changes only outcome documentation; all 6,971 qualified source, installed
lock and local coverage-report hashes remain unchanged. Subsequent documentation
workflow receipts are not substituted for this exact implementation subject.
