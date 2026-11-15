# Pending notification ID matching design

November 14, 2026 (America/New_York). Agreed first batch at main
`a11569edd4d9b33077c17b74483f9f60af8cf484`, with final shared understanding
confirmed under the repository workflow. This follows the exact-ID lifecycle repair
and the [UUIDv7 readiness assessment](classification-uuidv7-readiness-outcome.md).

## Reproduced failure and first consumer

Pending replacement retires matching unread app notifications in its existing
transaction. The WHERE clause checks digit-only extracted JSON text and then
casts it to BIGINT. Digit-only text can still exceed BIGINT range; unrelated
malformed notification data can therefore abort a valid replacement with `22003`.
Separate AND predicates do not establish safe evaluation order.

The isolated production-factory PostgreSQL baseline reproduces that failure with
ordinary predecessor ID 41, a matching leading-zero notification and an unrelated
out-of-range notification. The insertion callback is not reached and the existing
transaction restores History and notification state. No production occurrence or
durable corruption was established.

Repair only this runtime notification UPDATE. Leave retry cleanup, developer
cleanup scripts and historical migration SQL for separate work. Do not rewrite
historical notification payloads, add cleanup/retention work or change producers/API/UI.

## Matching contract

The existing lifecycle now validates its complete predecessor array before any
mutation, through `pendingDecisionRowIds.mjs`. Each value is a positive safe
number or exact canonical BIGINT decimal string. This is a prerequisite of the
new statement, not a general-purpose JSON-to-ID conversion API.

Keep the existing unread, nonnull-data, notification-type and digit-only filters.
Replace only the unsafe numeric comparison with:

```sql
AND (data->>'classificationId') ~ '^[0-9]+$'
AND (ltrim(data->>'classificationId', '0') COLLATE "C")
      = ANY($1::text[])
```

The exact validated predecessor list is still bound as the same one parameter.
No JavaScript ID coercion or new database read is needed. Other lifecycle SQL
continues using its existing BIGINT bindings. Put this UPDATE in a small SQL leaf
such as `pendingDecisionNotificationSql.mjs`; retain transaction ownership and the
client.query call in the lifecycle service.

For positive canonical comparison targets, stripping leading ASCII zeroes gives
the same successful matches as the prior numeric conversion. It also removes the
dangerous operation altogether: malformed and out-of-range text cannot equal a
valid bounded predecessor. Predicate ordering is no longer needed to protect an
untrusted numeric cast. Explicit C collation makes the text comparison exact.

| Stored JSONB value | Required behavior after repair |
| --- | --- |
| Number 41 or string `"41"` | Matches ID 41 |
| String `"00041"`, including arbitrarily long zero prefixes | Matches ID 41 |
| Exact large number/string within BIGINT range | Matches that exact predecessor |
| Zero or all-zero strings | Cannot match a positive predecessor |
| Oversized digits / maximum plus one | Nonmatching and unchanged, without a range exception |
| Negative, signed, spaced, hexadecimal, underscored or decimal strings | Nonmatching |
| Decimal JSON number 41.0 | Retained fractional zeroes make extracted text nonmatching |
| Numeric JSON exponent 4.1e1 | JSONB normalizes to 41; retain its match |
| Exponent string `"4.1e1"` | Nonmatching |
| Containers, booleans, missing keys, JSON/SQL null | Nonmatching |

Compatibility concerns the stored JSONB extracted text, not original JSON source
spelling. Raw numeric exponents and decimal scales must be tested through raw JSON
or SQL rather than JavaScript JSON.stringify, which can normalize them first.
The existing canonical JS helper deliberately rejects leading zeros and must not
be applied to historical notification values.

## Effects and preserved boundaries

Only matching predecessor notifications become read. Preserve COALESCE(read_at,
NOW()), existing read timestamps, already-read rows, unrelated notification types,
unrelated valid IDs and malformed data. Invalid entries retain data/is_read/read_at;
they are not dismissed, repaired, deleted, logged or granted action authority.
Valid replacement proceeds atomically despite their presence.

Preserve identity advisory locking, History row locking, the partial unique index,
the insert callback, both lifecycle links, raw valid result types, completed and
other bypasses, isolation and existing write limits. Retain late-notification row
locking and existing completed-answer receipt recovery. Keep genuine SQL failures
as transaction failures; do not catch-and-continue or infer success from zero rows.
Uncertain COMMIT acknowledgements remain unknown and are not replayed.

No new query round trip, database function, migration, schema/version, setting,
job, provider call, UI, API, operator CLI trigger, routing or learning authority is
introduced. No historical backfill, cleanup, release or deployment is authorized.

There is no raw-length cutoff: it would reject previously valid leading-zero
strings. Processing long text remains proportional to its length, as with the
existing regex. Existing SQL/resource limits remain; this is not a constant-time
or measured performance-improvement claim and adds no index.

## Verification and delivery

Baseline evidence: three existing unit suites pass 128 tests. A separate isolated
PostgreSQL diagnostic passes 42 checks: a 41-case matching comparison plus the
current production overflow/rollback reproduction. Stored-row comparison against
a guarded numeric reference agrees with the proposed cast-free predicate for
leading zeros, large IDs, overflow, null/containers and numeric representation.

After confirmation, add failing old-code regressions before implementation:

- Successful real replacement with matching and unrelated malformed notifications
  present, for both active statuses. Verify malformed rows remain unchanged.
- Ordinary/string/large IDs, BIGINT maximum and neighbor, maximum plus one,
  64-KiB digit and leading-zero inputs, all zeros and invalid scalar/container
  shapes. Keep exact large numeric JSON values out of JavaScript Number.
- Raw JSON exponent versus exponent string and retained decimal scale; no new
  numeric spelling acceptance. Check statement bindings and canonical-list
  admission remain intact.
- Existing notification type/unread/timestamp behavior, forward/reverse links,
  callback/backlink rollback, real delayed/lost COMMIT acknowledgement without
  replay, concurrent replacement, observed late-notification blocking, actual
  writer and provider-recovery lock ordering.
- Existing HTTP/read-state/replay controls, without claiming unrelated large-ID
  API/Discord gaps are repaired.

Use stored rows for any CASE reference comparison: PostgreSQL can pre-evaluate
constant-derived expressions during planning. The proposed predicate itself has
no notification numeric conversion or CASE dependency.

Run fresh backend coverage and appropriate application/browser/quality/security
gates. Reuse client evidence only with verified unchanged relevant inputs,
installed graph and report hashes. Review ownership entries without weakening
classifications, assertions, deadlines, scanner policy or review caps. Maintain
artifacts, write a separate observed outcome and Unreleased note, then commit/push
intended changes on main and inspect that commit's CI. No open PR is available at
intake; recheck without reusing closed PRs or rebasing fresh/unrelated branches.

## Official research and independent review

Sources were discovered/opened through MCP on November 14 local time:

- [PostgreSQL expression evaluation](https://www.postgresql.org/docs/18/sql-expressions.html)
  documents that subexpression evaluation order is unspecified. Application
  inference: remove the unsafe cast rather than relying on another AND guard.
- [PostgreSQL string functions](https://www.postgresql.org/docs/18/functions-string.html)
  specifies ltrim's leading-character removal. Here it preserves historical zero
  prefixes while keeping the validated target identity unchanged.
- [PostgreSQL collation support](https://www.postgresql.org/docs/18/collation.html)
  describes C/POSIX byte-oriented behavior. Use C for an exact key comparison,
  rather than inferring identity through a linguistic comparison.
- [PostgreSQL JSONB representation](https://www.postgresql.org/docs/18/datatype-json.html)
  explains exponent expansion and fractional-zero retention. Match the extracted
  value's existing meaning without inventing a new spelling policy.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  recommends structural metadata. The applicable practice is an explicit documented
  representation/compatibility contract; no new UI or conformance claim follows.

GPT-6 Astra independently reviewed the alternatives and supports the cast-free
comparison given the existing complete canonical predecessor validation. A
separate source trace verified producers, matching semantics and adjacent gaps.
Neither review executed tests or changed source; execution evidence is separate.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Add another AND guard around the cast | Small apparent edit | Still needs a real evaluation fence and valid range semantics |
| CASE plus native input validation | Can safely preserve the numeric contract on supported PostgreSQL | Retains conversion/type-function dependency when conversion is unnecessary |
| CASE with significant-digit/range logic | Avoids native validity-function dependency | More boundary/normalization logic and repeated expressions |
| Validated target text plus leading-zero stripping | Removes conversion and preserves successful legacy matching | Depends on canonical positive targets; long text still requires scanning |
| Enforce new canonical JSON or clean data | Uniform future input | Changes compatibility and introduces a different data-write/cleanup scope |

Recommend cast-free matching: existing whole-list validation, unchanged transaction
and filters, a small SQL leaf, exact trimmed-text comparison, unchanged notification
retention, atomic replacement, and honest failure/unknown-commit handling.

Next, assess the analogous retry-artifact cleanup predicate, which still casts
notification IDs to INTEGER and accepts two JSON key spellings. Historical upgrade
SQL also has an unsafe cast; keep that a distinct source-upgrade decision. The
broader INTEGER/reference/UUIDv7 readiness work remains separately scoped.
