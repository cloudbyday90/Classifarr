# Capture finalization acknowledgement design

Date: 2026-11-01 (America/New_York). Status: agreed first batch; implemented and verified.
Predecessor: [cooldown preservation outcome](capture-finalization-cooldown-preservation-outcome.md).
Outcome: [validation and limits](capture-finalization-acknowledgement-outcome.md).

## Observed gap

All five production capture-budget finish calls discard the repository's raw
QueryResult. A revision-bound UPDATE can acknowledge zero affected rows while
the worker still reports captured, waiting_for_replay or budget_exhausted. The
failure cleanup also discards the result, but its returned status describes the
earlier observed failure, not a successful persistence receipt.

Capture invokes onPublished after cache publication and postpublication quality
collection. An acknowledged zero-row finish therefore cannot mean that the
cache, progress or charged provider work rolled back. Empty plans also invoke
onPublished, without creating a provider client or saving a cache. The automatic
composite intentionally returns the evaluator's result, separately from capture.

## Recommended first batch

Add a small worker-only finalization helper in its own ESM service module. Create
one helper per runOnce flight and route the existing five finish calls through
it. Preserve the repository's QueryResult contract, SQL and transaction runner.

Only inspect the result after the awaited repository promise resolves, including
COMMIT acknowledgement and existing client-health checks. Exact numeric rowCount
one permits normal completion. Exact numeric zero records acknowledged
non-application in that flight and throws a fixed internal error to unwind the
primary path. Missing, null or other counts are contract failures; rejections
remain failures with their existing uncertainty. Neither is zero-row evidence.

Use the flight's private non-application flag in the worker catch, after the
permanent-stop check. An acknowledged zero at a primary finalizer returns the
existing deferred result, starts the existing local five-minute failure cooldown,
and skips the secondary failure finish. Do not match raw error messages as proof.
The flag must survive an admission layer replacing the thrown error with a
concurrent abort reason. It exists only for this flight and grants no retry or
inference authority.

For best-effort failure cleanup, calculate the original failure status as today
and preserve it if its finish affects zero rows or rejects. Do not turn an
observed provider failure into deferred merely because its cleanup was stale.
Do not add another cleanup attempt. Keep the final permanent-stop override.
Failure status remains an observed worker outcome, not a persistence claim.

Zero means no row was updated, not proof that a newer configuration or owner
exists. A matching UPDATE acknowledgement also does not establish latest-attempt
ownership or prevent a later status overwrite. Keep these meanings explicit.

## Preserved boundaries and bounds

Keep synchronous repository validation, singleton bootstrap and zero-row commit
semantics, exact revision predicates, prelocking, inherited isolation, statement
and lock settings, valid-cooldown preservation and all raw result consumers.
Throwing inside the repository callback would roll back a bootstrap insertion;
the proposed helper deliberately runs after transaction settlement instead.

Keep reservations, counters, checkpoint/cache publication, retention, rotation,
local cooldown timing for existing failures, admission, cancellation and stop
ownership. Already-published caches remain saved and charged attempts remain
charged. Do not replay inference or the original finalizer because a reply was
lost. Ordinary exception cleanup remains as today; it is not a replay receipt.

The helper retains one boolean and adds no query, attempt, timeout, queue, durable
state or payload. It reuses the current coalesced flight and awaited lifetime.
Fresh installs remain off. Runtime replacement/restart loses local state exactly
as before. Configuration restore and singleton deletion/recreation semantics stay
unchanged. Add no schema, endpoint, UI, operator CLI trigger, setting, job, result
field, provider capability, routing, learning, release, deployment or restart.

## Official research and tradeoffs

Research is current to 2026-11-01, using official URLs discovered through search
MCP and opened on that date. No later-November behavior is assumed.

- [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html) defines
  zero affected rows as a successful command, including the possibility of
  trigger-suppressed updates; matched unchanged rows still count. Inference:
  command success alone is insufficient evidence of matching finalization.
- [node-postgres Result](https://node-postgres.com/apis/result) obtains rowCount
  from the server command tag and distinguishes it from returned rows. Use exact
  numeric counts rather than rows.length, truthiness or coerced values.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  keeps statements on one client through COMMIT/ROLLBACK. The existing production
  runner returns the callback value only after COMMIT and health checks; preserve
  that ordering when interpreting the result.
- [PostgreSQL protocol flow](https://www.postgresql.org/docs/18/protocol-flow.html)
  describes disconnection and cancellation uncertainty. Inference: a rejection or
  lost response cannot be promoted to an acknowledged zero-row result. Preserve
  the existing uncertain-client discard and no transaction-callback replay.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), a May 2025
  Statement, supports minimizing diagnostics. Keep fixed existing results and add
  no raw error, identifier, payload or disclosure surface. There is no new web
  interaction or accessibility contract in this batch.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Worker-only helper after awaited finish | Preserves repository/SQL contracts; handles non-application at its sole production consumer | Requires a flight-local flag because admission can replace errors | First batch |
| Throw inside the repository transaction | Reuses requireWrite | Changes bootstrap rollback and triggers a secondary finish | Reject for this scope |
| Closed repository result after transaction | Could offer a broader domain contract | Adds repository churn but still needs the same worker handling | Defer |
| New public status or finalization metadata | Could expose persistence separately | Introduces a visibility contract and more operator complexity | Separate scope |
| Attempt tokens and full status ordering | Could fence later same-revision outcomes | Requires a larger durable lifecycle and restore design | Next review |

Recommended stack: unchanged revision-bound repository and single-client
transaction, exact post-settlement count interpretation, a private per-flight
non-application flag, existing deferred/local-cooldown behavior, original failure
preservation during cleanup, and permanent-stop precedence. Keep operator
execution automatic and existing UI/status surfaces quiet.

## Verification and delivery

First reproduce primary zero-row finish being reported as an ordinary outcome.
Cover all four primary sites and failure cleanup, exact count validation, no
message-spoofed evidence, flight isolation/coalescing, exact local cooldown and
permanent stop. Replace success mocks returning undefined with real rowCount-one
shapes. Test admission abort replacing the internal error without losing the
acknowledged-zero flag or issuing a second finish.

Use the production database factory against isolated PostgreSQL for real revision
changes, successful publication followed by zero-row finish, empty-plan behavior,
preserved caches/charged reservations, and failure-cleanup zero. Pause real COMMIT
acknowledgement after zero-row UPDATE and fault-inject its loss: no classification
may occur before settlement, and rejection must remain uncertain. Retain bootstrap,
stop/rollback, cooldown, isolation and restore regression evidence. Use synthetic
local provider fixtures only, without a live service or paid request.

Run focused regressions and relevant quality/ownership checks before broader
backend coverage. Review exact ownership drift before updating any pin; preserve
the baseline and unresolved classifications. Record implementation and validation
in a separate outcome document, update Unreleased, inspect the full diff, then
commit and push on main after the agreed batch passes. No release is created.

GitHub MCP currently reports no open PRs, including Dependabot. Recheck at delivery;
if still empty, random-PR implementation and stale dependency rebasing do not apply.
Use the artifact-maintenance skill before substantial tests and at handoff;
preserve recovery assets, changed-metadata exclusions and other projects.

Next: assess same-revision attempt/status ownership without inferring it from an
acknowledged update. Keep singleton lifecycle and broader write cancellation
separately scoped.
