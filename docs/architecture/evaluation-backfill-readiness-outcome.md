# Evaluation backfill readiness: outcome

Date: 2026-10-09. See [design, research and tradeoffs](evaluation-backfill-readiness-design.md).

## Diagnosis and change

The three local handoffs completed automatically before this change. All ten
active libraries had matching run IDs and completed backfill handoffs by 10:30
UTC. A read-only check found inventory readiness `ready` and a policy report v2
observed at 10:37 UTC with 300 evaluated cases: 18 automatic, 241 review and 41 manual in
each arm. These are replay decisions, not routing or measured accuracy. No manual
completion, queue reset, ownership takeover or AI budget change was needed.

The earlier missing markers were a temporary wait. The existing relay scans at
most 5,000 rows across library pages per five-minute invocation; this installation
had 6,262 inventory rows. Empty queue observations alone could not distinguish
that scan from a stall. Historical per-page receipts were not retained, so this
does not reconstruct the duration of every earlier pass or diagnose Unraid.

Added a small ESM diagnostic service and client normalizer/component. The existing
administrator-only evaluation-history GET now includes optional versioned inventory
readiness, completed-import handoff counts, due/processing task counts and the
latest pending current-run page checkpoint. Admission and progress share one SQL
statement and statement clock inside the existing read-only transaction.

Command Center shows the admission state separately from saved policy work and
AI-capture configuration. Backfill details are collapsed by default; the brief
state uses a polite status region. Pause/resume, access-loss clearing, no-store
and nonpersistent polling remain intact. No repair control or schema change was
added. Ready means only that this inventory check passed, not all worker checks.

The recovery skill kept diagnosis read-only and completion generation-fenced.
The ownership gate required review of the new fixed indirect SELECT composition;
one documented diagnostic entry was added after inspecting its full call chain.
No unrelated review digest, unresolved writer classification or safety rule changed.

## Verification

- Focused backend tests initially passed 96 cases; the final full coverage run is
  pending at this source checkpoint. The additional malformed-diagnostics HTTP
  test is included in that run.
- Real isolated PostgreSQL: three suites, 31 tests passed. Tests exercise actual
  250-item relay pages, an empty queue between pages, completion before/after task
  drainage, generation replacement, inactive sources/libraries, future retries,
  import precedence and held generation-row locks. Synthetic task completion is
  explicit fixture setup, not evidence of external provider success.
- Frontend coverage: 447 files and 6,507 tests passed; 88.80% lines and 80.48%
  branches. Focused client tests: 74 passed. Chromium keyboard/pause/resume/access-loss and
  mobile-width checks passed with zero writes. The first browser run spent 28.8
  seconds in initial page loading and hit its 30-second timeout; the unchanged
  test passed on rerun in 3.1 seconds. Existing unrelated dashboard mock warnings
  remain outside this test's claims. No timeout or assertion was relaxed.
- Forty tooling tests passed. Lint/type checks, Knip modes, copyright and ESM
  checks passed; a Vue formatting warning was corrected afterward.
- [Random open PR 555](node-types-pr-555-outcome.md) was applied locally and
  rejected by the unchanged Node-major test before installation. Types remain
  aligned to Node 24. No PR merge or remote PR modification occurred.

Full coverage, final lint, no-cache image replacement and the isolated schema dump
will be recorded after completion. This source checkpoint is not a release.

## Recommendation and next item

Keep the existing bounded handoff and use the new diagnostics to distinguish
normal scan progress from actual failure. Increasing batch size or stamping
completion would solve no reproduced defect and could weaken the safety boundary.
The tradeoff is that aggregate checkpoints are not a per-library heartbeat or ETA.

Next, review the remaining supported comparison-cache gaps after normal replay.
AI capture is a separate permission and still needs an administrator-configured
budget; no budget was enabled here. For the separate tooling queue, current
registry checks identify Playwright 1.64.0 and Vue Router 5.4.0 as candidates;
review those independently of this diagnostic change and keep TypeScript 7 and
Node 26 declarations behind their existing compatibility decisions.
