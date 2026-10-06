# Concurrent comparison study outcome

Date: 2026-10-06. [Design and official research](comparison-concurrent-study-design.md).

## Implementation

Two explicit isolated scenarios reuse the existing Compose launcher: a comparison
control and comparison with production ingestion/metadata services. Small ESM
modules own load generation, shared-admission observation, receipt validation and
orchestration. Production memory safeguards and refresh behavior are unchanged.
The same image runs sequentially; no production data or external provider is used.

The ownership audit initially rejected three changed launcher hashes. Each complete
file, its new callees, fixed modes, environment guards, fresh database checks and
random-project cleanup were reviewed. Only those three review entries changed;
unresolved production ownership debt remains unresolved.

## Verification and measurements

- Focused admission/study checks: 11 suites / 345 tests passed.
- Broader script and refresh regressions: 156 suites / 2174 tests passed.
- Toolchain policy: 40 tests passed, including restored Node-major alignment.
- Server lint, typecheck, normal/production dependency checks, copyright and the
  reviewed ownership audit passed. No thresholds or test assertions were relaxed.

Image execution results and limitations will be recorded after the controlled runs.
No lower memory peak, leak fix or release-capacity claim is made from harness tests.

The first image trial exposed a fixture omission: metadata tasks completed, but
OMDb enrichment was correctly skipped because no active synthetic provider was
configured. The incomplete trial was stopped, not counted as a measurement. The
fixture now seeds that configuration behind the existing isolated-environment
guard, with a regression assertion. The completion requirement remains unchanged.

The freshly selected [PR #555 trial](node-types-pr555-outcome.md) failed the Node-major
alignment gate and was reverted without installation or merge. No dependency change
is retained.
