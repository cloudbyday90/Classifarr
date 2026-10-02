# Server-backed import recovery history: outcome

Date: **2026-10-01**. Base revision: `1dccce4d`.

## Delivered

Implemented the [design and recommendation stack](ingestion-recovery-history-design.md)
with two small server ESM modules: a bounded history reader and a shared receipt
validator/projector. The existing administrator route now exposes the current
account's newest 20 retained receipts for one library. A partial index supports
the scoped query; its migration and fresh-install schema snapshot are included.

Library details has an on-demand **Your recovery history** disclosure, including
after the legacy warning disappears. It shows recorded handoffs, not current
import success. No settings, inventory, ownership, retention or routing is changed
by opening it. There is no new background worker, polling loop or browser storage.

The browser rehearsal exposed a related pre-existing transport defect: the
confirmation endpoint had not opted out of automatic network retries. It now
uses the existing `skipAutomaticRetry` contract. Lost replies remain unverified;
receipt lookup and explicit same-request retry remain available. No server
deduplication, stopped-writer attestation or revision checks were weakened.

## Verification

- Focused backend contracts, routes, history and ownership gate: **71 passed**.
- Disposable PostgreSQL reconciliation/recovery suites: **74 passed**. Added
  coverage for restart after a committed-but-discarded reply, actor/library
  isolation, revoked access, retention removal, corrupt evidence, deterministic
  truncation and partial-index eligibility. The forced-index check is not a
  production performance benchmark.
- Chromium rehearsals: **3 passed**. A simulated commit followed by a lost HTTP
  response sends exactly one confirmation. After reload with the warning gone,
  keyboard expansion retrieves the recorded request without another mutation.
  Enabled/disabled recovery compatibility passes. The 390-pixel history screenshot
  was inspected; the disclosure fits without horizontal overflow.
- A disposable application image built successfully. Its isolated schema check
  passed and removed its temporary container. It did not update the live image or
  attach the live application data volume.
- Migration naming/schema integrity, copyright, ownership review, development
  and production dependency checks, ESM static-import and mock-shape checks pass.
- Full frontend coverage: **5,869 tests in 414 files passed**. Statements 86.22%,
  branches 78.90%, functions 85.62%, lines 88.09%.
- The full backend coverage run executed **49,227 tests in 1,611 suites**:
  49,225 passed, one existing skip, and one ownership-digest check failed because
  it ran before the regenerated schema's review pin was updated. That entire
  suite subsequently passed within the 71-test focused rerun above. No runtime
  test failed. Backend coverage: statements/lines 90.05%, branches 85.38%,
  functions 91.65%; the fresh backend/frontend coverage ratchet passed unchanged.
- Repository lint, backend/frontend type checks, frontend production build,
  all four policy maintenance/language gates and Markdown lint passed
  (1,745 documents).

The initial browser failure was kept as a regression case and passed after the
transport fix. The ownership gate initially caught the regenerated schema's old
review digest; the additive index/snapshot diff was reviewed, the pin updated,
and the entire ownership suite rerun successfully. No coverage threshold or
ownership-debt classification was lowered.

## Scope and limitations

Both GitHub MCP and the saved GitHub CLI login returned **zero open PRs** in
`cloudbyday90/Classifarr`. No random open PR was available; none was invented,
reopened or merged as a substitute.

No release, version bump, live recovery or deployment is part of this change.
The local running image requires a later rebuild/deployment to include it. No
Compose or Unraid template change is required by this feature.

History follows existing audit retention and includes only the current account's
retained confirmations. It cannot reconstruct expired or uncommitted requests,
or prove that an old writer stopped. An empty/unavailable list is not evidence
of rollback. Malformed retained receipts fail closed instead of claiming success.

## Next high-value component

Delivered in [recovery-to-completion tracking](ingestion-recovery-progress-outcome.md).
The following records the original follow-up recommendation.

Add **recovery-to-completion tracking**, joining the reviewed recovery request
to its actual owned full scan and downstream backfill. Show a concise progression:
requested, importing, backfilling, completed, or blocked with one next action.

Use durable correlation across retries/restarts, rather than matching timestamps
or treating the historical scheduled handoff as completion. The ownership run ID
is replaced when a worker acquires its next claim, so the receipt alone is not a
stable execution identity. Acceptance must cover two recoveries for one library,
restart during ingestion, disabled/archived sources, failed partial scans and
retained inventory until a complete replacement scan. This is a separate change;
the current history does not fabricate those progress states.
