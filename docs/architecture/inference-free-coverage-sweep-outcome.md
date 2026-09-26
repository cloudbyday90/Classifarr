# Inference-free coverage sweep: outcome

## Implemented

September 25, 2026. The [design](inference-free-coverage-sweep-design.md) follows
commit `1bacd75b`. Fully completed windows already progressed without inference,
but sharing the capture cursor left later opportunities hidden behind early gaps.

- Add a private durable diagnostic cursor, separate from capture ownership.
  Automatic evaluation surveys at most 25 eligible movie/TV cases per successful
  tick within the existing frozen cohort of at most 300. Missing evidence remains
  a gap, not a completed pair, accuracy measurement or routing permission.
- Share the existing stable evidence fingerprint with history. Response cache
  fill/expiry and cursor changes do not restart the sweep; source, policy, label,
  configuration, representation or cohort changes do. Restart resumes the stored
  scope and offset. Single/empty windows settle without repeated cursor writes.
- Recheck the full snapshot, cache and cursor before granting a transition under
  existing admission and deadline controls. Save report, history and revision-
  guarded sweep progress in one transaction. Duplicate/late writes cannot advance
  twice, including after wraparound. Database errors roll back publication.
- Capture snapshots continue using the capture cursor. Quotas, reservations and
  unfinished checkpoints are not rewritten by a diagnostic sweep. Existing
  strict completed-window consumption remains available when evaluation reaches
  that same capture window. Capture publication may wait up to one stable sweep.
- Keep existing scheduler, protected aggregate API, history retention and
  nonpersistent pausable Vue SWR summary. No new provider client, endpoint, queue,
  user acknowledgement or UI panel. Library names do not control selection and
  music remains excluded.

## Verification

Focused checks passed:

- Eight backend suites / 151 tests: window bounds, gap progression, scope drift,
  cache independence, cancellation, invalid state, ownership and guarded writes.
- Five PostgreSQL suites / 55 tests: real worker/capture interruption recovery,
  ten concurrent initial updates advancing once, restart, late/wrapped writes,
  transaction rollback, schema creation/replay and independent capture state.
- A synthetic 300-case movie/TV cohort completed all 12 diagnostic windows despite
  an entirely missing first window. A later window supplied 25 cached pairs;
  retained coverage was 300 selected, 25 paired and 275 cache-missing cases.
  Both media types were represented. A mid-sweep worker restart resumed correctly.
  An unpublished capture checkpoint, zero inference allowances, library items and
  policies remained unchanged. No real model request was made.
- Policy edits reset the next diagnostic selection to zero. Cache expiry instead
  preserved the next offset. Rollback of a capture update rolled back report,
  history and the new sweep update together.
- Generated and verified the schema from a disposable network-isolated container
  with no host data mounts. Restart remained healthy. The additive migration
  creates no capture row and does not alter existing capture/history evidence.

Frozen-patch verification:

- Backend: 1,441 suites / 42,727 tests passed. Statements/lines 90.35%, branches
  84.24%, functions 92.22%. Both new sweep modules have 100% statements, lines,
  branches and functions covered in the unit run.
- PostgreSQL: 164 suites / 1,902 tests passed, with one existing suite/test skipped.
- Frontend: 383 files / 5,338 tests passed. Statements 85.73%, branches 77.84%,
  functions 85.30%, lines 87.79%. The combined coverage ratchet passed.
- Chromium: the existing keyboard-pause, mobile-disclosure and access-loss
  clearing scenario passed. No UI change was needed.
- Production client build, type checks, development/production dependency checks,
  static ESM imports and test mock shapes, copyright, migration/schema validation
  and documentation lint passed.
- Lint passed with the pre-existing nonliteral-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.

All fixtures are synthetic. These checks demonstrate scheduling and recovery,
not improved media-classification accuracy or a benchmark of the live library.

## Recommendation stack and tradeoffs

Retain **modular ESM planner → existing isolated worker/admission → PostgreSQL
atomic checkpoint/history → protected aggregate reads → pausable Vue SWR**.

The independent cursor removes head-of-line blocking without permitting model
calls or losing pending capture. Costs are one additive table, a bounded freshness
reread and up to one sweep of acknowledgement latency for published capture.
Do not skip capture ownership, raise budgets automatically, or process all windows
in one CPU burst. Continuously changing evidence can restart a sweep; do not
promise coverage of a revision that never stabilizes.

Official PostgreSQL, AWS and W3C sources, verified through online tools, are linked
in the design with the alternatives and their pros/cons. No accessibility or
security certification is implied. Existing pause, keyboard and focus behavior
remain the UI boundary for background updates.

## Next component: gap-directed capture admission

Use this coverage to improve **which missing AI requests receive the existing
allowance**, rather than adding another status panel or increasing the allowance.

1. Derive bounded, deterministic priorities from the current frozen evidence and
   gap reasons. Prefer valid missing requests that can complete a pair; balance
   movie/TV and libraries without relying on names or predefined content genres.
2. Keep unsupported/runtime/configuration paths out of the generation queue.
   Resolve their prerequisite through the owning recovery service. Invalid output
   remains a measured failure, not an invitation to retry until it looks correct.
3. Reuse exact request keys, current quota reservation and resumable capture.
   Never abandon unfinished requests, bypass admission or increase configured
   calls/tokens. Disabled capture must remain disabled.
4. Prove a mixed-gap 300-case fixture completes more useful pairs under the same
   allowance, with bounded starvation and crash/concurrency recovery. Keep source
   drift and changed model provenance separated in the retained history.
5. Then run one predeclared paired AI experiment with independent movie/TV labels,
   reporting coverage, abstentions, regressions and cost together. Existing
   placement and AI agreement are not independent ground truth. Synthetic tests
   alone must not authorize routing promotion.

This is follow-up work, not an enabled inference change in this commit.

Subsequent implementation: [gap-directed capture design](gap-directed-capture-design.md)
and [outcome](gap-directed-capture-outcome.md) preserve canonical checkpoint
identity while prioritizing repairable missing responses within each window.

## PR, upgrade and release scope

Two GitHub MCP queries found no open PR in `cloudbyday90/Classifarr` on September
25, 2026, including the final availability check. No random PR could be selected
or implemented. No PR was merged or closed.

The new binary requires the additive migration through normal startup migration
handling. The schema snapshot includes it for fresh installs. Older binaries can
ignore the new table; preserve evidence and backups rather than deleting it on
rollback. No release, tag, version bump or live container deployment is included.
