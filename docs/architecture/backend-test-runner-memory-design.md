# Backend Test Runner Memory Design

Status: implemented, unreleased. Research and incident review completed on
2026-09-08.

## Problem

The repository-level `npm test` command delegates to `server` `npm test`. Its
unit phase forced `--runInBand`, leaving all 1,100+ backend suites in one
long-lived Node/Jest process. On the current Node 24.18.1 environment that
process exhausted its approximately 4 GB heap after 379 seconds. The same
package already exposed a bounded `test:unit` command that completed with two
workers and a 512 MB idle-worker recycling limit.

This is a test-runner reliability defect, not a product runtime failure. It
prevented the expected full local verification from reaching its PostgreSQL
integration phase even when the code under test was sound.

## Decision

Use the already validated unit configuration in the full backend `test` script:

```text
unit:        maxWorkers=2, workerIdleMemoryLimit=512MB
integration: runInBand
```

The integration phase remains serial because it creates and uses shared
database resources. The change does not raise Node's heap limit: doing so could
mask growing test memory, consume more host memory and make the suite less
predictable. Recycling only an idle worker that has exceeded the threshold
contains accumulated per-worker state while preserving worker isolation.

## Research basis

Official documentation retrieved on 2026-09-08 supports the selected controls:

- [Jest configuration](https://jestjs.io/docs/configuration#workeridlememorylimit-numberstring)
  documents both `maxWorkers` and `workerIdleMemoryLimit`; the installed Jest
  version is 30.5.
- [Jest CLI options](https://jestjs.io/docs/cli#--maxworkersnumstring)
  documents the corresponding worker-cap control.
- [Node.js CLI memory guidance](https://nodejs.org/api/cli.html) explains that
  raising `--max-old-space-size` increases the V8 old-space limit and can cost
  more memory. The observed failure is better addressed by bounded worker
  lifetime than by expanding the host allocation.

## Alternatives

| Approach | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep the single serial unit worker | Deterministic order | Reproduced heap exhaustion | Reject |
| Raise Node heap globally | Small script edit | Hides retained state and increases host pressure | Reject |
| Run all tests with unrestricted parallelism | May reduce elapsed time | Higher memory use and can destabilize database tests | Reject |
| Bounded unit workers; retain serial integration | Uses documented Jest controls and existing proven settings | Unit ordering is not globally serial | Adopt |

## Verification plan

Run `npm test` from the repository root. It must complete both the bounded unit
phase and the serial integration phase, then run the unchanged client suite.
The change does not alter coverage collection, application source, database
schema or production Docker behavior.
