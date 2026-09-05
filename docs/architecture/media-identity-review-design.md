# Authenticated media identity review design

## Problem and scope

The title and external-ID abstention work leaves uncertain inventory items with
`tmdb_resolution.status = review_required`. Administrators need a way to inspect
these items and explicitly supply a verified TMDb identity. This workflow fills
missing IDs only. It does not classify, route, reprocess, train, or supply human
labels to the frozen semantic study.

## Recommendation and alternatives

| Option | Advantages | Costs | Decision |
| --- | --- | --- | --- |
| Manual ID entry with typed provider preview | Small, explicit evidence surface; preserves abstention | Operator must find the ID and verify the match | Implement first |
| Search and rank candidates in the review screen | Faster discovery | More ambiguous evidence and selection behavior to validate | Follow-up after operator feedback |
| Apply a ranked candidate automatically | Less operator work | Reintroduces unmeasured identity errors | Reject |
| Database-backed preview | Works across restarts and replicas; supports atomic consumption | One small table and migration | Implement |
| Browser or process-local preview authority | Less persistence | Tampering or replica/restart consistency problems | Reject |

The recommended stack is the existing Vue UI and named API leaf modules,
session-authenticated Express routes, modular ESM contracts/repository/service,
a bounded TMDb details request, PostgreSQL row locks, and the existing audit log.
No new dependency or release is needed.

## Contract and security

- `GET /api/media-identity-review` returns a bounded keyset page of unresolved
  movie/TV inventory, optionally filtered by type. The projection exposes only
  identity evidence, a readable reason, and an opaque source version.
- `POST /api/media-identity-review/:itemId/preview` accepts a numeric TMDb ID and
  the source version. The source determines the provider endpoint's media type.
  The server fetches and validates a minimal candidate before taking DB locks.
- `POST /api/media-identity-review/:itemId/confirm` accepts only the opaque preview
  ID and `confirmed: true`. Candidate identity and actor never come from this body.
- A current active administrator with an ordinary access session is required on
  every operation. API keys and scoped automation tokens are excluded. Cookie
  mutations use the application's CSRF protection; API-key headers cannot bypass
  it on this route. Deployments should keep CSRF protection enabled.
- One stored preview per administrator expires after ten minutes. Creating a new
  preview replaces that administrator's previous one, including in another tab.
- A SHA-256 source version includes the row revision and identity fields. Preview
  creation and confirmation recheck eligibility and version while holding the
  source lock. Any source edit requires a fresh review, even an unrelated sync.
- Confirmation locks the actor, source, and preview; checks expiry with database
  time; consumes the preview; fills the missing ID; and inserts an audit receipt
  in one transaction. Audit failure rolls back the ID and preview consumption.
  Replays, another actor's preview, stale source state, and revoked roles fail.
- Provider requests use fixed typed paths, strict integer IDs, rate limiting,
  a ten-second timeout, and a minimal response projection. Credentials, full
  provider responses, titles, and overviews are excluded from audit metadata.

The audit receipt records the actor, source item, typed TMDb identity, previous
reason, preview ID, and source version. It is a durable application audit entry,
not a claim of protection against privileged database modification.

## Interaction and accessibility

Libraries links to a dedicated review page. Native labeled controls select a
media type and accept an ID. Source and candidate appear together. A separate
verification checkbox precedes the final confirmation button. Text identifies
errors; status messages announce progress and completion. Focus moves logically
into review and back to the queue. Vue text interpolation escapes evidence.
Late responses cannot restore a cancelled or superseded review.

## Research basis

Research was checked on 2026-09-05 against official sources for the requested
August 2026 baseline. Living documentation is not an archived August snapshot.

- Check authorization on every request and deny by default:
  [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- Bind confirmation to server-held transaction details and enforce the sequence:
  [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html).
- Use transactional row locking for concurrent decisions:
  [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html)
  and [concurrency control](https://www.postgresql.org/docs/18/mvcc.html).
- Fetch details using the source's explicit type:
  [TMDb movie details](https://developer.themoviedb.org/reference/movie-details)
  and [TV series details](https://developer.themoviedb.org/reference/tv-series-details).
- Provide programmatic status and logical focus:
  [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  and [focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).
  These inform implementation and checks, not a whole-product WCAG conformance claim.
- Check normal button text against the 4.5:1 minimum:
  [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
  The review actions use the existing darker primary color for white text.

## Validation and next decision

Test authorization, provider response validation, tampering, expiry, replay,
source edits during provider I/O, competing confirmations, and audit rollback.
Exercise PostgreSQL using local Docker and the UI with keyboard/browser checks.
Record measured results separately in the outcome document.

The next priority is receipt recovery after a lost confirmation response: an
authenticated operator should be able to retrieve the already committed result
without another write. Bounded candidate search can follow operator feedback.
Independent human labeling and frozen-study readiness gates still precede any
semantic counter-evidence behavior.
