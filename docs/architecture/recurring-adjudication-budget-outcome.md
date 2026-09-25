# Recurring AI evaluation capture: outcome

Status: Unreleased, September 25, 2026. See the separate
[design and official research](recurring-adjudication-budget-design.md).

## Delivered behavior

The existing automatic source-pair schedule now runs cached evaluation first and
then checks a separate capture budget. No second cron task or public endpoint is
added. Fresh installations and upgrades default to zero inference. The private
capture path uses the existing local-only client, model verification, prompt
preparation, response validation and database-scoped resource admission.

At most five new generation attempts are admitted per tick. A singleton PostgreSQL
ledger enforces 0–200 calls and 0–1,689,600 reserved tokens per UTC day. Each attempt
reserves one call and 8,448 tokens before the HTTP generation request. Both limits
must allow the reservation. This is conservative capacity accounting, not actual
token usage or billing. Failed, cancelled or ambiguous attempts remain charged;
successful response usage remains available in the existing replay report.

Restarts and budget edits do not reset reservations. Only a later database UTC day
replenishes them; a future quota day fails closed until the clock catches up.
Changing either limit increments a revision, fencing subsequent reservations and
publication from an older worker. Disabling does not promise cancellation of a
request already dispatched to Ollama. Shutdown/resource loss propagates cancellation
and keeps admission until work settles. No model pulls, cloud fallback or routing
permission are introduced.

## Commands

From the private application environment, enable a daily allowance once:

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --configure-source-pair-ai-budget --daily-calls 10 --daily-tokens 84480
```

Read the stored aggregate without starting inference:

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --source-pair-ai-budget-status
```

Disable new scheduled inference, without resetting consumed allowances:

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --configure-source-pair-ai-budget --daily-calls 0 --daily-tokens 0
```

Inside the image use `/app/src/scripts/` instead of `server/src/scripts/`. These
commands require private database access; no credentials belong in source control.
The existing explicit `--capture-source-pair-ai --max-calls N` command remains a
separately authorized, one-off capture and is **not** charged to the recurring
allowance. It shares resource admission, so it cannot overlap this heavy job.

## Recovery, privacy and coverage

Each validated response is checkpointed by exact request/configuration/model
identity before proceeding. Restart resumes matching retained responses. A failed
attempt with no durable response may be repeated, but each repeat needs another
reservation. Exactly-once external inference is not claimed. Source/model drift
prevents publication; incompatible plans discard unrelated progress.

The progress batch stores at most 50 responses / 1 MiB and no prompts. Like the
published response cache, its raw outputs may contain private content. Retention is
seven days; reuse preserves the original expiry rather than extending it. The
worker prunes expired/future progress even when disabled, once the app/database is
available. Database backups have their own retention responsibilities. Status uses
an explicit aggregate projection with no prompts, raw responses, model names or
private request hashes. Failure state is a fixed category, not provider error text.

The selected window interleaves movie/TV cases without consulting correction labels.
Once all available requests in a window are captured **and** matching replay is
persisted, the next window advances by 25 through the retained cohort, wrapping at
the eligible population. Unavailable preparation remains unavailable, not a success.
The report includes `selectionOffset`; its metrics describe only the current window,
not cumulative coverage or end-to-end accuracy. Old report versions remain readable.

Completion fingerprints are tied to the evidence actually captured, not a newer
snapshot read after publication. JSONB object-key order and response insertion
order are normalized for this identity; changed response content still invalidates
it. These checks prevent false drift and premature rotation.

Healthy capture/replay waiting uses a five-minute persisted cooldown; unexpected
capture failures use an hour. Database failures also have a five-minute local
fallback. No live budget was enabled, real model called, or user container changed
while developing this feature.

## Verification

Tests use synthetic movie/TV fixtures and a fake local provider, not live library
data or paid inference.

- Full backend run: 1,435 suites / 42,393 tests passed. Full PostgreSQL run:
  161 suites / 1,871 tests passed, with one existing suite/test skipped.
- After final fingerprint/publication fixes, the focused rerun passed 184 tests
  across 13 suites and the PostgreSQL rerun passed 28 tests across three suites.
  These cover concurrent reservation, restart recovery, unknown attempts, quota
  rollover, disable fencing, retention, source drift and replay-gated rotation.
- Coverage ratchet passed: server statements/lines 90.33%, branches 84.11%,
  functions 92.16%. The unchanged client used its existing coverage report;
  its suite was not rerun.
- Type checking, backend lint, unused-code checks, ESM checks, documentation,
  copyright, migration/snapshot and repository consistency gates passed. Backend
  lint retains the existing non-literal-file-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`.
- The final image built. Isolated upgrade and fresh-install containers booted
  healthy; schema comparisons passed. All smoke containers have no host mounts or
  exposed ports and use Docker's `none` network with a loopback fake provider.
- A 400-item, four-library movie/TV smoke ran the normal scheduler. Its first tick
  captured five responses. Restart preserved five reservations and progress;
  a later tick added five, reaching the configured ten-call / 84,480-token ceiling.

- At `2026-09-25T19:35:00Z`, the final-code scheduler reported `budget_exhausted`
  with ten reservations, replayed ten retained responses into five completed
  pairs, and left the post-restart fake-provider counter at zero. No cooldown
  timestamps were overridden for the application smoke. Disposable synthetic
  containers were removed afterward; the user's live container was untouched.

The GitHub MCP search returned no open Classifarr pull requests on September 25,
2026. No PR could be selected; none was invented, merged or closed.

## Next component

The follow-up is implemented in the separate [evaluation-history design](evaluation-history-design.md)
and [outcome](evaluation-history-outcome.md): bounded durable windows, distinct-item
and label coverage, separate comparison revisions, and a read-only SWR Command
Center summary. The next step is now coverage-gap diagnosis, not another capture
budget or history implementation.
