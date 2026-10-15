# Installation-scoped gateway work history

Design, 2026-10-15. Optional gateway, synthetic local tests only. No release,
Unraid/provider changes, routing activation or automatic recovery.

## Decision and evidence

Bindings identify admitted requests and optional originating queue tasks, but
the ledger keeps only the most recent completion time. A non-active binding is
not evidence of success. Add immutable completion receipts for future requests
and a read-only, administrator-facing history panel in AI settings. Historical
outcomes remain explicitly unrecorded; do not backfill guesses.

Official sources discovered and opened through MCP on 2026-10-15:

- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  deny by default and authorize every request/object. Bind installation scope to
  the gateway credential, never a browser query parameter or source-task ID.
- [PostgreSQL 18 pagination](https://www.postgresql.org/docs/18/queries-limit.html):
  deterministic ordering is required and large offsets still scan skipped rows.
  Use the existing monotonic admission attempt as a keyset cursor, not timestamps.
- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/sql-set-transaction.html):
  a statement sees a consistent committed snapshot. Use one parameterized SELECT
  for each history page, avoiding transaction-mode changes on the shared ledger
  connection. Validate it under a SELECT-only role and a read-only transaction.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Infer success when no longer active | No new storage | Misrepresents abandoned and legacy work | Reject |
| Immutable completion receipts plus bounded reads | Honest outcomes; atomic completion; no new dependencies | Standalone schema upgrade and small storage cost | Implement |
| General tracing platform | Rich cross-service search | Extra infrastructure, exports and privacy policy | Defer |

Recommended stack: ESM services, PostgreSQL UUIDv7 append-only receipts, authenticated
gateway GET, protected Express GET, named client API function and a small Vue panel.

## Contract and boundaries

- Existing completion fencing and an INSERT receipt share one SQL statement. A
  receipt failure rolls back completion, preserving uncertainty. Never retry the
  write automatically. Attempts, ownership, cooldowns and request bindings stay intact.
- Record validated response completion, known provider rejection (allowlisted
  status only), proven cancellation before dispatch, or generic completion when
  an internal legacy caller supplies no detail. Response completion does not mean
  the application queue task or classification succeeded.
- Active requests display `active_or_uncertain`. Administrator-attested abandonment
  displays separately from success. Older completed records display
  `outcome_not_recorded`; missing task references display uncorrelated.
- `/gateway/history` authenticates and reads only the credential's installation
  under the current owner/provider/schema fence. Allow only optional canonical
  positive-bigint `taskId` and `before` parameters; reject duplicates/unknown keys.
  No installation selector. Maximum 25 records plus one lookahead, newest admission
  first, no offset or count scan. Pages are observations, not a frozen outcome snapshot.
- History never calls Ollama, claims compute, changes budgets or enters the inference
  wait queue. Retain global HTTP rate/concurrency bounds and 4-second SQL timeout;
  the application has a 5-second/64-KiB transport bound. No automatic polling/retries.
- The application endpoint requires authentication and administrator access. No
  gateway binding means a distinct not-configured result and no outbound request.
  Closed/replaced/revoked contexts fail closed. Client disconnect cancels its wait;
  a bounded SELECT already executing may finish, but cannot cause provider work.
- Expose request ID, task reference, operation/model, observed times and fixed outcome
  labels only. No prompts, responses, credentials, fingerprints, endpoint details,
  recovery evidence or claim tokens. No retry, cancel, stop or repair controls.
- The panel loads only on explicit request, supports task filtering and older-page
  navigation, announces loading/errors, and discards stale/unmounted responses.

## Migration, verification and next step

Standalone schema v7 adds a timestamp-named migration with a native UUIDv7 receipt
primary key and indexes for installation/task admission order. Apply only after
backing up/stopping v6 under its advisory lock. Existing bindings and unknown work
survive unchanged; old writers fail closed. Fresh application installs do not
initialize the gateway database or enable routing. Update restricted-role grants.

Prove atomic completion, duplicate/stale writes, receipt failure, restart uncertainty,
read-only roles, foreign-installation exclusion, pagination during concurrent new
admissions, malformed inputs, revocation and unchanged inference counters. Test
real HTTP/PostgreSQL, API authorization, UI states, and the exact rebuilt image.

Next: reviewed local gateway routing rollout and bounded operational observation;
task history is not authority to adopt foreign work or recover an unknown request.
