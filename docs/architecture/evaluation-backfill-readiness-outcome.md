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

- Focused backend tests: five suites, 136 tests passed, including the final
  ownership review and malformed-diagnostics HTTP test. The full coverage run
  started before the new diagnostic's ownership-review entry was recorded; its
  initial review failure was reproduced and resolved without changing the gate.
  That run finished with 1,757 suites / 54,571 tests passed, one failed review
  test and one Windows skip. Its only failing suite then passed all 39 tests on
  the final source. This is a broad run plus a resolved-failure rerun, not a claim
  that the first run exited successfully. Backend coverage is 89.75% lines and
  85.86% branches; the new service has 100% line, branch and function coverage.
  The ratchet passed with both current workspace reports and unchanged thresholds.
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
  checks passed; the client lint rerun also passed after correcting one Vue
  formatting warning.
- [Random open PR 555](node-types-pr-555-outcome.md) was applied locally and
  rejected by the unchanged Node-major test before installation. Types remain
  aligned to Node 24. No PR merge or remote PR modification occurred.

## Local image and schema

Built local Compose with `--no-cache --require-provenance` from clean source
`e97f4cca2859e675746559cb247c66eed82f7d98` and replaced only its Classifarr service
with `--no-build --force-recreate --wait`. Image ID:
`sha256:d2882733cfc253d9854d79c7938983e025f060879121e9b475f26750074bafe3`.
The OCI revision label matches the source checkpoint. This is a local development
image, not a published release or evidence of upgrading Unraid.

The container became healthy with zero restarts and no OOM kill. Its existing
2 GiB memory limit and data mounts were preserved. `/health` returned 200;
unauthenticated evaluation-history access returned 401. At 11:00 UTC, the packaged
history service read the local database through a read-only transaction in 188 ms:
inventory was ready, all ten current-run handoffs were complete, and due/processing
tasks were both zero. The latest saved policy pass had 300 cases. AI-capture budget
and reservations remained zero. This was a packaged-service/database check, not
an authenticated browser test against the live local API or proof of all worker
admission checks.

At 11:03 UTC, startup imports had moved the current runs back to ten handoffs
awaiting scanning, with an empty queue. The new diagnostic correctly reported
`backfilling`, rather than reusing the earlier ready snapshot. The saved policy
activity separately reported `busy`. Completion is generation-specific; a healthy
container or previously complete pass does not mean a new pass is already done.
By 11:05 UTC the normal relay completed seven handoffs and recorded page progress
for the remaining three, still with no due/processing tasks. No manual worker run
or completion update was used to advance this observation.
At 11:10 UTC all ten new-generation handoffs were complete and inventory readiness
returned to `ready`. The saved policy attempt still reported `busy` from 11:01;
this check does not claim a post-restart policy pass completed. Capture remained
disabled with zero reservations. The ordinary two-pass handoff completed without
intervention, matching the earlier transient-wait diagnosis.

After rebuilding, `check-schema-snapshot-container.mjs --dump` ran against a fresh,
isolated database using the same image. The generated schema was unchanged. The
runner removed its own disposable container/data, and no schema-check container
remained. Existing local data and the separate Unraid deployment were not altered
by the schema check. No migration, package version, release or tag was created.

The existing Windows skip is the Linux directory-fsync case. An isolated probe
against this exact image passed the same exclusive-copy, source-preservation and
refuse-overwrite assertions. It ran unprivileged with no network, read-only root,
bounded memory/PIDs and temporary synthetic files only; its container was removed.
No application source or dependencies were replaced by test mounts.

## Recommendation and next item

Keep the existing bounded handoff and use the new diagnostics to distinguish
normal scan progress from actual failure. Increasing batch size or stamping
completion would solve no reproduced defect and could weaken the safety boundary.
The tradeoff is that aggregate checkpoints are not a per-library heartbeat or ETA.

Next, review the remaining supported comparison-cache gaps after normal replay.
The latest saved comparison group at 11:03 UTC had 100 selected items, zero paired
comparisons, 94 `cache_missing` gaps and six `not_adjudication` gaps. This is distinct
from the 300 completed policy-replay cases; neither is an accuracy measurement.
AI capture is a separate permission and still needs an administrator-configured
budget; no budget was enabled here. For the separate tooling queue, current
registry checks identify Playwright 1.64.0 and Vue Router 5.4.0 as candidates;
review those independently of this diagnostic change and keep TypeScript 7 and
Node 26 declarations behind their existing compatibility decisions.
