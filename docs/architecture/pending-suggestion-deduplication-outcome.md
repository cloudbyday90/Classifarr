# Pending suggestion deduplication outcome

## Implemented behavior

The [eligibility follow-up](feedback-analysis-eligibility-outcome.md) is implemented
in the production suggestion store. PostgreSQL JSONB equality now compares the
complete resolved configuration within the existing policy/type/pending identity.
Object key ordering, whitespace and equivalent numeric scale do not create additional
suggestions. Different configurations, array order, missing/null members, types and
policies remain distinct.

One explicit Read Committed transaction acquires a `FOR NO KEY UPDATE` lock on the
policy before checking and inserting the batch. Competing stores for the same policy
wait, then read the preceding writer's committed records. Separate policies can
continue independently. Every statement uses the transaction client, and failures
roll back all earlier inserts in the batch. Database timeouts remain in effect.

A pure ESM configuration module preserves existing threshold/weight calculations
without mutating caller objects. Non-object configurations fail validation. Only new
records are returned; duplicate submissions do not alter existing evidence, confidence
or impact text. Applied/rejected history does not block a new pending suggestion.
Existing duplicates remain intact; this fix prevents additional duplicates through
the audited production insertion service.

No API changes, migrations, dependencies, provider calls, new operator steps or
automatic routing were introduced. Existing eligibility, approval and policy write
authority remain separate from deduplication. The transaction contract applies to
updated service writers; it is not a database-wide uniqueness constraint for arbitrary
SQL or older application instances. Updated writers should be deployed together.

## Validation and local evidence

The targeted unit and code-health run passed **20,684 checks across seven suites** in
20.878 seconds. The changed configuration and storage modules have 100% statements,
branches, functions and lines in the scoped coverage report. These are not repository
coverage figures. The separate report is retained under ignored `.tmp/`.

Docker-backed PostgreSQL integration passed **42 tests across three suites** in
6.717 seconds, including eleven new cases and existing feedback-analysis/eligibility
regressions. The new cases verify:

- Nested reordered keys, repeated submissions and numeric scale produce one pending
  record. Later submissions cannot overwrite the original supporting IDs or metadata.
- Distinct arrays, null/missing members, configurations, types and policies remain
  distinct. Large metadata-derived configurations work without a full-JSON index.
- Applied/rejected history and previously stored duplicates remain unchanged.
- An insertion failure after an earlier successful insert rolls back the entire batch;
  a later call succeeds, demonstrating lock release. Missing policies cannot create
  orphan suggestions.
- Three separate service transactions, initially set to Repeatable Read, are observed
  waiting on actual PostgreSQL locks. After releasing the blocker, their returned
  record counts are **0, 0 and 1**, and exactly one pending row exists. A different
  policy is writable while those three wait. The service explicitly selects the
  required Read Committed isolation level before reading.
- A policy update committed around storage is reflected in resolved threshold values,
  while the input suggestion remains unchanged.

The earlier duplicate regression now requires zero records from the second call.
The genuine-correction eligibility fixture now requires exactly one pattern and one
threshold suggestion, replacing the previously observed duplicate pattern. The first
new integration run had a fixture setup failure because the schema permits one policy
per library; separate library fixtures corrected it without changing production code.

Local Compose PostgreSQL **18.6** was inspected in a repeatable-read, read-only
transaction at **2026-09-06 20:06:29 UTC**. It contained zero suggestions, pending rows
or duplicate groups. A bound-parameter comparison returned structural equality true
and the old textual comparison false for equivalent configurations. The inspection
took 145.032 ms, with zero production writes, provider requests or individual records
returned. This confirms the comparison defect on the local engine; it is not a
populated workload benchmark or classification accuracy study.

Repository lint, configured backend/frontend type checks, ESM static-import and
strict mock-shape checks, both server Knip checks and Markdown lint passed. A local
production image, `classifarr:suggestion-dedup-local`, was built from the staged tree,
excluding ignored private captures; it was not deployed or published. Full backend
and frontend suites and repository coverage were not regenerated; no baseline changed.

## Recommendations and tradeoffs

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Compare full JSONB configurations | Correct structural identity without application canonicalization | Config changes intentionally remain distinct |
| Serialize storage per policy in Read Committed | Coordinates workers and makes batches atomic | Same-policy calls wait; every writer must follow the protocol |
| Resolve configurations without input mutation | Reusable, predictable service inputs | Adds a small module |
| Preserve original records and evidence | Retains provenance and avoids silent history rewrites | Existing duplicates are not consolidated |
| Defer a unique full-JSON index | No migration or large-key insertion restriction | Arbitrary SQL writers are outside this service guarantee |

Recommended stack: eligible evidence → pure configuration resolution from locked
policy values → per-policy transaction serialization → structural pending comparison
→ atomic batch storage → existing approval and policy write authority. Official
PostgreSQL/W3C sources, alternatives and the August-baseline research limitation are
in the separate [design](pending-suggestion-deduplication-design.md).

## Next item

**Guard suggestion lifecycle transitions before applying or rejecting.** Static review
of `feedbackAnalysisSuggestionApply.mjs` found no pending-status check before apply,
and rejection updates any matching ID. Deduplicating creation does not prevent repeat
application or competing apply/reject requests. Establish one lock order and an atomic
pending-to-applied/rejected transition, preserving policy authority and audit history.
Test repeat requests, rejected/applied inputs and concurrent transitions.

Then add complete cohort provenance and evidence revalidation at application time.
Threshold and weight suggestions currently have empty supporting-ID arrays, and
eligibility may change after creation. Existing-history consolidation also needs an
explicit provenance-preserving policy; this change does not silently choose or delete
old records.

GitHub MCP returned no open PRs on 6 September 2026, so none was available for random
selection or local implementation. No external PR was merged and no release was created.
