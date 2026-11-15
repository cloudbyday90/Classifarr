# Pending replacement BIGINT design

November 14, 2026 (America/New_York). Agreed first batch at main
`46be868d175803ffc9a8578386f6c8a32c2e5fcd`, with final shared understanding
confirmed under the repository's grilling workflow.

## Reproduced problem

The production database parser deliberately returns safe BIGINT IDs as JavaScript
numbers and larger IDs as exact decimal strings. Pending replacement then passes
selected History row IDs through `positiveInteger`, which converts them to
`Number` without checking safe precision. The resulting predecessor list feeds
history supersession, notification read tracking and successor metadata.

An isolated PostgreSQL reproduction using the production database factory found:

| Case | Observed current behavior |
| --- | --- |
| Predecessor `9007199254740993` and distinct neighbor `9007199254740992` | Replacement binds the neighbor's rounded ID; intended predecessor remains active; the next pending INSERT fails with `23505` |
| Transaction after that failure | Both History rows and notification read state roll back; no durable neighboring-row change was observed |
| Small predecessor and successor `9007199254740993` | Returned ID and PostgreSQL backlink are exact, but ordinary JSONB readback rounds the numeric backlink to `9007199254740992` |

These are controlled local reproductions, not evidence of a production occurrence.
Existing lifecycle/persistence baseline suites pass 70 tests; their coverage uses
small IDs and does not establish correct large-ID replacement.

## First boundary and compatibility

Repair prospective row-ID handling and both lifecycle metadata links within the
existing active pending replacement transaction. Reuse
`canonicalDatabaseBigintId` through a small lifecycle-specific service leaf.
Do not change the shared database parser or the media identity builder's
`positiveInteger`, TMDB/source-library fields, identity version or unique index.

For selected predecessor IDs:

1. Require a positive safe numeric value or canonical decimal string within
   PostgreSQL's signed BIGINT maximum `9223372036854775807`.
2. Project valid IDs through `9007199254740991` to numbers, preserving the existing
   small-ID contract; keep larger valid IDs as exact strings.
3. Validate the complete selected list before the first UPDATE or insertion.
   Reject invalid IDs with a fixed contract error, without logging their values.
   Do not silently filter invalid locked predecessors out.
4. Preserve order and use the same exact list for every existing `bigint[]`
   binding, the insertion callback, forward metadata and the returned list.

Native JavaScript BigInt values, unsafe numeric values, zero/negative IDs,
whitespace, leading zeros, exponent/decimal forms and out-of-range strings remain
outside the existing canonical validator's contract. A rounded number cannot be
repaired by converting it to text afterward.

Inside this active transaction, validate the fresh insertion result with the same
canonical predicate before writing the reverse link or returning. Preserve the
valid raw callback value and its type, rather than projecting or coercing it.
An invalid result fails while the transaction can still roll back its writes.
The production callback already returns the parser's safe-number/large-string
shape. This does not guarantee rollback of work a callback performs outside its
supplied transaction.

Keep the completed/nonpending, missing-identity and no-transaction bypasses
unchanged. Adding validation after an independently committed insertion would
create a different failure boundary and is not part of this batch.

## Prospective linkage serialization

The insertion callback already serializes
`pending_decision_lifecycle.supersedes_classification_ids` using JSON.stringify.
Exact large predecessor strings will therefore survive ordinary JSON parsing.

For the reverse `superseded_by_classification_id` link, bind
`JSON.stringify(classificationId)` as `$3::jsonb` inside the existing
`jsonb_build_object`, instead of coercing that argument to a BIGINT JSON number.
Small production IDs remain JSON numbers; large IDs become exact JSON strings.
Valid custom callback strings retain their existing returned type and will also
be strings in this new backlink. Assert both directions after ordinary JSONB
readback, not only through SQL text extraction.

This changes only new lifecycle metadata. Existing rows, including numeric
backlinks, remain unchanged. No production reader of these two linkage fields was
found in the current repository trace. There is no schema, identity-version,
current-review-frame or portable-backup change.

Preserve the existing state transition that replaces a current row's lifecycle
object when it is later superseded. Its earlier forward-link array does not remain
in that object forever. Verify forward links at insertion/current state and exact
reverse links after supersession, without introducing a new history ledger.

## Existing execution and safety boundaries

Keep identity advisory locking, History `FOR UPDATE`, update order, notification
read semantics, INSERT callback, transaction isolation and write limits. Retain
History rows and the partial unique active-identity invariant. Keep the existing
notification creation row lock and late-notification protection.

No HTTP or provider operation is added to the transaction. Keep parameters bound;
only the reverse-link argument changes from a BIGINT JSON number to a validated
JSON scalar. Scoring, candidate selection, routing/learning permission, saved
review evidence, scheduling, retry budgets and operator actions remain unchanged.
No new timeout, automatic retry, recovery claim, CLI trigger or UI is added.

An ordinary repeated `persist` is a new replacement, not an idempotent replay.
Preserve that behavior. A rejected or lost COMMIT acknowledgement remains unknown:
do not issue another INSERT, infer rollback, or add receipt recovery to this
service. Existing completed operator-answer receipt recovery remains independent.
Preserve genuine failures and existing caller handling.

## Explicitly separate gaps

This is not universal BIGINT support across the platform. The trace found other
existing limitations that this repair must neither silently change nor claim to fix:

- Intake receipts have INTEGER schema/casts and number-only ID validation.
- Queue witnesses reject IDs above the safe-number range.
- Discord pending button construction converts classification IDs through Number.
- Retry artifact cleanup has an INTEGER notification-ID cast.
- The lifecycle notification predicate permits digit-only strings outside BIGINT
  range before casting them. An unrelated malformed unread notification can abort
  replacement. This is separate from valid row-ID precision.

The malformed-notification diagnostic reproduces `22003` and rollback before the
insertion callback. Keep that predicate unchanged in this first batch and scope a
later safe-conversion correction, including the treatment of existing leading-zero
forms. Ordinary AND predicate ordering is not a dependable cast guard. Do not
silently replace numeric comparison with canonical-text equality.

Promise exact prospective lifecycle linkage for valid database/notification IDs,
not working large-ID intake receipts, Discord actions, malformed-data cleanup or
end-to-end classification recovery. There is no historical repair or live write.

## Verification and delivery

After confirmation, add regression tests against the old implementation before
applying the fix. Unit tests should verify exact SQL bindings and callback values
for safe IDs, maximum safe integer, both adjacent unsafe strings, mixed lists and
PostgreSQL maximum. Invalid predecessor lists must fail before mutation/insertion;
invalid fresh callback IDs must fail before backlink/commit. Preserve bypasses and
all valid callback result types. Keep supported small-ID behavior explicit.

Use the production database factory with isolated PostgreSQL for:

- Large predecessors and successors, both awaiting-decision and retry states,
  exact forward/reverse JSON links and one active identity.
- Adjacent unrelated History/notification rows, numeric/string notification forms,
  unchanged existing read_at values and late-notification serialization.
- Concurrent replacement chains and existing identity-first provider-recovery
  lock order, with no invented insertion replay/deduplication.
- Rollback after callback or backlink failure, invalid callback result, and actual
  commit followed by delayed/lost acknowledgement. Keep the committed rows exact
  when acknowledgement is uncertain and make no replay attempt.
- Real persistence-callback metadata, current-review row binding and existing
  completed-answer replay controls, without implying global large-ID UI support.

Run fresh backend coverage, appropriate HTTP/review/browser controls and normal
quality/security gates. Reuse client evidence only after verifying unchanged
relevant sources, installed graph and report hashes. Preserve scanner policy,
ownership review rules, assertions, deadlines and skips. Maintain local artifacts,
write a separate observed outcome and Unreleased note, then commit/push intended
changes on main and inspect that commit's own CI. No release or deployment.

No open PR was available at intake. Recheck before delivery; do not reuse closed
PRs or rebase fresh/unrelated branches. No dependency update is proposed here.

## Official research and application inference

Sources were discovered/opened through MCP on November 14, 2026 local time:

- [PostgreSQL 18 numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
  specifies the exact BIGINT range. Application inference: validate classification
  row identifiers within that range before using them in lifecycle writes.
- [node-postgres data-type documentation](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/types.mdx)
  describes string handling and ordinary JSON.parse/JSON.stringify conversion.
  Application inference: an exact database value can still lose precision in a
  JavaScript JSON read; use validated JSON string scalars for large new backlinks.
- [RFC 8259 section 6](https://www.rfc-editor.org/rfc/rfc8259.html)
  describes interoperable integer precision around the binary64 safe range.
  Application inference: do not use unbounded JavaScript numbers for row identity.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  recommends structural metadata. Here the applicable practice is documenting the
  existing numeric/string representation and its boundaries. This internal repair
  adds no public schema or UI and makes no accessibility-conformance claim.

GPT-6 Astra reviewed the code and consumer trace and supports the narrow lifecycle
scope, including prospective backlink serialization. Its review is independent
source analysis; the isolated execution evidence is recorded separately.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep Number coercion | No change | Wrong predecessor targeting and replacement refusal for large IDs |
| Make all platform IDs strings | Uniform representation | Broad receipt/API/consumer compatibility and schema work |
| Exact lifecycle IDs plus JSON scalar backlinks | Fixes both local precision boundaries with the existing validator | Prospective mixed types; separate downstream limits remain |
| Fix only predecessor bindings | Smallest literal patch | Leaves the reverse-link JSON readback defect |

Recommend the third option: canonical validation, compatible predecessor projection,
complete-list admission, unchanged identity-first locking, valid fresh callback
result, exact forward/backward metadata, existing atomic replacement and honest
unknown-commit handling. Then address malformed notification conversion separately.

## UUIDv7 consideration

The user asked during validation whether UUIDv7 would improve this situation.
It would avoid this numeric-precision failure if UUID values stay UUID/string
values across SQL, JavaScript and JSON. That benefit does not require replacing
existing BIGINT keys: the current repair preserves their exact values too.

[PostgreSQL 18 UUID documentation](https://www.postgresql.org/docs/18/datatype-uuid.html)
describes its 128-bit UUID type and native UUIDv7 generation. Time-ordered UUIDs
support independent ID generation; they do not inherently improve this workflow
over its current sequential BIGINT keys. A UUID uses a larger identifier than an
eight-byte BIGINT. Application inference: benchmark an actual workload before
claiming an index/throughput improvement.

[RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html) defines UUIDv7's timestamp
structure and warns against treating UUID possession as authorization. Its time
ordering must not replace database locking, commit evidence or replay authority.
An embedded timestamp is observable; a UUID is not an access secret.

| Strategy | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep BIGINT with lossless boundaries | Repairs the demonstrated bug with existing schema and references | Remaining numeric coercion boundaries still need review |
| Migrate current keys to UUIDv7 | Independently generated IDs without numeric JSON precision loss | PK/FK, receipt, API, notification and historical-reference migration; larger identifiers |
| Use UUIDv7 for separately justified new identities | Can support future cross-installation or public-ID requirements | Requires its own compatibility/privacy/authorization design |

For Classifarr, replacing values with UUIDs while retaining Number conversions
would produce invalid IDs. UUIDv7 also does not independently fix notification
cast failures, uncertain commits or idempotency. Astra independently reviewed this
comparison and supports finishing the approved repair, then auditing the remaining
ID boundaries. Consider UUIDv7 separately when independent generation or a public
identity boundary is an actual requirement. Do not add a second ID system solely
for this defect; no UUID migration or schema change is part of this batch.
