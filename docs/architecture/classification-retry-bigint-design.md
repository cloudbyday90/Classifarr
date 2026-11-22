# Exact History IDs for classification retry design

November 22, 2026 Eastern. Approved follow-up to the
[reclassification BIGINT outcome](reclassification-history-bigint-outcome.md)
and [retry target admission design](retry-target-admission-design.md).

## Observed boundaries

Classification History, retry lineage, and retry cleanup foreign keys already
store BIGINT IDs. The ordinary retry route and service still cap `classificationIds`
at `2147483647`. Raising admission alone would cause notification cleanup to
fail when it casts the bound target to `INTEGER`. Command Center bulk retry
also converts the loaded History ID to a JavaScript number, which can round
distinct IDs before sending the request.

The strict retry parser is also used for TMDB and TVDB IDs, request and
webhook record IDs in lineage, and historic route-safety refresh selections.
Those callers have their own limits. Historic refresh creates an actor-bound
receipt before invoking retry. Its inventory, cursor, selection, execution
result handling, receipt writes, reconciliation, and browser readback all
need a consistent representation before its selection range changes. Its
shared answer contract also puts the numeric ID in existing fingerprints.
Astra reviewed the paths and recommends staging the ordinary and historic
changes separately.

## First batch

1. Extend the ordinary retry target to positive canonical BIGINT. Accept safe
   integer numbers or ASCII decimal strings from `1` to `9223372036854775807`.
   Reject unsafe numeric primitives, alternate string spellings, and values
   outside the range. Validate the whole batch before executing any item and
   keep the existing raw batch cap, first occurrence order, and deduplication.
   Batch results keep safe IDs numeric and keep larger IDs as exact strings.
   Direct `retrySingle` retains the valid scalar type the caller supplied.
2. Keep a strict int32 parser for historic selection and lineage's provider
   and reference IDs. Existing historic admission still rejects wider
   requests before receipt creation. Preserve historic identifiers and
   fingerprints, actor-bound reads, and the existing receipt contract.
3. Widen only the trusted bound target in the retry notification DELETE to
   `BIGINT`. Keep both independent JSON keys, exact digit-text matching,
   leading-zero compatibility, and deletion across all read states and types.
   Over-range, malformed, and unrelated JSON values remain data and never
   enter a numeric cast. The rest of the cleanup SQL keeps its current types.
4. Forward loaded History IDs unchanged from Command Center bulk retry
   through the existing API leaf. Single-item retry already does so. A
   malformed ID in a nonempty client batch reaches ordinary whole-batch
   validation and returns the existing error envelope before any retry write.

## Authority and compatibility

The existing admin route and retry service remain the entry points. The
shared service also serves scheduler and provider recovery, so their
eligible large History IDs become admissible. Preserve their existing
status, readiness, configuration and lease checks, budgets, cancellation,
and pending task detection. Keep identity and row lock order, the atomic
cleanup, queue insertion, lineage proof and History update, and the existing
postcommit enrichment follow-up. Provider and request identities keep their
own bounds. Support for a larger ID changes the eligible addressable rows,
with the same requirements for permission and retry authority.

A rejected or lost acknowledgement retains the existing failure envelope,
even when a real commit succeeded. The service makes one transaction attempt.
An existing eligible task or durable outcome remains the basis for subsequent
processing. Keep the existing shapes, no new text echo of invalid IDs, and
the previous distinction between invalid and valid absent IDs. No schema,
new operator action, release, or deployment is required for this batch.

## Research and tradeoffs

Official sources checked November 22, 2026 through the connected search
service. Preserve canonical decimal text at the JSON boundary beyond the
safe integer range while retaining compatible numeric responses. Keep the
resource's identity independent from its wire representation. These are
applications of the standards to this design.
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
[RFC 8785, appendix D](https://www.rfc-editor.org/rfc/rfc8785.html#appendix-D),
[W3C Web Architecture](https://www.w3.org/TR/webarch/)

PostgreSQL can represent the full BIGINT range. Use a bound scalar for the
target and compare notification keys as extracted text. HTTP semantics
support keeping uncertain write replay tied to durable evidence.
[PostgreSQL 18 numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html),
[PostgreSQL 18 JSON operators](https://www.postgresql.org/docs/18/functions-json.html),
[RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

The staged repair covers the ordinary retry lifecycle with a small set of
leaves and existing storage. The cost is retaining the historic command's
32-bit admission until its full reader and writer path is ready. Widening all
surfaces now would close that gap sooner, with a larger change to pagination,
stored receipt projections, and answer compatibility. A UUIDv7 migration
would expand the identity and migration work without addressing the current
numeric conversions by itself.

## Verification and next item

Exercise ordinary HTTP and direct retries at `2147483648`, with adjacent IDs
beyond JavaScript's safe range, and at the PostgreSQL maximum. Check mixed
small number/string deduplication, unsafe input refusal, unrelated neighbor
rows, both notification keys, exact lineage source and replacement links,
whole-batch refusal, and eligible and refused scheduler controls. Use isolated
PostgreSQL to cover concurrency, rollback, and a lost final acknowledgement.
Use existing client contract and browser tests for exact ID forwarding and
existing controls. Verify historic pre-receipt refusal and int32 lineage
identity limits, then run fresh affected coverage and normal quality gates.

Next, trace historic refresh inventory, cursor, receipt projections, and the
bounded lineage read as a single contract. Its existing reader can cast an
oversized persisted replacement ID after checking only that it contains
digits. Keep its behavior and repair separate from ordinary admission.
