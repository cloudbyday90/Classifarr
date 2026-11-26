# Queue identity repair BIGINT outcome

November 26, 2026. See the [design and tradeoffs](queue-identity-repair-bigint-design.md).

Metadata checks, identity repair and selected backfill accept exact task IDs
through PostgreSQL's BIGINT maximum. The server validates once at each entry
point and carries decimal text through its existing bound queries. The
browser validates before sending a path, cursor or selected task ID. Checks,
previews, receipts and readiness retain their decimal-string task IDs. A
missing browser cursor still loads the first page.

Preview and receipt UUIDs, numeric TMDb IDs, saved revision hashes and the
database schema keep their existing contracts. The current administrator
checks, provider limits, readiness and write transactions, retry budgets and
receipt-based recovery continue to govern the workflow.

## Verification

- The original implementation refused a valid large task in the PostgreSQL
  HTTP diagnostic and blocked the large-ID repair used to build the
  pagination fixture. It also accepted a single-element array as a direct
  metadata check input. The revised validators reject that input before a
  database read or provider call.
- Isolated PostgreSQL and HTTP tests verify the metadata check and repair
  commands for adjacent large tasks. A preview or receipt for one cannot
  authorize work on the other. Repeating a completed command returns its
  saved receipt. The 20-item readiness page returns a large cursor that
  reaches the final item at the BIGINT maximum. An invalid item in a mixed
  batch leaves all tasks failed, and the valid five-item batch queues only
  the selected receipts.
- The 190 focused server tests, 90 focused client tests, and 102 isolated
  PostgreSQL tests passed. The PostgreSQL HTTP fixture supplies an
  administrator session and bypasses rate limiting. Separate route tests
  exercise the existing session, CSRF and rate-limit boundaries. The suites
  also cover revision checks, cancellation, rollback and saved outcomes.
- The client build and four Chromium Command Center checks passed. Root,
  server and client dependency audits reported no vulnerabilities.
- Full local CI passed with 64,779 backend tests, one existing skip, and
  7,748 client tests. Fresh statement coverage was 89.33% for the backend
  and 87.84% for the client. The coverage ratchet, lint, documentation, type
  and ESM checks, and staged secret scan passed.
- GitHub listed zero open pull requests, including Dependabot.

## Next item

The classifier's metadata-failure log projection still drops task IDs above
the safe-integer limit. Trace that field through logging and its readers,
preserve exact correlation, and review any remaining saved task references
before deciding which identities need UUIDv7.
[UUIDv7 assessment](classification-uuidv7-readiness-outcome.md)
