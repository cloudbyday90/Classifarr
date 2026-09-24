# Restart-safe batch coordinator outcome

## Delivered behavior

Implements the [coordinator design](reclassification-batch-coordinator-design.md)
on top of `2fedb44d` without changing movie/TV routing policy, confidence scores,
music exclusions, release version or deployed containers.

- Execute/resume saves intent and returns 202 rather than holding the HTTP
  connection through all file operations. Repeating an active request does not
  reset its retry delay.
- A bounded scheduled worker selects running batches in due-time order, admits
  one item, and survives a process restart through PostgreSQL state.
- Two workers cannot own batch admission simultaneously. Combined coordinator
  and move-lock abort signals protect the existing file-operation boundaries.
- Exact journal recovery never invokes preparation or file movement. It checks
  classification and destination as well as UUID; it respects scheduled retry
  times, and can restore a completed item's receipt without rewriting history.
- Parent-first transactions serialize admission, pause/cancel, skip and retry.
  Paused or cancelled batches never automatically resume. An admitted move may
  complete independently of the batch's control state.
- Modern unbound claims retry preparation after restart. Legacy unbound claims
  require inspection instead of guessing whether an earlier process moved files.
- Revalidation cannot reset already started work. Retry/skip cannot strand new
  pending work inside a terminal batch. Repeated skips do not inflate counts.
- A migration preserves legacy batch rows and creates the tables on fresh
  installations. Runtime services check the schema instead of creating tables.
- The existing SWR observer refreshes after acceptance. Accessible status copy
  explains that closing the window does not stop background work.

## Verification

Only synthetic database rows, fake integration adapters, disposable test
containers and browser-intercepted APIs were used. No live library was moved and
no paid AI calls were made.

- Full frontend coverage: 379 files, 5,264 tests passed; 87.74% lines and
  77.66% branches.
- Full PostgreSQL integration run: 156 suites, 1,785 tests passed; one existing
  suite/test skip. Includes legacy migration replay, movie/TV execution,
  interrupted claims, exact receipts, missing/malformed/mismatched references,
  due-time checks, competing workers, and pause/cancel during preparation.
- Focused backend/scheduler run: 19 suites, 245 tests passed.
  The new coordinator, repository and scheduler each have 100% line and branch
  coverage in that targeted run.
- Final focused PostgreSQL run after all edits: four suites, 61 tests passed.
- Chromium: two scenarios passed for running and paused recovery. Keyboard
  access to recovery references and absence of unintended requests were checked.
- Type checking, lint, dependency analysis, ESM checks, migration integrity,
  copyright and documentation checks passed. Lint retains one unrelated existing
  warning in `captureOperatorCorrectionFrozenPolicy.mjs`.
- Production image built locally. Fresh PostgreSQL 18 schema round-trip passed
  after making the new partial index's text casts explicit. Test containers were
  removed; the live application container was not restarted.

The first full backend invocation was stopped because it omitted the repository's
512 MB worker-recycling setting and became slow. The final run uses the configured
two workers with that memory limit. No coverage baseline was lowered.

Full backend coverage: 1,419 suites and 41,666 tests passed; 90.34% lines and
83.96% branches. Both server and client coverage ratchets pass with no baseline
changes. The final full backend run completed in 437 seconds with worker
recycling enabled.

## PR and release boundary

The connected GitHub service returned no open pull requests for
`cloudbyday90/Classifarr` on 2026-09-24. There was no eligible random PR to implement;
none was invented, merged or closed. No release, tag, version bump, deployment,
live data cleanup or routing-setting change was performed.

CI workflows were not changed. Main-branch pushes run existing validation; the
Docker release job requires a `v*` tag. This commit does not create one.

## Recommendation and tradeoff

Retain PostgreSQL + the existing move journal + small ESM worker modules + SWR.
This avoids another infrastructure dependency and keeps ownership and receipts
together. The tradeoffs are serial throughput, short scheduling latency, and
manual inspection when old evidence cannot prove replay safety. An external
workflow engine is not justified by this bounded requirement.

## Next high-value item

Implemented by the [batch activity design](reclassification-batch-activity-design.md)
and [outcome](reclassification-batch-activity-outcome.md).

Add a compact, reconnectable batch activity view in Command Center using the
existing saved batch APIs. Today, closing the modal clears its local batch ID;
work continues correctly, but reopening the browser does not rediscover it.
Show active, paused, recovery-pending and completed batches, with existing
pause/resume/cancel controls and concise exceptions. Keep reads read-only and
reuse SWR. This makes autonomous background work visible and controllable without
reintroducing per-item acknowledgements or changing classification authority.
