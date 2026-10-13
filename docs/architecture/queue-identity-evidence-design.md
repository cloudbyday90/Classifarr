# Failed-task replacement identity evidence

## Decision and prerequisites — 13 October 2026

Extend the explicit failed-task metadata check with source-bound external-ID
evidence. This is the first prerequisite for reviewed replacement recovery, not
permission to rewrite an identity. The existing same-ID scheduler remains unchanged.
No new work runs on fresh installs, dashboard reads, hover, or background refresh.

A current 404 establishes that the saved typed record is unavailable. It does not
identify a replacement or prove a catalog merge. Saved request IDs are declarations,
not verified ownership or proof that two editions are interchangeable. Library
inventory approval must not become authority to rewrite a classification request.

## Research and recommendation stack

Official living documentation retrieved through search and documentation links on
13 October 2026 (not an archived snapshot):

- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) separates
  title search from external-ID lookup. Never substitute a fuzzy title match.
- [TMDb Find By ID](https://developer.themoviedb.org/reference/find-by-id) returns
  different object types together. IMDb supports movies and series; TVDB supports
  series, seasons and episodes, not movies. Inspect only the intended typed bucket.
- [TMDb movie external IDs](https://developer.themoviedb.org/reference/movie-external-ids)
  and [series external IDs](https://developer.themoviedb.org/reference/tv-series-external-ids)
  support reverse ID checking. Every saved
  supported ID must agree with the candidate, not just the first successful lookup.
- [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block)
  motivates server-owned evidence and separate, version-bound confirmation before
  any future identity-changing write. A diagnostic response is never that authority.

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Keep retrying the missing ID | Existing bounded automatic recovery | Cannot repair a permanently removed record | Retain for temporary disappearance |
| Replace from title similarity | Low operator effort | Can substitute a different work or edition | Reject |
| Cross-check saved external IDs | Library-independent, explainable candidate evidence | Some legacy requests have no usable IDs; provider mappings can conflict | Implement now |
| Confirm a replacement and preserve an audit receipt | Enables controlled repair/backfill | Requires durable preview, replay/lineage fencing and edition review | Next, after evidence collection |

## Read-only contract

- Reuse the administrator-only empty-body POST metadata-check endpoint and its
  ordinary-session/CSRF protections, one in-flight check per process and five
  calls per minute per IP. Reject client-supplied IDs, URLs and actor overrides.
- Always check the original typed TMDb ID first. Only a current 404 admits the
  optional evidence lookup. Authentication, transient, malformed, cancelled and
  unknown original outcomes do not initiate replacement discovery.
- Capture only saved IMDb/TVDB fields from the task and its directly linked
  webhook. Do not search other libraries, histories or tasks for a convenient ID.
  If the linked source disappeared or its original TMDb/type disagrees, stop.
  Declared supported IDs must be valid and consistent across retained fields.
  TVDB is not usable evidence for a movie. Missing IDs remain an explicit gap.
- Use the existing strict external-ID matcher. At most two sequential finds;
  every supported declaration must resolve uniquely to the same typed ID. Reject
  malformed, duplicate, over-limit, ambiguous, missing or conflicting results.
  If find still points at the original missing ID, report that inconsistency.
- Fetch at most one candidate's typed details and reverse external IDs. Require
  the exact candidate ID and every supplied external ID to agree. Return a small
  candidate projection for review, never an approved replacement.
- The original request and all follow-up requests share the existing ten-second
  overall deadline including limiter waiting. Maximum five HTTP reads, 1 MiB per
  response, no redirects or retries, fixed TMDb host and endpoints. Abort on
  disconnect; do not retain provider bodies, URLs, credentials or raw errors.
- Recheck actor, task row revision, linked-source row revision and provider
  configuration after I/O. No transaction or lock spans HTTP. A changed or
  deleted source invalidates the result. Evidence has no durable authority.
- No writes to task payload/status, attempts, recovery budgets, intake history,
  library metadata or provider state. Restart simply discards the observation;
  there is no new durable queue, cooldown, lease or crash recovery to implement.
  Existing process-local request limits are not a distributed provider quota.

## Completion and deferred mutation

Completion means the operator sees a candidate supported by consistent saved IDs,
or the specific evidence gap/conflict/provider problem, without triggering work.
The UI remains explicit that work/edition equivalence is unverified. Unknown cases
point to a GitHub issue using the existing task reference and check details.

Future repair must use an expiring server-held preview bound to active actor,
source revision, typed old/new IDs and configuration; revalidate, consume once
and retain a durable receipt. Keep identity approval separate from routing-capable
retry, preserve retry budgets, exclude prior/uncertain effects, and never replay a
remote add because a response was lost. No live Encore mapping is authorized here.

## Verification

Test pure evidence decisions, real HTTP transport limits/cancellation, movie/series
separation, stale task/source/configuration and actor revocation, and unchanged
rows in isolated PostgreSQL. Test accessible UI text, escaped provider strings,
no render-time HTTP and late-result cancellation. Record exact local build and
validation outcomes separately; synthetic tests do not prove a real replacement.
