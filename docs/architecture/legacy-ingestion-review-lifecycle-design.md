# Interrupted-import review lifecycle

## Decision

Keep the existing reviewed recovery contract and fix the browser lifecycle around
it. This complements the [recover-and-resume design](legacy-ingestion-resume-design.md);
it does not authorize unattended legacy takeover or change ingestion permissions.

Read-only inspection on October 1 found eight unfinished sync markers across two
enabled libraries, without matching ingestion ownership. The running container
was healthy. These observations do not establish that an external writer cannot
reconnect. Do not fabricate historical owners, clear markers by age, or treat a
Docker rebuild as recovery of database state.

## Reproduced defects

- A library ID alone cannot identify a page visit. Leaving library A and returning
  to A before an old request finishes lets its receipt, error or preview leak into
  the new visit.
- An old request's unconditional cleanup can release the busy state of a newer
  request, exposing controls while that newer confirmation is still pending.
- A refresh retains the old preview but previously did not disable confirmation.
  Server revision checks remain protective, but the displayed review could be
  submitted while replacement evidence was loading.
- Failure of a progress callback after a successful confirmation was caught as
  though the confirmation itself had failed. A verified receipt must remain true.

## Implementation

`useLegacyIngestionReview` remains an instance-local ESM composable, using the
existing non-persistent SWR resource and named API methods. No shared singleton,
polling loop, dependency, endpoint, schema or deployment-template change is added.

1. Give each visit a generation, synchronously invalidated on library changes and
   invalidated again on disposal. Tag previews and asynchronous operations with it.
2. Gate preview projection, mutation results, lookup results, errors, callbacks and
   busy cleanup against that generation. An abandoned completion cannot alter a
   newer visit, including A → B → A navigation.
3. Track actual preview loading and share one confirmation predicate between the
   button and command. Disable native controls during refresh and require a fresh
   stopped-writer acknowledgment after updated evidence arrives.
4. Do not refresh the preview on reconnection while a confirmation is pending or
   a receipt is displayed. Keep the original request ID, revision and resume intent
   for uncertain retries within the current visit.
5. Separate recorded-receipt handling from progress refresh errors. Keep the
   receipt and explain a display refresh failure without claiming database failure.

The existing backend remains authoritative: administrator session, exact strong
revision, stopped-writer attestation, ownership/capacity admission, row locks and
atomic audit/checkpoint transaction. Browser invalidation cannot roll back an
already-sent mutation. Pending request state still does not survive navigation or
reload; durable receipts remain in the existing server audit store. This change
does not promise cross-navigation request recovery or infer transaction failure
from an absent receipt.

## Options and final recommendation stack

| Option | Benefit | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| Depend only on library IDs and server rejection | Small client | Misleading late results; avoidable stale submissions | Replace |
| Abort every request on navigation | Less obsolete network work | Aborting a mutation response does not undo its transaction | Not a correctness boundary |
| Visit generation + shared confirmation gate | Local, deterministic, no API changes | Request state remains visit-scoped | Implement |
| Persist recovery operations across navigation | Better long-running operator workflow | Needs an explicit authenticated history and retention contract | Separate follow-up |

Recommended stack: existing PostgreSQL transaction/ownership safeguards → named
client API → visit-scoped ESM orchestration → native disabled controls and labeled
confirmation → concise status/receipt feedback. No new workflow engine is needed.

## Official research and accessibility

Sources were discovered through online search and read on **2026-10-01**, for the
requested September 2026 baseline. These are current pages, not verified archival
snapshots of their September contents.

- [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers.html) explains
  stale asynchronous callbacks after a watched identifier changes. Generation
  checks are our application of that lifecycle principle; cancellation is not a
  substitute for knowing whether a server-side mutation committed.
- [HTTP semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) specifies
  strong `If-Match` preconditions and recognizes lost mutation responses. Retain
  the existing server precondition and same-request retry contract.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  documents that advisory locking depends on application cooperation. An absent
  lock cannot attest to shutdown of older noncooperating writers.
- [W3C error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)
  supports review and confirmation for consequential stored-data changes. Keep
  the existing labeled acknowledgment and explicit recovery action.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  supports programmatic status feedback without moving focus. Retain status and
  alert roles, expose refresh waiting, and never relabel a recorded handoff as
  a completed import. Keyboard behavior is covered by a browser rehearsal, not
  a claim of comprehensive accessibility conformance.

See the [outcome](legacy-ingestion-review-lifecycle-outcome.md) for verification
and the live recovery boundary.
