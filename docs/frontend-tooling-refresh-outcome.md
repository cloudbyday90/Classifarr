# Frontend tooling refresh outcome

Date: 2026-10-03. Local toolchain: Node 24.21.0, npm 12.2.0 on Windows;
image rehearsal: Linux amd64 through Docker Desktop.

## Delivered

| Package | Before | After |
| --- | --- | --- |
| Vite | 8.3.1 | 8.3.2 |
| Vitest / V8 coverage | 5.0.2 | 5.0.3 |
| vue-tsc | 3.3.11 | 3.3.12 |

Reviewed lockfile changes include matching Vitest mocker/spy and Vue language-core,
Chai 6.3.0 and std-env 4.3.0. Vitest intentionally pins why-is-node-running back to
3.2.1; this is upstream's documented install-compatibility decision, not a forced
override. Existing Rolldown 1.2.11 already satisfies Vite's updated range. No
package additions/removals, new lifecycle approvals or security override changes.
TypeScript stays at 6.0.3 for the client. Application runtime dependencies are unchanged.

Additional official transitive release notes:
[Chai 6.3.0](https://github.com/chaijs/chai/releases/tag/v6.3.0) and
[std-env 4.3.0](https://github.com/unjs/std-env/releases/tag/v4.3.0).
Neither adds an install lifecycle script in the reviewed registry metadata.

The new `classifarr-dependency-update` AI skill is instruction-only. It covers
version/peer/script review, scoped tests, current PR availability and honest
evidence reporting, reusing existing tooling. Its metadata validator passed;
no independent agent behavior evaluation was performed.

## Checks

- Clean client install under the existing strict lifecycle policy: passed.
- Client dependency tree: no invalid/missing dependencies.
- Full client suite with V8 coverage: **418 files, 5,951 tests passed, no skips**.
  Statements 86.28%, branches 79.02%, functions 85.70%, lines 88.15%.
- Client lint, Vue typecheck and production build: passed.
- Real Chromium production-route asset checks: **8 passed**.
- Toolchain/install-policy regression tests: **28 passed, no skips**.
- Routing diagnostics, rehearsal, installation receipt/workflow and published
  routing acceptance unit suites: **134 passed across 5 suites, no skips**.
- Workspace lint/typechecks, copyright, ownership drift, dependency preflight,
  ESM import/mock checks and Markdown validation: passed. Ownership drift passing
  does not authorize the previously documented unresolved inventory writer paths.
- npm audit of the client, including development dependencies: zero findings.
- OSV Scanner 2.6.0 against all three lockfiles: **1,142 package entries scanned,
  no issues found**, without advisory exclusions. These are point-in-time results,
  not a guarantee against undiscovered vulnerabilities.

The build emitted informational plugin timing output. Playwright emitted the
existing NO_COLOR/FORCE_COLOR environment warning. Neither was suppressed or
represented as an application failure.

## Routing investigation

The earlier CI run [37134626818](https://github.com/cloudbyday90/Classifarr/actions/runs/37134626818)
failed after arming the routing crash scenario. Its outer receipt did not retain
the failing assertion. The later pre-update run
[37136659294](https://github.com/cloudbyday90/Classifarr/actions/runs/37136659294)
passed its database and installation jobs during this investigation. This is
evidence of an intermittent failure, not proof that its root cause is fixed.
That pre-update CI run subsequently completed successfully, including build/test
and release acceptance. Tag-only publication/deployment jobs were skipped as expected.

A baseline local reproduction also passed all eight routing phases and owned
cleanup with zero provider writes:

- Baseline image: `sha256:6c04c447e6a32d53c708e316f5ea0aeecaa0264579cda3e8f5b31bc0d2bfae67`.
- Pre-update candidate: `sha256:5c6d607d5bfa835778fc378cb4d97d00f6bc8745b5010925144b7b1172b6d5cf`.
- Candidate checkout: `980e8fb4ad097ebb68e2740d74cf96d19af876b2`, before this batch.

The post-update local image rehearsal also passed every phase and owned cleanup,
using candidate `sha256:7473cd3ad8a4da7c95e43e606e235fad2970b0b66386a142812c24e0855a990f`
and the same baseline. This image was built from the modified working tree; its
parent revision label is not evidence of a clean committed candidate or signed
published artifact. Both runs preserved the original history, did not enroll the
legacy item, and counted two movie GETs, two TV GETs and zero provider writes.
Only their random scratch containers, volumes and candidate tags were removed.
Borrowed baseline images and the running services/data were left untouched.

Added a modular ESM diagnostic builder and one failure event after cleanup is
attempted. Known phases/categories and probe source coordinates survive in job
logs; raw errors, assertion values, SQL values and credentials do not. The original
failure still rejects. Unit tests cover redaction, unknown inputs, cleanup
precedence and refusal to kill when the probe fails. No test was skipped, no
deadline enlarged, and no production recovery behavior changed.

Full backend coverage and the combined coverage ratchet were not rerun for this
frontend/tooling-only batch; do not combine a stale backend report with the new
frontend report to claim fresh whole-repository coverage.

## Next

Proceed with a separate backend runtime dependency batch: pg, dotenv and pino,
including database integration and logging/redaction tests. Then update shared
lint tooling and review Node typing/runtime alignment. Keep the client TypeScript
7 migration separate. Investigate any recurring routing failure using its new
phase/location diagnostic before changing timing behavior.

The subsequent backend batch and its validation are recorded in
[the backend runtime outcome](backend-runtime-refresh-outcome.md).

GitHub MCP and the saved CLI login both found **zero open Classifarr PRs**. There
was no PR to select randomly; none was merged or substituted. Work remains on
`main`. No version bump, release, live deployment or user-data change was made.

See [design, tradeoffs and official sources](frontend-tooling-refresh-design.md).

The subsequent October 4 DOM environment refresh is recorded separately in
[the jsdom design](architecture/jsdom-30-1-2-design.md) and
[its measured outcome](architecture/jsdom-30-1-2-outcome.md).
