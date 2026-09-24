# Reconnectable batch activity outcome

## Delivered

Implements the [activity design](reclassification-batch-activity-design.md) on top
of `d969c91b`. Command Center now has a compact, keyboard-operable Batch activity
disclosure. It rediscovers started work from PostgreSQL after a reload, lists
running/paused batches before finished work, and pages ten rows at a time.

The summary reports completed, failed, skipped and cancelled item outcomes
separately from the parent control state, plus exact-journal recovery counts.
Cancelled/paused work can still have an admitted move awaiting verification; the
UI explains this instead of implying cancellation undoes file changes. Drafts
are not listed. The summary contains no paths, move plans or validation payloads.

View batch opens the existing batch modal by saved ID without automatically
creating, validating, executing or resuming anything. Existing explicit controls
remain available. In-flight control requests suppress duplicate clicks; failures
show an unconfirmed-action message and refresh status without retrying a write.
Failed items without a journal also show their title/reference and saved reason.
Closing details restores keyboard focus to the initiating control.

The Vue SWR observer validates bounded response shapes, rejects old-page results,
polls only while visible, refreshes after reconnect and closing details, and never
persists activity in browser storage. Authorization failures stop summary reads.
The endpoint inherits the administrator guard and returns `Cache-Control:
no-store`. No new dependency, schema, scheduler, routing or learning change.

## Tradeoffs and recommendation

Keep PostgreSQL + the exact move journal + small ESM read model + existing Vue SWR
and modal. This supplies durable visibility without introducing another workflow
engine. The costs are polling latency, live pagination that may shift when status
changes, and the existing detail endpoint returning the whole selected batch.
Refresh/first page returns to current priority order. Summaries intentionally do
not claim classification accuracy or summarize every batch on every page.

## Verification

Synthetic tests and browser-intercepted APIs only; no live media mutations or
paid AI calls.

- Full backend coverage: 1,420 suites and 41,696 tests passed; 90.34% lines and
  83.96% branches. The new read service has 100% line and branch coverage.
- Full frontend coverage: 381 files and 5,299 tests passed; 87.76% lines and
  77.73% branches. Both server and client coverage ratchets passed without
  baseline changes, using freshly generated reports.
- Focused PostgreSQL integration: four suites and 64 tests passed, covering
  activity pagination/privacy/authorization alongside the existing coordinator,
  interrupted recovery and correction-persistence workflows.
- Chromium: three scenarios passed, including reload rediscovery, no implicit
  writes, explicit controls, keyboard focus restoration, movie/TV recovery and
  narrow-screen layout. Desktop and mobile screenshots were visually inspected.
- Type checking, client/server lint, ESM import/mock-shape checks, dependency
  analysis, copyright, documentation, migration integrity and production client
  build passed. Server lint retains its unrelated existing nonliteral-path
  warning in `captureOperatorCorrectionFrozenPolicy.mjs`.

The first new integration fixtures omitted a required execution order and used
the wrong journal actor-column name. The fixtures were corrected against the
existing schema, then the integration tests reran successfully. No production
schema was changed. A reduced-output frontend coverage command omitted HTML;
the full run was repeated with HTML because the repository ratchet reads that
report. No coverage baseline was lowered.

The additional `policy:production-naming-gate` audit remains blocked by 49
pre-existing references in 18 untouched files. Reading those files from
`d969c91b` reproduces the same 49 references; none were introduced here. Product
language, delivery-term and runtime-release-maintenance audits passed. This is
not a claim that every optional repository audit is green. The existing GitHub
workflow invokes package-local test commands, not this root naming-audit chain.

## PR and release boundary

The GitHub MCP repository-scoped search returned no open PRs on 2026-09-24.
No random PR was available to implement; none was invented, merged or closed.
No release, tag, version bump, deployment or live-container restart was performed.
Existing CI validation remains unchanged.

## Next high-value work

Return to the AI/RAG objective: run the existing paired 300-case movie/TV
evaluation against newly retained, genuine correction outcomes after the planned
release is deployed. First measure whether enough independent labels exist;
report a shortage rather than inventing labels from current library placement.
Compare source-aware retrieval and learned profiles against the baseline, split
by library/media type and duplicate group, then select the largest demonstrated
ranking failure for a focused fix. Keep music excluded and routing thresholds
unchanged until that evidence supports a change.

Do not build another dashboard or approval gate next. The durable worker,
recovery receipts and reconnectable controls close this specific operations loop;
the next result should quantify placement quality and reduce avoidable reviews.
