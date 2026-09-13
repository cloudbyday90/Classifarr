# Command Center library evaluation outcome

## Implemented — 13 September 2026

The Command Center now summarizes the existing live evidence checks separately
from confirmation holds. The previous protected-study readiness card is inside
optional details, not another top-level panel. No new settings or acknowledgement
steps were introduced.

The [design](command-center-library-evaluation-design.md) records the official
W3C/OWASP research, alternatives, tradeoffs, and recommended implementation stack.

## Design realized

- An injected reader reaches the same evaluation service used by the production
  classification path. A small ESM service projects a closed, bounded aggregate.
- The existing authenticated live-stats endpoint includes the new field only for
  administrator sessions. It omits the field for ordinary users and API-key-only
  requests. Reader failure yields unavailable without breaking other queue stats.
- The client uses its existing SWR live-stats request and visible-tab cadence:
  five seconds during activity, thirty seconds otherwise. There is no new timer
  or endpoint. `persist: false` disables localStorage hydration, writes, and
  cross-tab cache updates for this response; failed reads clear its memory copy.
- SWR now coalesces concurrent polling requests, preserves a follow-up read when
  an explicit refresh follows a mutation during an older request, cancels pending
  retry timers on unmount, and ignores late responses after unmount. Other SWR
  consumers retain their existing persistent-cache behavior. Reconnection also
  revalidates an empty memory-only cache without waiting for a manual refresh.
- A focused Vue component and ESM parser provide fixed plain-language copy,
  native disclosure, visible focus, and optional pause/resume. Counter changes
  are not repeatedly announced. Permission loss or unavailable data clears even
  a paused snapshot. Resume displays the latest response.
- Counters are service-local attempts, not accuracy, unique items, durable
  history, current queue counts, or global routing configuration. Preparation is
  not counted as a pass; held passes are a subset, not additional passes.

## Verification

- Focused backend run: four suites, 78 tests passed, including instance ownership.
- Full frontend coverage run: 367 suites, 5,074 tests passed. Coverage: 85.57%
  statements, 77.50% branches, 85.02% functions, 87.63% lines.
- Integration regression: five suites, 26 tests passed, covering the live-stats
  route, live inventory retrieval, consensus review recovery, corpus projection,
  and vector cache.
- Isolated Chromium regression passed with intercepted synthetic API responses:
  automatic SWR updates, keyboard disclosure and pause/resume, permission loss,
  no persistent live-stats cache, no write requests, and 390px viewport bounds.
  Desktop and mobile screenshots were inspected. The test waits for the existing
  sidebar transition before capturing the mobile layout.
- Local Compose was rebuilt and recreated; it reports healthy with a read-only
  root filesystem. All four changed server-source hashes match the running image.
  The deployed-source smoke confirms a read-only projection, unchanged counters,
  anonymous live-stats rejection (401), and frontend availability (200). This
  separate smoke process is not a measurement of the worker's traffic counters.
- Client/server typechecks, targeted ESLint, static-import and ESM mock-shape
  checks passed. Full server/client ESLint, documentation lint (1,300 documents),
  whitespace and migration checks passed.
- Final backend coverage run: 1,268 suites and 36,605 tests passed; statements
  and lines 90.09%, branches 82.16%, functions 92.17%.
- Full PostgreSQL integration run: 141 suites and 1,627 tests passed; one existing
  opt-in test/suite skipped. The coverage ratchet passed with fresh client and
  server reports. No coverage or naming baseline was relaxed.

### Verification limits

The computer-use skill's browser helper could not start: its app-server path was
missing, including after a reset and retry. Therefore live authenticated-browser
inspection against the real Compose API was not completed. The isolated Chromium
regression is explicit synthetic UI evidence, not that missing live check.

The production naming gate still reports the same 26 pre-existing production
references against its zero baseline. Its thresholds were not relaxed. This is
not a claim that all CI gates are green.

No real media was routed, library purpose changed, model trained, or additional
inference requested by this component. A passing counter is not an independent
correctness label and does not justify changing routing thresholds.

## Final recommendation stack

Keep Express's authenticated route boundary, the existing classifier-owned
evaluation service, fixed counter projection, memory-only SWR, and the compact
Vue disclosure. This provides hands-off visibility with no extra polling or AI
cost. The tradeoff is reset-on-restart, incomplete observational counters, not a
historical quality dashboard.

**Next high-value AI/RAG item:** evaluate the calibrated-neighbor fallback on a
fresh, library-balanced movie/TV cohort using the existing benchmark workflow.
Compare strict and fallback coverage and mistakes by library, without treating
existing placements as ground truth. Use those results to decide which fallback
matches can safely become automatic; do not add another settings panel or infer
promotion from these aggregate counters alone.

## PR and delivery

GitHub MCP returned no open Classifarr PRs on the planning and follow-up checks.
None could be selected randomly, and none was substituted or merged. Unreleased
and separate design/outcome documents were updated. No version bump, tag, or
release is included. Smoke scripts and screenshots remain ignored local artifacts.
