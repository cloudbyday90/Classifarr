# Evaluation coverage gaps: outcome

## Implemented

September 25, 2026. The [design](evaluation-coverage-gaps-design.md) extends the
history introduced by `70572763`; no replacement queue or inference service was
added. All new application and test modules are ESM.

- Replay now distinguishes missing configuration/runtime, non-adjudication arms,
  unavailable or changed evidence, unsupported scope/request shape, cache misses,
  rejected output, output limits and suspected context limits.
- History v2 retains two categorical arm diagnoses. Exact validation checks
  completion consistency and reconciles reason totals with the worker's replay
  report. Unknown fields and private payloads fail validation.
- Canonical window identity includes the diagnosis, so a changed reason is not
  hidden by deduplication. A recurring reason updates last observation without
  renewing first-observation retention. Latest complete comparisons remain
  historical coverage; latest reasons explain never-completed selected items.
- Existing v1 records remain readable, with missing causes shown as unknown.
  Migration expands the version constraint without rewriting evidence. New
  evaluator provenance separates new results from older benchmark revisions.
- The existing administrator-only, no-store GET returns aggregate gap counts.
  The Command Center uses nonpersistent SWR, pause/resume, native disclosure,
  visible keyboard focus and fixed explanation text. Unknown/malformed v2 gap
  payloads are withheld. A new client can also read a legacy v1 response.

## Recovery and safety

Cache backfill remains owned by the existing scheduled capture worker. Tests use
synthetic data to verify interruption recovery, durable quota charges, checkpoint
reuse, publication-before-rotation and later completion. Opening the summary
cannot generate, increase quotas or request retries.

Invalid cached output remains an evaluation failure. It is not regenerated simply
to obtain a passing result. Changed input/model experiments and normal cache
retention remain possible; this is not a permanent failure ledger. Missing labels
remain unknown correctness, separate from incomplete inference. Music remains
excluded and routing is unchanged.

This is a history view, not a live capture-readiness monitor. It does not claim
that capture is currently enabled or scheduled for a particular saved item, nor
that the displayed highest-priority cause is the item's only failing arm.

## Verification

Verification:

- Full server: 1,438 suites / 42,534 tests passed; statements/lines 90.35%,
  branches 84.17%, functions 92.23%. Fresh client/server coverage ratchet passed.
- Full PostgreSQL integration: 162 suites / 1,879 tests passed; one existing
  suite/test remains skipped.
- Focused server: six suites / 109 tests passed, including arm/report consistency.
- Focused PostgreSQL: three suites / 32 tests passed, including actual v1-table
  upgrade, legacy evidence retention, interrupted capture recovery and gap closure.
- Full client: 383 files / 5,337 tests passed; statements 85.72%, branches 77.83%,
  functions 85.29%, lines 87.79%.
- Production client build, type checks, dependency checks, client lint, docs lint,
  copyright, static ESM checks and migration/schema validation passed.
- Server lint passed with the pre-existing nonliteral-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.
- Chromium keyboard/mobile scenario passed, including pause/resume, gap guidance,
  390px layout, nonpersistent data and clearing results after lost access.
- A local in-process projection test of 500 windows / 12,500 case facts over 20
  runs measured median 8.7ms and maximum 18.5ms. This excludes database/network
  latency and is not an inference or classification-quality benchmark.

No real library data or paid/live provider calls were used.

The isolated migration container used the previous evaluation-history test image,
booted healthy, applied the new migration and returned healthy. The schema snapshot
was regenerated only from that explicitly named isolated container. The disposable,
unmounted container was removed after validation; its fixtures are regenerable and
the previous image remains available. No live container or persistent data changed.

## PR and release scope

The GitHub MCP query for open PRs in `cloudbyday90/Classifarr` returned an empty
list on September 25, 2026. There was no open PR to randomly select or implement.
No PR was merged or closed. No release, tag, version bump or live deployment is
part of this change. The running Classifarr container was left untouched.

## Recommendation and next component

Keep the existing stack: small ESM services → bounded PostgreSQL history →
protected aggregate GET → nonpersistent SWR → accessible Vue disclosure. Advantages
are bounded storage, restart-safe diagnosis and no new infrastructure. Tradeoffs
are finite history, intentionally absent raw debugging content, and one prioritized
cause per unfinished item in the summary. The separate design documents the
official NIST, AWS, OWASP and W3C sources and alternatives.

Next: **mixed deterministic/AI outcome evaluation**, not another status panel.
Code review found that selection admits differing automatic decisions and
automatic-vs-AI pairs, while paired AI replay requires both arms to adjudicate.
Use each deterministic arm's real result directly, and require cached AI only
where that arm needs it. Give this a new evaluator revision and test against
independent labels without weakening routing gates. This removes an actual
coverage barrier without extra AI calls or manual per-library declarations.
