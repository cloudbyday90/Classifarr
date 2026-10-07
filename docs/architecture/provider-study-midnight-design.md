# Provider-study midnight accounting design

Date: 2026-10-06 (local), 2026-10-07 UTC.

## Failure and scope

During comparison-retry validation, the
[database CI job](https://github.com/cloudbyday90/Classifarr/actions/runs/37548572976/job/112558390632)
failed only the final daily-counter assertion in `resource-study-provider-load`.
The test began at approximately 23:59:50 UTC and finished at 00:02:15 UTC. Its
independent receipt already proved eight completed items, eleven HTTP attempts,
two charged retries and preserved cooldowns. It expected `requests_today=11`,
but read nine. Production `omdbQuotaStore` uses the database UTC statement date
and resets the daily count on the first reservation of a new day. The timing and
two-request difference implicate the test's lifetime-versus-daily assumption;
the existing log does not contain an individual reservation ledger.

## Test-only design

Install a small quota-update audit trigger only in the integration suite's owned
`classifarr_suite_<random>` database, refusing any other database name. Record only
the resulting quota day and usage count, transactionally alongside each reservation.
No credentials, URLs, provider payloads or host-clock estimates. The existing suite
teardown drops this disposable database and its audit objects.

Assert exactly eleven committed reservations independently of the HTTP receipt;
assert each day's count is sequential from one; assert the final stored day/count
matches the last day's reservations and the provider remains enabled. Retain all
HTTP, wait, retry-budget, completion, drain and resource assertions. Do not replace
the check with a range, skip midnight runs, freeze the real HTTP test's clock or
change production quota resets.

Add a fast PostgreSQL regression for all requests in one day and a two-plus-nine
split at UTC midnight. Only that explicit boundary test injects database time, as
the existing quota tests do; it does not prove elapsed retry time. Include rollback
and unexpected-extra-reservation rejection. The full HTTP test still uses real
time and production cooldowns. Run it after the catalog memory study, not alongside it.
No migration or application-image input changes: all helper code lives under
`__tests__`, which Docker excludes.

## Research and tradeoffs

[PostgreSQL date/time documentation](https://www.postgresql.org/docs/current/functions-datetime.html),
discovered with web search on October 7 UTC, distinguishes statement time from
transaction time and documents explicit time-zone conversion. Use the persisted
database quota day rather than inferring it from the test host's clock.

The audit adds a few local writes and test-only DDL, but preserves strict accounting
across midnight and rollback. A weaker `requests_today <= 11` check would hide lost
reservations; reject it. A production quota change is neither justified nor needed.
Recommendation: fix the test's accounting, rerun targeted database cases and retain
the original failed CI result as evidence instead of rerunning blindly.
