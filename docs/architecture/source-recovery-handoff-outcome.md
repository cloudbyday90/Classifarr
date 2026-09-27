# Source recovery handoff outcome

## Result

The existing services safely completed the tested repair → metadata backfill →
profile-refresh path. No runtime defect was demonstrated in these scenarios,
so no second orchestrator, migration, dependency or retry-policy change was added.
This is a regression-safety improvement, not a claim that live media was repaired
or that classification accuracy increased.

The previous commit (`485d40db`) changed cross-page recovery scheduling. Its
guards and limits remain intact. The follow-up now joins the previously separate
recovery, enrichment and profile tests using production services and disposable
PostgreSQL, with a small ESM fixture module separate from the assertions.

## Verified boundaries

Nine new cases cover movies, TV, and a mixed-library case:

- Provider outage retains two unresolved inputs. Provider return respects the
  daily cooldown; after eligibility, only fresh matching evidence repairs an item.
  A changed-source control stays unresolved and is never inserted into inventory.
- The real paginated sync entry point ignores a synthetic music track before
  observation capture. Only the repaired movie/TV item reaches enrichment/history.
- Newly constructed services discover a committed inventory gap and claim the
  existing queued task; repeated refill does not enqueue another pending task.
- Interruption after enrichment/history commit but before task acknowledgement
  leaves the task leased. Expiry and redelivery complete the same task without a
  second provider observation, history entry or inventory profile revision.
- Profile-generation failure retries through the existing outbox. Publication
  followed by failed acknowledgement also retries the same outbox row. Status is
  not `current` until the source, profile and acknowledged revisions agree.
- Identity drift during a provider request rejects stale enrichment. A later
  fresh repair permits backfill and profile refresh to complete.
- Movie and TV items sharing numeric TMDb ID `22` remain separate across their
  libraries, source-library histories and language observations. Concurrent queue
  claims receive distinct tasks.
- A repeated sync reuses verified proof, preserves enriched observations and
  their acquisition time, and schedules no unnecessary enrichment/profile work.
- The classification dependency is unused. History is explicitly observational,
  with no classifier candidate or routing authorization.

The initial test harness bypassed the public sync music filter and was corrected
to call `MediaSyncService.syncLibrary` rather than duplicating that filter. Mixed
fixtures also needed distinct synthetic server URLs to satisfy the existing
database uniqueness constraint. Neither issue required changing production code.

## Validation

- PostgreSQL: **76 tests across five suites passed**, including the nine new
  handoff cases and existing identity-recovery, fairness, inventory-enrichment
  and inventory-profile-refresh suites.
- Related backend unit regression: **453 tests across 33 suites passed**.
- Backend/frontend type checks, repository lint, static ESM import and test-mock
  checks, copyright, documentation lint and diff checks passed. Lint retains the
  pre-existing nonliteral-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.
- Production/frontend code and schemas are unchanged. Full workspace tests and
  fresh coverage collection were not rerun for this test/documentation-only patch;
  the counts above are the actual focused runs, not previous full-suite totals.

Run the isolated canary from `server/` with Docker available:

```powershell
node scripts/run-jest.mjs -c jest.integration.config.mjs --testPathPatterns=sourceRecoveryHandoff --runInBand --no-coverage
```

The existing CI integration job automatically discovers this test. No new runner
or workflow is necessary. Fixtures use committed database transactions so service
reconstruction cannot conceal an in-memory-only handoff. Retry/visibility clocks
are advanced only through fixture rows; no production delays are shortened.

These are bounded synthetic cases, not a load test, scheduled-worker uptime
guarantee, arbitrary provider-failure proof or a test of pre-existing conflicted
inventory throughout every learning consumer. The new cases recreate services;
the included existing fairness suite separately restarts its own PostgreSQL
container. No live provider call, paid inference or application restart was used.

## PR and local-container disposition

GitHub MCP was checked twice and returned no open PRs for
`cloudbyday90/Classifarr`. There was no random open PR to select; no closed or
unrelated PR was substituted, and none was merged.

Separately, the user approved removal of only the already-stopped
`classifarr-inventory-cross-encoder-1` container. Its exact Compose identity and
stopped state were verified before removal. The pinned Hugging Face image,
read-only model directory, benchmark code and Compose definition were retained.
The container can be recreated from that definition; the experiment was not
retired. The running Classifarr container remained healthy and untouched.

No release, version bump, tag, application rebuild or deployment is included.

## Recommendation stack and next concrete step

Keep **guarded PostgreSQL recovery → existing metadata queue → inventory revision
tracking → existing profile outbox**, protected by the new canary. This avoids
duplicated ownership and preserves durable retries. The tradeoff is eventual
completion, dependent on existing sync/worker scheduling and provider availability.
The [separate design](source-recovery-handoff-design.md) records alternatives,
pros/cons and official AWS, PostgreSQL and W3C research checked in September 2026.

Next: obtain the first **measured, independently reviewed movie/TV quality
baseline**, not more synthetic success counts or another dashboard. After a
separately authorized release and controlled upgrade, run the existing
[read-only quality coverage audit](quality-coverage-audit-outcome.md#usage-after-installation).
Use its actual gaps to complete one frozen cohort of up to 300 movie/TV cases and
the existing [independent-review workflow](quality-review-adapter-outcome.md).
Compare baseline/candidate correctness, abstentions and unresolved coverage;
do not treat current profiles or historical placement as truth labels. The prior
audit reported an upgrade prerequisite; this turn did not reassess live schema
or bypass that prerequisite. Keep inference budgets and routing disabled/unchanged
unless separately authorized.
