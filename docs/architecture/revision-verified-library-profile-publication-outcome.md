# Revision-Verified Library Profile Publication — Outcome

## Implemented

- The shared observation reader captures inventory rows and their revision in
  one statement. Profile publication verifies the revision under an inventory
  row lock and stores it beside the bounded profile projection.
- An empty current library removes its old profile; an older empty result
  cannot delete a newer profile. A superseded nonempty result cannot overwrite
  one either.
- The outbox treats a superseded inventory refresh as an acknowledged old
  claim, not a transient provider failure. The newer revision remains dirty
  and is admitted by the next planner run without retry cooldown.
- A one-time post-upgrade task queues provenance verification for existing
  libraries through the existing per-library mechanism.

## Verification and limits

Focused PostgreSQL tests cover stale nonempty and empty publications,
revision-specific worker handoff, upgrade replay, and revisions larger than
JavaScript's safe-integer limit. The full backend run passed 1,389 unit suites
(40,778 tests) and 148 PostgreSQL integration suites (1,713 tests; one suite
and one test skipped). The client run passed 371 files (5,174 tests), and the
production frontend build, server/client lint and typechecks, ESM checks,
Markdown lint, copyright check, and disposable-container schema check passed.
No live library or local container was changed, and no release was created.

The schema addition is nullable: legacy profiles are unverified until their
queued refresh completes. The queue ledger records admission intent, not
completed publication.

The [repository's open pull-request collection](https://api.github.com/repos/cloudbyday90/Classifarr/pulls?state=open&per_page=100)
was empty on 2026-09-23, so no PR was applied or merged.

## Rollback

The new column is additive. Restoring the previous application image does not
require dropping it. Already-queued library revisions remain processable by
the previous worker, though that worker lacks the new publication check.
