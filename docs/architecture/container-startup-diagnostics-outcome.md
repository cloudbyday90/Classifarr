# Container startup diagnostics outcome

## Delivered behavior

Implemented the [reviewed design](container-startup-diagnostics-design.md) in
three small ESM modules: bounded Docker execution, safe evidence projection and
application-readiness polling. Schema checks and published-upgrade failures share
the diagnostic projection. No application service, API or database schema changed.

Schema checks now fail promptly when their container exits, report explicit OOM
state rather than inferring it from exit 137, and collect both stdout and stderr.
Recognized admission/module failures include fixed next steps. Unknown causes are
explicitly unrecognized; arbitrary logs, credentials and CI command syntax never
enter the diagnostic summary or its saved upgrade failure file.

The 180-second application readiness limit is unchanged. Curl has a two-second
request limit; each Docker readiness command is capped by the remaining budget
and five seconds. After failure, inspection and log-tail capture get at most five
seconds each. Logs use a 100-line tail and a 64-KiB subprocess output limit.
Published-upgrade diagnostics also allow five seconds to resolve the owned target.

Resource cleanup now refuses existing targets, validates the scratch path and
removes only the current schema-check container/data. Other same-label checks
survive. Failed removal preserves potentially mounted data. A second cleanup
failure no longer erases the original startup diagnosis.

## Validation on 2026-09-28

- Focused tests: five suites, 93 tests passed, including command timeouts/output
  overflow, privacy, early exits, unsuccessful health, cleanup and upgrade failure
  reporting. Real Node subprocess tests supplement injected Docker fixtures.
- Real Docker: all seven scenarios passed against the existing current-source
  `classifarr:source-content-test` image: stderr admission, stdout admission,
  unknown secret-bearing error, exit 137 without OOM, running/unready, healthy,
  and fresh schema verification with concurrent-check cleanup isolation.
- Early-exit cases reported in 0.36-0.39 seconds locally. The deliberately unready
  case used a three-second test budget and failed in 3.24 seconds including
  diagnostic capture. These are local observations, not CI performance guarantees.
- A real Docker test exposed fractional remaining milliseconds being rejected by
  Node's subprocess timeout option. The adapter now floors the timeout; a real
  child-process regression covers fractional input. Deadline exhaustion during
  inspection retains the readiness-timeout classification.
- Lint, server/client type checks, CI preflight, four policy static gates, ESM
  checks and whitespace checks passed. Documentation tooling update and tradeoffs
  are documented in [PR 548 adoption](pr-548-markdownlint-local-adoption.md).

Full backend unit coverage: **1,509 suites / 45,417 tests passed**. The coverage
ratchet passed (backend statements 90.30%, branches 84.74%). Its client comparison
uses the existing, unchanged-client coverage report; no frontend runtime or
dependency changed, and frontend tests/build are not newly claimed by this work.

## Explicit limitation

The full published-upgrade acceptance command was attempted but stopped at
provenance preflight: local GitHub CLI returned **HTTP 401 Bad credentials**.
It did not build or start an upgrade project. Its acceptance receipt remains
blocked; no verification step was skipped or declared successful. The changed
failure-reporting path is covered by tests, but the complete upgrade scenario is
not newly validated here. Reauthenticate the local CLI, then rerun
`npm run test:local:runtime-installation-acceptance`.

All disposable Docker scenarios were removed. The existing Classifarr container,
persistent library data, routing settings and other running containers were left
untouched. No release or live Compose rebuild was performed.

## Recommendation and next component

Retain the bounded, fixed-vocabulary diagnostic layer: it explains known failures
without weakening startup gates or publishing arbitrary provider/database output.
The tradeoff is deliberate: unfamiliar errors require isolated private inspection
and a reviewed new diagnostic code, not speculative automated repair.

Next product-facing acceptance work: exercise a Jellyfin outage and application
restart through shared recovery, backfill completion and learning readiness in
one isolated scenario. Verify no duplicate import ownership, no music ingestion,
and no learning before a complete inventory. This advances the automation goal
beyond further wording changes to startup diagnostics.

Follow-up implementation and its explicit process/scheduler limits are recorded
in [Jellyfin restart recovery outcome](jellyfin-restart-recovery-outcome.md).
