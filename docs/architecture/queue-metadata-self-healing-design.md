# Same-ID metadata self-healing and backfill

## Intent

The manual [record check](failed-task-identity-check-design.md) is not the end
state. Eligible missing-record failures should recover when their original
catalog record returns, without requiring an administrator to press Retry.
This does not invent a replacement for a deleted/merged/edition-specific record.

## Recommendation and tradeoffs

Use the existing PostgreSQL queue and scheduler with a small recovery ledger.
Compared with manual checks alone this reduces operator work; compared with
repeated classification it avoids consuming AI work while an ID is still absent.
The cost is conservative eligibility and delayed recovery. Automatic title
replacement and unlimited budget resets remain rejected. Separate ESM provider,
repository, service and scheduler modules share the bounded TMDb read transport
with the diagnostic UI. No new package or background service is required.

## Durable contract

- Every five minutes, enroll at most 100 previously unenrolled tasks and claim
  at most one due check per scheduler invocation. Fresh installations do nothing.
  Existing eligible rows are enrolled through this same bounded backfill; the
  migration itself performs no provider requests or retries.
- Only confirmed `task_metadata_not_found` failures at `metadata_fetch`, with
  valid movie/TV identity, no claim, no routing/result link and remaining attempts
  in a normal budget of at most five are eligible. Unknown legacy failures and
  already-exhausted tasks require review; do not manufacture a historical 404.
  Newer same-identity tasks/history and linked intake decisions exclude replay.
- First check is at least one hour after enrollment. Before each provider call,
  atomically consume a probe and save its lease token and next due time. Delays
  after probes are 6 hours, 24 hours, 3 days, 7 days and 14 days. Stop after six
  probes or one successful automatic requeue. These limits are product choices,
  not timings required by the cited standards.
  A valid provider Retry-After can extend (never shorten) the saved wait, capped
  at 30 days. Disabled or unavailable configuration does not reset the budget.
- Competing schedulers acquire the task lock before the ledger lock, use
  `SKIP LOCKED`, and recheck due state. Enrollment commits separately before
  acquiring update locks. A crash consumes the admitted probe and preserves its
  cooldown; there is no retry storm or in-memory budget reset after restart.
- HTTP occurs outside transactions, uses the captured configuration and exact
  typed ID, a ten-second deadline, cancellation, 1 MiB cap, shared limiter and
  no redirects/retries. No provider body or credential is stored in the ledger.
- On completion, lock task then ledger; require the original row revision and
  lease, validate typed details, recheck eligibility and configuration, and save
  the observation. Configuration locking occurs only during final admission.
  Stop/cancellation, malformed responses and configuration/source changes cannot
  admit work. Interrupted final writes roll back atomically.
- Requeue the **same task**, keep payload, source, attempt/max-attempt counters,
  original creation time and history, and atomically record consumed recovery.
  Align an existing unlinked failed intake receipt with the resumed queue state.
  Later worker failure uses the normal retry budget. Normal classification and
  routing safeguards still apply; successful provider lookup is not permission
  to choose a destination or bypass policy review.
- Ledger rows cascade with their task. Failed-list reads expose only cooldown,
  counts and bounded outcomes, never trigger HTTP. Manual diagnostic checks do
  not consume or reset the automatic budget. A later manual retry also does not
  renew the one-time automatic recovery allowance.
  Existing queue retention/dismissal can remove a task before all six probes;
  recovery does not prolong retention or resurrect a deleted task.

## Limits and next work

This recovers **record availability**, not identity replacement. If an ID never
returns, it remains unresolved with a finite observation trail. Exhausted and
historically unknown failures remain excluded. The diagnosed Encore record still
returns 404; no verified TMDb replacement has been established or approved.

Next is evidence-driven identity repair: reconcile authoritative external IDs
and source lineage, distinguish work versus edition, and apply a reviewed,
version-bound mapping with a durable audit receipt. Never reuse media-inventory
approval as authority to rewrite a classification request or repeat a remote add.

## Sources and verification plan

Research retrieved 13 October 2026 is linked in the record-check design:
TMDb's typed lookup/error contracts, OWASP server-controlled transaction data,
and PostgreSQL transaction locking. The same-day Disney/BBFC findings establish
edition ambiguity, not an alternate identity.

Verify against isolated PostgreSQL: concurrent claims, cooldown across service
restart, one-time admission, no attempt reset, stale leases/rows, cancellation,
configuration changes, missing/auth/rate-limit/unknown responses, late provider
success, ineligible legacy/routed/superseded tasks, receipt alignment, rollback
and migration idempotence. Test actual HTTP separately. Report image and local
deployment results, deliberate fixture clock advances and limits independently.
