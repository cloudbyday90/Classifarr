# Frontend test runtime and timeout investigation

Research date: 2026-10-12. Scope: frontend test tooling on main; no release,
application behavior, production recovery or memory-limit change.

## Evidence and decision

The previous three combined Vitest 5.0.3 coverage runs reported either a
10-second ESLint setup timeout or a 5-second CSRF source-scan timeout. Both
projects passed separately, and native blob-report merging retained all 457
files and 6,881 tests. Existing project groups already run static contracts
before application tests; another ordering declaration is not a diagnosis.

Measure collection, synchronous reads, matching, assertion and CPU time inside
the actual full run. Compare ordinary ordering with the CSRF contract explicitly
first. Keep these temporary measurements out of shipped tests. A passing rerun
does not prove that the earlier timeout was repaired. Do not blame regular
expressions, Windows protection, V8 coverage or application memory without
evidence that separates those causes.

Evaluate the newly published **Vitest 5.0.4 and coverage-v8 5.0.4 together** as a
separate, exact-version tooling patch. Keep Node 24.21.0, npm 12.2.0, Vue,
TypeScript, test isolation, worker limits, project groups and deadlines unchanged.
Do not introduce a second production test orchestrator just because separate
invocations have passed. Retain the update only after the existing test inventory,
real failure behavior, coverage and build checks pass.

## Official research

Sources discovered/retrieved through MCP, with exact candidate registry metadata
checked before installation:

- [Vitest sequence configuration](https://main.vitest.dev/config/sequence)
  separates project order from within-project sorting. Cached durations influence
  ordinary file order, so an explicit first-file experiment is useful here.
- [Vitest profiling guide](https://vitest.dev/guide/profiling-test-performance)
  distinguishes environment, imports and test execution. Profile the slow path
  before changing its resource settings.
- [Vitest 5.0.4 release](https://github.com/vitest-dev/vitest/releases/tag/v5.0.4)
  was published on October 12. It includes file-cache changes, stricter filter
  failure handling and assertion/coverage corrections. These are reasons to test
  the patch, not proof that it fixes this Windows timeout.
- [File-system module cache](https://main.vitest.dev/config/fsmodulecache)
  keys transformed modules by content and environment, including coverage state.
  Verify cold and warm behavior; a warmed cache alone is insufficient evidence.
- [DefinitelyTyped version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  associates declaration versions with the described library. Preserve the
  repository's runtime-major alignment guard when reviewing Node declarations.

Vitest 5.0.4 declares Node `^22.12.0 || ^24.0.0 || >=26.0.0`, Vite 6.4/7/8,
and an exact 5.0.4 coverage peer. The registry entries declare no installation
lifecycle scripts for either direct candidate. Review transitive changes and
retain strict script approval during lock generation and clean installation.

Lock review found 13 changed development-only entries, no additions/removals and
no new installation scripts. Besides the aligned Vitest packages, the changes
cover Istanbul helpers, AST coverage conversion, magic-string/magicast, tinybench,
tinyrainbow and obug. [obug 3.0.0](https://github.com/sxzz/obug/releases/tag/v3.0.0)
requires exports-aware resolution and changes JSR/CDN entry points. Node 24 and
Vitest's explicitly declared dependency support that resolution; Classifarr does
not use those JSR/CDN entry points. It is not a forced transitive override.

The new real-CLI rejection cases fail on installed 5.0.3: missing location files,
unsupported location ranges and an unknown Git comparison revision all exit zero
with `--passWithNoTests`. This reproduces the false-success behavior repaired by
[upstream commit 30d0304](https://github.com/vitest-dev/vitest/commit/30d0304d2f3e8c877a163971e5de8e6803d39211).
It justifies the paired update independently of the unisolated timeout symptom.
Wire the subprocess checks into the existing `test:config` CI prerequisite.

## Tradeoffs and recommendation stack

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Measure the actual combined run | Separates test work from assumptions | Intermittency may require another captured failure | First |
| Matched 5.0.4 runner/coverage patch | Upstream correctness improvements; supported runtime | Cache, mock and coverage behavior can change | Independently validate |
| Separate invocations and native report merge | Known local fallback preserving all tests | More orchestration and missing-report failure paths | Keep documented fallback, not an unexplained fix |
| Higher deadlines, retries or reduced checks | Makes slow runs less likely to fail | Conceals regressions and weakens evidence | Reject |
| Disable coverage, isolation or host protection | May reduce overhead | Changes the test/security guarantees | Reject |

Recommended stack: pinned runtime and matched test packages, real isolated forks,
existing sequential lint/parallel application groups, unchanged assertions and
deadlines, full combined coverage, exact inventory/configuration regression checks,
and explicit reporting of unresolved intermittent failures.

## Random open PR trial

Fresh enumeration returned #558 and #556. A cryptographic random draw of index 0
selected [#558](https://github.com/cloudbyday90/Classifarr/pull/558), immutable head
`e8a7ee2e490e5437375aa3a4628943657fa1783e`. Apply its two-file client proposal
locally, independently of the runner update: Node declarations 24.19.2 to 26.6.4,
undici-types 7.24.6 to 8.9.0. Inspect the exact diff, install with strict policy,
check tree/audit/typechecking and the existing runtime declaration guard. Restore
the proposal if incompatible; no merge or runtime upgrade to accommodate it.

## Verification and boundaries

Add actual subprocess acceptance cases for successful and failing assertions,
setup deadlines and invalid location filters when upgrading the runner. Tests
must reject a silently skipped failure and retain the real configuration checks.
Run the full frontend coverage suite, lint, both typecheck scopes, dependency
policy and production build. Report backend coverage provenance rather than
claiming an unrelated backend rerun. No coverage baseline reduction.

Before the requested no-cache local Compose build, preserve an exact rollback
image and database backup. Build from a clean committed source, replace only
local Classifarr, verify health/hardening, and run the existing isolated schema
dump against that exact image. Keep design separate from observed outcome.
Unraid, shared Plex/Ollama, unresolved mappings and runtime safeguards remain
untouched. Commit and push the scoped result without creating a release.
