# Mixed deterministic/AI evaluation: outcome

## Implemented

September 25, 2026. The [design](mixed-policy-evaluation-design.md) addresses the
coverage barrier found after commit `f5a51d00`: selected automatic-vs-AI and
differing automatic outcomes previously could not complete paired replay.

- A small ESM adapter validates agreement between the automatic outcome, policy
  result, skip mode and one eligible current movie/TV destination. It rejects
  missing, inconsistent, inactive, duplicated and cross-media destinations.
- Only adjudication arms prepare requests and read cached provider responses.
  Deterministic arms contribute no fabricated cache hits, latency or tokens.
- Replay report v3 separately counts automatic label outcomes, deterministic-only,
  mixed and AI-only pairs. Canonical destinations avoid string/number mismatches.
  AI proposals remain proposals, not routing authority.
- History v3 retains categorical pair origin, not destinations or provider content.
  Canonical window keys include origin. Legacy v1/v2 history and reports remain
  readable; old pair origins are explicitly unknown. Evaluator provenance changes
  so old and new measurements are not silently combined.
- The PostgreSQL migration expands allowed versions without rewriting or deleting
  evidence. The same 16 KiB/25-case record, 500-window and 30-day bounds remain.
- The existing admin-only no-store endpoint and nonpersistent Vue SWR summary show
  origin counts in the collapsed detail. Keyboard pause/resume, mobile layout,
  access-loss clearing and inference-free reads remain intact.
- An empty capture plan skips adjudication provider configuration/model initialization but must
  still pass a fresh input-fingerprint check before recording completion.

## Verification

- Final frozen-patch backend coverage run: 1,439 suites / 42,593 tests passed.
  Statements/lines 90.35%, branches 84.20%, functions 92.22%.
- Final focused backend: six suites / 138 tests passed. Includes all 1,296
  two-pair combinations of automatic/proposed/abstained/missing/unavailable/invalid
  statuses, strict report validation, mixed replay and legacy compatibility.
- Full PostgreSQL: 162 suites / 1,880 tests passed (one existing suite/test skipped).
  A final focused pass of two suites / 26 tests also passed, including upgrades
  from the actual v1 table through v2/v3, replay-safe migrations, JSONB round-trip
  deduplication, changed pair origins, interruption recovery and window rotation.
- Full client: 383 files / 5,338 tests passed. Statements 85.73%, branches 77.84%,
  functions 85.30%, lines 87.79%. Final focused API/component pass: 11 tests.
- Chromium keyboard/mobile scenario passed, including 390px layout, compact
  disclosure, pair origins, pause/resume, nonpersistent data and access-loss clearing.
- Production client build, type checks, dependency checks, docs lint, copyright,
  static ESM and migration/schema validation passed.
- Coverage ratchet passed for both server and client.
- Lint passed with the existing nonliteral-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.
- A local in-process projection test of 500 windows / 12,500 case facts over 20
  runs measured median 8.4 ms and maximum 17.3 ms. Largest synthetic serialized
  history record was 6,782 bytes. These are not database/network, inference or
  classification-quality benchmarks.

The mixed 25-pair synthetic test uses a controlled automatic baseline and production
preparation/parser on the AI side: only 25 requests are needed, not two AI arms.
Other tests verify differing automatic destinations need no adjudication requests/configuration,
while malformed output and missing cache remain incomplete. No quality improvement
is inferred from these fixtures.

All test data is synthetic. The explicitly named, network-isolated migration
container booted healthy, applied both pending history migrations and supplied the
schema snapshot. It had no mounted data and was removed afterward; its fixtures
are regenerable and its image remains available. No live inference, routing,
library modification or production container change is part of this implementation.

## Recommendation stack and tradeoffs

Keep the existing stack: ESM outcome adapter → isolated replay worker → bounded
PostgreSQL history → protected aggregate GET → nonpersistent SWR/Vue disclosure.
This fixes a real evaluation gap without adding a queue or changing routing.
The cost is explicit version compatibility; history is bounded, and unsupported
verification/manual paths remain incomplete rather than becoming guessed results.

Upgrade compatibility is forward-reading, not a guarantee that older binaries can
read v3 history. Take the normal database backup before deployment. A rollback to
older code may make this diagnostic unavailable after v3 evidence has been saved;
use a matching application/database backup if reverting. Do not delete history as
an automatic upgrade or rollback step. Routing data is not changed by this feature.

The design records official NIST evaluation, OWASP data-minimization and W3C
auto-update accessibility guidance discovered online on September 25, 2026.
These are project-specific applications, not claims of certification.

## Next component

The follow-up **zero-inference window progression from AI capture permission** is
implemented in the [progression design](zero-inference-window-progression-design.md),
with verification in its [outcome](zero-inference-window-progression-outcome.md).
The capture worker's early disabled return had also stopped rotating windows that
needed no provider calls. The follow-up reuses admission, cooldown and checkpoint
ownership rather than introducing another queue.

Acceptance for that follow-up: with AI disabled, completed no-inference windows
can advance once, restart resumes the right window, missing-cache windows remain
honest gaps, and source changes invalidate stale completion. Enforce bounded
movie/TV coverage and zero provider calls/routing writes under contention and
restart tests. Keep paid inference strictly behind its existing budget permission.

This is an automation improvement, not evidence that classification accuracy has
increased. Independent labels and separately versioned model/prompt experiments
are still needed to measure quality. Do not lower routing gates to fill coverage.

## PR and release scope

GitHub MCP returned no open PRs for `cloudbyday90/Classifarr` on September 25,
2026, including a repeat check during validation. There was no open PR to randomly
select and implement. No PR was merged or closed. No release, tag, version bump
or live deployment is included.
