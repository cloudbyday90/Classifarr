# Legacy ingestion reconciliation

## Decision — September 2026

This document describes the retained maintenance-only contract. The additive
[recover-and-resume design](legacy-ingestion-resume-design.md) provides an
explicit option for already-enabled libraries without changing settings or
removing the stopped-writer confirmation.

Provide a per-library, administrator-session-only preview and confirmation flow
for import markers that predate verifiable ownership. Require the library to be
disabled and the administrator to confirm that older instances and external
capture scripts have stopped. Recheck the exact preview under the existing
ingestion ownership lock, update only the reviewed markers, and commit an audit
receipt with a pending full replay. Leave the library disabled.

This is **operator-attested maintenance**, not automatic proof that an arbitrary
older process has stopped. Advisory locks are cooperative. Neither an old
timestamp, a quiet database connection nor an absent new-protocol lock proves
that an old process will not write again. If stopped ownership cannot be
established, do not confirm. No process termination, media deletion, routing,
credential change, AI invocation or automatic enabling belongs in this flow.

## Design

1. Open a read-only, non-persistent preview containing bounded marker IDs,
   progress and capture generation, with a clear eligibility reason.
2. Disable the library using its existing configuration control, stop other
   instances/capture scripts, then refresh the preview.
3. Confirm the stopped-worker attestation. A strong `If-Match` precondition binds
   the request to the current library/source/ownership/marker revisions.
4. Obtain the existing per-library ownership lock. Within one short transaction,
   revalidate the active administrator, lock current rows, and reject changes,
   active ownership, overflow or an enabled library.
5. Mark reviewed unfinished records failed, never completed; retain inventory
   and observations. Set durable ingestion state to retry-wait for full replay.
6. Commit a minimal audit receipt atomically. A request UUID supports safe replay
   of the same confirmation and a read-only outcome lookup after a lost response.
7. The administrator re-enables the library only when older writers remain
   stopped. The normal bounded watchdog performs full replay; learning remains
   gated until actual import completion.

No new workflow engine or timer is introduced. Audit records follow existing
audit retention, independently of the durable ingestion checkpoint. Preview
reads never modify records. Receipt absence is not proof that a request failed.
If a response is lost and a retry is rejected (for example by new ownership or
revoked access), the UI preserves the original request ID and uncertain outcome.
That later rejection cannot establish that the original transaction rolled back.
New-protocol interrupted imports continue to recover automatically and are not
eligible for this exceptional workflow unless foreign markers also exist.

## Interpreting a recurring unknown-owner warning

A newer completed sync can coexist with older `pending` or `running` records.
If those older records lack a matching ownership ledger, a completed scan does
not retroactively prove their writers stopped. The warning can therefore appear
after a restart even with a populated library and no currently visible owner.
It does not by itself mean media was lost, the server is offline, or memory is
exhausted. Inspect the blocked-import preview rather than clearing the log.

To recover after confirming old writers are stopped:

1. Open the affected library using the warning's library link.
2. Turn off **Library enabled**, save, then choose **Review blocked import** (or
   **Refresh review** if already open).
3. Inspect **Records to reconcile** and confirm the stopped-worker checkbox.
4. Choose **Reconcile reviewed records**. Preserve the returned receipt; this
   marks interrupted records failed, not successful, and retains imported media.
5. Re-enable and save. Let the existing scheduler perform a complete backfill;
   do not expect reconciliation alone to mark ingestion complete.

If another owner is active, the preview changes, or old-writer shutdown is
uncertain, stop before confirmation. Refresh and investigate; do not bulk-update
statuses in SQL or use record age as a substitute for ownership evidence.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Clear old markers by age | No user action | Cannot distinguish a slow live writer | Reject |
| Treat an absent advisory lock as proof | Simple | Older writers do not honor that lock | Reject |
| Disabled library + administrator attestation + revision checks + audit | Bounded, reviewable recovery using existing infrastructure | Requires one explicit legacy-maintenance intervention; attestation cannot be independently verified | Implement |
| Database-enforced fencing of every historical writer | Stronger technical boundary | Cross-cutting changes to all writers and upgrade compatibility | Consider only after an exhaustive writer inventory |

Recommended stack: existing PostgreSQL ownership and transactions, modular ESM
contract/repository/service files, strict administrator-session routes,
non-persistent SWR preview, native labeled confirmation controls and atomic audit
receipts. Prefer a clear blocked state over a claim of safety that cannot be proven.

## Official research

Discovered and read with online search/browser tools on 2026-09-27:

- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  advisory locks rely on cooperating applications; row locks protect concurrent
  modifications for a transaction, not arbitrary future writes.
- [RFC 9110 conditional requests](https://www.rfc-editor.org/rfc/rfc9110.html):
  strong `If-Match` comparisons prevent applying a change to a stale representation;
  a failed precondition must not execute the requested change.
- [W3C error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data):
  allow review and confirmation of stored-data changes before submission.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  announce meaningful results without moving focus or announcing every counter.
- [W3C Web Cryptography Level 2](https://www.w3.org/TR/webcrypto-2/) (Working Draft):
  `randomUUID` requires a secure context; `getRandomValues` supplies secure random
  bytes without that restriction. Generate UUIDv4 request IDs from those bytes,
  using the same secure-random pattern as existing policy controls. Never fall
  back to predictable randomness; missing browser support prevents submission.
  This compatibility path does not provide transport security; HTTPS remains
  appropriate for authenticated access over a network.

Implementation and test outcomes are recorded separately in
[the outcome document](legacy-ingestion-reconciliation-outcome.md).
