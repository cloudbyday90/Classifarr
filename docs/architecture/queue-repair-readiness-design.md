# Reviewed-repair readiness

Date: 13 October 2026 (Eastern). Design before implementation; no release or live
repair authorization. Extends [selected backfill](queue-reviewed-backfill-design.md).

## Decision and official guidance

Show a bounded local readiness assessment beside each reviewed repair. Reuse the
retry eligibility checks, but never treat this read as permission to enqueue.
Currently a changed item is discovered only when it rejects an entire selection.

Official sources discovered and opened through MCP on 13 October 2026:

- [PostgreSQL 18 transaction settings](https://www.postgresql.org/docs/18/sql-set-transaction.html?trk=article-ssr-frontend-pulse_little-text-block):
  repeatable-read provides a consistent transaction snapshot; read-only transactions
  prohibit application table writes. A snapshot does not reserve future state.
- [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block):
  enforce allowed transitions and authorization at the final execution gate.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block):
  make action results available to assistive technology without moving focus.

The following recommendation is our application-specific inference:

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Explain only after retry refusal | No extra database reads | One stale item surprises and blocks the selection | Retain as final fallback |
| Read-only per-item reasons using shared checks | Earlier explanation; no provider calls or writes; avoids duplicated rules | Snapshot can become stale; bounded extra queries | Implement |
| Reserve items or run provider checks on list load | Fresher external evidence or temporary exclusion | Status causes work, provider load or writer contention | Reject |
| Automatically retry previously approved items | Less operator work | Approval is not durable unattended retry consent | Defer |

Final stack: explicit list load → bounded database snapshot → shared eligibility
assessment → plain-language per-item reason → explicit selection and consent →
unchanged locked write revalidation → durable retry receipt.

## Contract and bounds

Keep GET `/api/queue/identity-repair/backfill`, its 20-item keyset page, admin access
session requirement, no-store headers and 20-reads/minute process limit. Add a
page `checkedAt` timestamp and per-item `readiness: { status, reason }`. Status is
`ready` or `blocked`; reason is a fixed allowlisted code. Return the first blocking
condition, not every possible condition. Ready means local retry checks passed at
that snapshot, not provider health or guaranteed classification success.

Use a READ ONLY, REPEATABLE READ transaction, one-second lock wait, three-second
statement limit and five-second transaction lifetime. Do not lock admin or task
rows for status. Check active administrator in the snapshot. The write command
continues to lock and revalidate current authority. One readiness read per service
instance at a time, sequential item checks, no automatic retries or polling.
Only local provider configuration is read; no provider method is invoked. Empty
installations perform no configuration lookup and have no enrolled work.

Share the existing provider revision, bounded payload, retry budget, task/source
version and competing-work eligibility checks with the write path. Keep receipt
matching, consumed-receipt replay, final locks, cancellation, writes and persisted
one-enqueue budget unchanged. Do not invent a second SQL ownership predicate.
Shared checks preserve individual retry's existing provider-check contract.

Only safe reason codes and the existing bounded title/typed IDs reach the client;
no raw payload, provider key/revision/URL, unrelated task IDs or exception messages.
The client uses fixed copy, disables blocked/missing/unknown readiness selections,
clears selection and consent on reload, and announces load results. GET timeout or
unexpected failure fails the whole read; never manufacture a successful readiness
result. Abort on disconnect between queries; an in-flight query remains bounded
by database timeouts. No partial page is returned after cancellation.

## Outcomes and recovery

- Ready: explicit consent is still required; retry revalidates under writer locks.
- Blocked: settings unavailable/changed, unsupported or conflicting request,
  exhausted/changed budget, changed source/task or prior work. Review the indicated
  cause. Do not claim a provider record is permanently missing or clear evidence.
- Transient busy/timeout: later explicit reload; no stored cooldown or retry loop.
- Unknown database/program error: sanitized HTTP failure, no ready result or write.
- Cancelled/restarted read: discard it and reload; there is no durable read state.
- Stale ready result: the existing write gate refuses changed evidence atomically.

No schema change, provider mutation, mapping approval, inventory write, automatic
enrollment, budget reset or memory-guard change. Unraid and shared services remain
unchanged. Failed/cancelled/deleted tasks continue to follow existing discovery
scope; this is not a complete historical receipt audit.

## Acceptance and next item

Prove reasons and write-gate parity, ready-to-stale refusal, empty/disabled setup,
read-only isolation, concurrent writer behavior, read cancellation/busy release,
timeouts and unexpected errors, bounded pagination, no provider I/O, safe HTTP
projection and accessible client state. Run full coverage and quality gates, then
the requested no-cache local rebuild and isolated packaged checks.

Next consider an explicit per-receipt unattended retry enrollment design, with
persisted consent/revocation, cooldowns and attempt limits. Do not automatically
enroll existing approvals. Record implementation results separately.
