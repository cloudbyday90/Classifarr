# Owned ingestion finalization outcome

## Delivered

The [design and recommendation stack](ingestion-finalization-ownership-design.md)
is implemented in four existing, small ESM service modules. The shared destructive
helpers now require a live, matching-library ownership scope and use its pinned
database client. Missing ownership fails before SQL; failed leases and closed
callbacks remain unusable. Capture keys are copied before asynchronous execution.

The full-sync runner retains its atomic completion/pruning transaction. Controlled
`local_capture` completion still works through the common ownership wrapper without
creating a normal ingestion checkpoint. Legacy administrator reconciliation, ordinary
reads, incremental captures, retry cooldowns, replay and conservative readiness remain.
No schema, endpoint, UI, provider setting or routing contract changed.

Only the four changed runtime fingerprints were updated in the ownership review
manifest, after tracing their callers. Shared query/store files remain **unresolved**
because capture start/page and other writers are outside this narrower guarantee.
Passing the drift gate is not a claim of database-enforced authorization.

## Local verification

- Focused unit run: 69 tests passed in three suites (scope, ownership and media sync).
  Final repeat including the ownership gate: **108 tests passed in four suites**.
- Focused PostgreSQL integration run: 72 tests passed in six suites, including
  interrupted ingestion, legacy reconciliation, source observations, identity
  recovery, log remediation and recovery fairness. Repeated after the capture-key
  snapshot correction: all 72 passed again.
- Regressions exercise unowned and wrong-library rejection, forged adapters, invalid
  IDs, closed scopes, connection loss, retained facades, delayed query results and
  caller mutation during transaction startup. The successful finalization test
  proves the injected store adapter is never used for completion.
- Isolated database tests preserve inventory under rejected calls, verify controlled
  maintenance exclusion, reject superseded generations, and keep disabled libraries
  disabled. Existing recovery tests terminate only an identified synthetic owner,
  preserve partial inventory and verify full replay before pruning.
- Type checking, test/security lint, dependency preflight, ESM checks, migration
  integrity and Markdown lint passed during development. Security lint retains the
  pre-existing unrelated filesystem warning in `captureOperatorCorrectionFrozenPolicy.mjs`.

- Full backend coverage run: **1,493 suites / 44,645 tests passed** in 1,052 seconds.
  Statements/lines: 90.29%; branches: 84.61%; functions: 92.24%. The final focused
  unit/integration reruns also cover the capture-key snapshot correction made while
  the broad run was active.
- Final ownership drift check passed with no database connections, provider requests
  or writes. The four reviewed source changes leave 473 unrelated/unproven entries
  explicitly unresolved rather than certifying them by association.
- The unchanged coverage ratchet passed. Its client input is the existing report
  for the unchanged frontend, not a new frontend test run.

## PR and operational boundaries

Two GitHub MCP searches for open PRs in `cloudbyday90/Classifarr` returned no results.
There was no open PR to select randomly; no closed PR was substituted or merged.

All database tests use disposable synthetic databases. No live library data was
modified, no container was rebuilt or restarted, and no release or tag was created.
The implementation adds no provider calls, paid AI usage or new background service.

## Recommendation and next acceptance target

Follow-up delivered in [owned capture lifecycle](owned-capture-lifecycle-outcome.md).
The target below records the handoff from this earlier change.

Keep the live library-bound guard: it is a small, dependency-free improvement that
preserves the current import lifecycle. Its limitation is cooperative in-process
enforcement, not database fencing; source completeness remains a separate concern.

Next, bring **capture start and page mutation under the owned lifecycle**, with a
separately explicit maintenance entry path. Acceptance: an unowned writer cannot
replace a generation or alter observed counts; interrupted imports recover; controlled
maintenance remains available; fresh setups keep evaluation idle until prerequisites
are genuinely ready. This closes the remaining lifecycle boundary rather than adding
another dashboard or changing AI routing prematurely.
