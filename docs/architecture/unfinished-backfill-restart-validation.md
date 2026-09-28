# Unfinished backfill restart validation

## Scope

Implements [the restart design](unfinished-backfill-restart-design.md) using the
existing opt-in installation-budget launcher. No production services, migration,
dependency, live library, resource limit, routing policy or release version changes.

The observer verifies original ingestion runs, inventory and task identities;
durable claim/completion counts; natural ten-minute visibility expiry; sibling
TV progress; current profiles; music exclusion; and separate resource snapshots.
It cannot establish exactly-once remote side effects or stale-worker fencing.

## Validation in progress

Focused contract/fixture/runner tests pass. The first disposable run correctly
rejected duplicate synthetic library names before the new crash boundary. The
backlog fixture now has distinct names; a regression test covers both fixture
profiles. The database uniqueness rule was not changed.

The clean-source fresh-and-published-upgrade run and full check results will be
recorded here after completion. No runtime acceptance claim is made by this
intermediate document.

## PR availability

GitHub MCP returned no open pull requests in `cloudbyday90/Classifarr` at the start
of this task. No closed PR was substituted and none was merged.

## Recommendation and next component

Keep the existing scheduler and durable PostgreSQL queue. The new opt-in drill
provides missing crash-boundary evidence without introducing another orchestrator.
Its cost is approximately ten minutes of natural lease waiting per scenario.

Next, evaluate **late-worker acknowledgement fencing**: keep an original worker
alive beyond its lease while another worker reclaims that task. Establish whether
the old worker can overwrite the new owner's completion or failure. Use that
evidence to design per-claim tokens and conditional acknowledgements if needed.
Do not treat a dead-container restart test as proof of that concurrent boundary.
