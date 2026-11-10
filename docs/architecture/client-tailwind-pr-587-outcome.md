# Client Tailwind PR 587 qualification outcome

November 9, 2026 Eastern. Baseline main c5f4dd183. Local assessment of the
agreed [design](client-tailwind-pr-587-design.md), delivered in ed20d0691. All seven
ordinary source workflows passed, including the
[pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/42714196374) and
[dependency/copyright controls](https://github.com/cloudbyday90/Classifarr/actions/runs/42714196186).
No PR merge, release or deployment.

## Observed change

Adopt exact tailwindcss and @tailwindcss/postcss 4.3.5 from selected PR 587's
immutable head 1e96827673b4e51b1f8fc540f2c64f28ca6a9244. Their coherent Node,
Oxide and native/WASI graph remains 4.3.5. Keep JSDOM 30.1.3,
vue-tsc/language-core 3.3.13, TypeScript 6.0.3 and every runtime dependency,
override, lifecycle decision and analysis setting unchanged.

The regenerated subset lock has 49 changed records, including its root entry.
All are within Tailwind's required graph or relocation of an existing resolution:
LightningCSS 1.33.0 replaces the 1.32.0 hoist and removes Vite's redundant 1.33.0
nested copies; enhanced-resolve moves to 5.26.1; the Node leaf gains nested
magic-string 1.4.5. The WASI tarball bundles six runtime packages, replacing the
old separately recorded nested packages. Inspect actual bundled versions and
hooks rather than interpreting removed lock entries as removed functionality.

Reviewed bundled packages: @napi-rs/wasm-runtime 1.2.2, @emnapi/core and runtime
1.11.3, @emnapi/wasi-threads 1.2.3, @tybys/wasm-util 0.10.3 and tslib 2.8.1.
No new installation hooks exist in these packages or the assessed parent graph.
Candidate integrity values match the reviewed immutable PR/registry artifacts.
The strict clean client install and complete npm tree pass without exceptions.

## Real-library evidence

Preserve normative regressions and controls in the existing automated dependency
suite, with a bounded scanner child shared by native and WASI tests.

| Control | Installed 4.3.3 | Candidate 4.3.5 |
| --- | --- | --- |
| Three top-level CDO/CDC forms | Corrupt adjacent emitted selectors | Exact ordinary selectors/declarations preserved |
| Omitted color-mix interpolation | Incorrect transparent fallback | Original expression retained without invented fallback |
| Explicit Oklab interpolation | Existing currentcolor fallback passes | Same supported fallback retained |
| Ordinary rules/custom-property tokens/unresolved variables | Pass | Pass |
| Actual PostCSS plugin/theme/source resolution | Pass | Pass |
| Native initialization and repeated file scans | No old-version result claimed | Exact initial/unchanged/modified/new-file lifecycle passes |
| Published Node declarations | No old-version result claimed | Real strict type consumer passes; unrelated TS2322 remains exact |
| Forced WASI initialization and repeated scans | No local old-version WASI result claimed | Isolated Linux lifecycle passes |

The initial harness incorrectly expected a generated fallback for omitted
interpolation. The official [implementation and regression](https://github.com/tailwindlabs/tailwindcss/pull/20666)
specify preserving the original expression without that fallback. Correct that
expectation, retain the stronger exact-output assertion, and rerun identical
normative controls against the preserved 4.3.3 installation: four failures and
three positive controls. The candidate passes all seven. No assertions or
timeouts were relaxed to conceal a candidate failure. A separate fixture-call
correction supplied the published type API's required onDependency callback.

Windows native scanning passes. The permanent WASI filesystem test explicitly
skips Windows, matching upstream's supported-platform boundary. Separately run
the actual forced-WASI scanner on pinned Node 24.22.1/Alpine in a disposable Linux
container: network disabled, read-only source/root filesystem, bounded tmpfs,
512-MiB memory, two CPUs and 64 PIDs. Exact results prove initial discovery, no
rescan of unchanged content, detection of a modified file and a new nested file.
The scanner child has a twenty-second deadline in the automated suite. Remove
the owned container and fresh fixtures after completion; build no new image.

These controls establish library behavior, not an exploitable application path,
universal WASI filesystem compatibility or complete CSS/W3C conformance.
The [current CSS Color draft](https://www.w3.org/TR/css-color-5/) permits omitted
interpolation with an Oklab default; retaining an expression does not guarantee
support in every browser.

## Application and quality checks

- Full dependency suite: 117 passed, one explicit Windows WASI skip; the separate
  pinned Linux WASI result covers the supported path.
- Fresh client coverage: 486 files and 7,557 tests passed. Statements 87.93%,
  branches 82.17%, functions 87.72%, lines 89.60%.
- Client lint, both real vue-tsc scopes and production Vite build pass.
- Fresh production-asset browser suite: eight passed against the new dist.
  Shared-form browser suite: fourteen passed with zero retries.
- Root/client development-inclusive npm audits: zero findings. Server retains
  the same five low findings in the deepmerge/Jest graph. No scanner exceptions,
  severities, peer defaults or script decisions changed.
- Server/database qualified input and existing backend report hashes match the
  preceding backend qualification across 5,686 files; the server installation
  is untouched and its complete npm tree passes. This is reused backend evidence,
  not a newly executed backend coverage suite. The coverage ratchet passes with
  that verified report and fresh client coverage.
- Backend lint/typecheck, normal/production Knip and ownership checks pass with
  no classification or review-cap changes. Four policy gates, static-import and
  mock-shape checks, npm CLI policy, copyright and Markdown checks pass.
  The delivered source's seven ordinary workflows also pass; publication and
  release remain outside this batch.

At this dependency commit's delivery, adjudication remained a proposal awaiting
its final lifecycle agreement. Its later implementation and verification are
recorded in a separate [outcome](provider-purpose-adjudication-outcome.md); this
dependency receipt does not qualify that runtime change.

## Maintenance and remaining work

Reuse the recent reviewed artifact inventory after verifying the exact Docker
daemon, protected service identities/start times/health and registered worktrees.
All current evidence, tools, recovery/reference images, backups, volumes, shared
cache and other projects remain protected. No new image was built and no stale
artifact deletion was justified by this assessment. Fresh fixture cleanup is
owned by the bounded test helpers.

Recheck open PR state before delivery; mergeable/unstable checks do not establish
a conflict. Keep PRs unmerged and rebase only a genuinely stale applicable branch.
Next assess JSDOM's separate major migration; keep the existing compiler deferral
and Node/npm security gaps explicit pending corrected qualified artifacts.
