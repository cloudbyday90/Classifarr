# History recording instant design

Date: 2026-09-07. Official guidance checked in September 2026.

## Purpose and contract

The [daily provenance outcome](daily-provenance-coverage-outcome.md) identified
offset-free history timestamps as the next limitation. Preserve a reliable instant
for new history without operator annotations or invented historical offsets.

Add nullable `classification_history.recorded_at timestamptz`. It represents the
start of the database INSERT statement, not media creation, classification start,
transaction commit, or the original time-zone name. Existing rows remain null.
Add the column without a default, then set `statement_timestamp()` as the default
for future inserts, in the migration runner's existing transaction. Never backfill
from `created_at`, and leave that column and its calendar-based reports unchanged.

All three production writers use explicit column lists and omit this new column:
classification persistence, source-library queue history, and queue manual
classification. The database default therefore covers them consistently. The
manual path can await routing inside a transaction before inserting history,
which makes statement time more accurate for this contract than transaction time.

Allow only finite instants or null. An AFTER UPDATE trigger rejects any change to
the instant, including filling a legacy null, while allowing normal resolutions
and same-value updates. Checking the final row also catches changes made by BEFORE
triggers. Trusted database restore/import may supply an explicit instant or null
on INSERT. No application request maps input to this column. This is a database
integrity rule, not protection against database owners disabling constraints.

## Passive visibility and security

Extend the existing evidence overview with `recording_time_coverage`: retained
events, recorded events and unknown events. Validate nonnegative safe integers and
exact reconciliation with retained history. Return aggregates only. Use the
existing fixed SQL, read-only transaction, five-second timeout and authenticated
overview route. Missing schema or inconsistent data makes the overview unavailable.

A small ESM projection and Vue component keep this concern separate from trend
calculation. Plain labelled counts and explanatory text expose the new coverage
without another table, request, control or annotation workflow. Older payloads
show recording-time coverage unavailable. The existing native tables retain their
captions, headers and keyboard access. Coverage measures available evidence, not
classification correctness; it cannot authorize semantic routing.

## Research, alternatives and recommendation stack

| Choice | Pros | Cons / limits | Official guidance |
| --- | --- | --- | --- |
| New nullable `timestamptz` | Preserves an absolute instant across session zones | Original zone is not retained; legacy instants remain unknown | [PostgreSQL date/time types](https://www.postgresql.org/docs/18/datatype-datetime.html) |
| Add column first, set default separately | Avoids assigning migration time to old rows | DDL still needs a table lock; deploy during normal maintenance | [PostgreSQL modifying tables](https://www.postgresql.org/docs/18/ddl-alter.html) |
| Database `statement_timestamp()` default | One clock and contract across writers, including long transactions | Statement start is not commit time; bulk inserts share an instant | [PostgreSQL current date/time](https://www.postgresql.org/docs/18/functions-datetime.html) |
| Finite constraint and update guard | Prevents accidental rewrites through any ordinary SQL writer | Adds update checks; privileged restore remains a trust boundary | [PostgreSQL trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html) |
| Reuse fixed aggregate SQL and native semantics | No new input surface or operational task | Counts scan retained history; no new time-series view yet | [OWASP SQL injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html), [W3C table captions](https://www.w3.org/WAI/WCAG21/Techniques/html/H39.html) |

Reject converting `created_at` in place: the original offset is unavailable and
daylight-saving repeats can be ambiguous. Reject per-writer JavaScript clocks:
they duplicate logic and can diverge from the database. Defer a timestamp index
until an actual range query and measured plan justify its write/storage cost.

Recommended stack: database-owned insert instant, immutable finite-or-null storage,
strict aggregate ESM projection, passive accessible Vue summary, and real PostgreSQL
upgrade/writer tests. Next, use these known instants in a separately labelled UTC
provenance trend that explicitly excludes unknown legacy history.
