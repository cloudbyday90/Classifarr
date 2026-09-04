# Source-library history media identity outcome

Date: 4 September 2026. The separate
[design document](source-history-media-identity-design.md) records official
research, alternatives, tradeoffs, and the recommendation stack. It uses an
August 2026 practice baseline, verified on 4 September; living sources are
not presented as exact archived August snapshots.

## Delivered behavior

Source-library history now uses the same validated identity for duplicate
lookup and insertion. Known TMDb items are scoped by media type, numeric ID,
and library. Without a TMDb ID, the existing exact-title fallback is scoped
by media type and library and only matches rows whose TMDb ID is null.

`mediaIdentityValues.mjs` shares movie/TV canonicalization and positive
PostgreSQL integer validation with history scoring. A dedicated source-history
contract accepts explicit nested or top-level media type, requires agreement
when both are present, and rejects missing/invalid/conflicting declarations.
Only null or undefined TMDb IDs enter title fallback; malformed supplied IDs
are rejected. Title validation requires nonblank text within the storage bound.

The queue service captures its own JSON payload and all insert parameters
before asynchronous database checks. Mutating the caller's title, type, year,
or graph arrays during those checks cannot change the captured history record.
Direct insertion also validates identity. SQL values remain parameterized,
and skip diagnostics contain fixed reasons without raw titles or identifiers.

Valid records retain their existing completed status, confidence of 100,
source-library method/reason, metadata, and graph fields. The production
`persist` call signature is preserved. No schema migration, new dependency,
API/UI change, historical rewrite, release, or version bump is included.

## Executed validation

- Targeted unit tests: 3 suites and 99 tests passed, including the queue
  processor, typed scoring, and source-history service.
- PostgreSQL integration: 3 suites and 46 tests passed, including the policy
  engine and both history identity regressions.
- The source-history SQL fixture also passed in the existing local Compose
  container. It preserved three known-ID rows and three null-ID rows across
  movie/TV types and two libraries, suppressed repeat identities, rejected six
  invalid/unavailable cases, and retained graph metadata.
- SQL regressions cover unrelated history methods, known-ID versus null-ID
  separation, and a literal SQL-looking title passed as a bound parameter.
  Fixture writes use connection-local temporary tables and roll back; they
  do not insert, update, or delete real library/history records.
- Unit regressions cover missing/invalid/conflicting type declarations,
  malformed and out-of-range IDs, blank/oversized titles, direct insertion,
  canonicalization, bounded diagnostics, and caller mutation during an await.
- The full backend unit suite passed: 1,041 suites and 28,862 tests.
- Backend lint, server/client type checks, ESM static-import and mock-shape
  gates, Markdown lint across 969 files, and `git diff --check` passed.

The first integration run exposed an incorrect fixture expectation that genres
were lowercased. The existing extractor preserves genre casing, so the fixture
was corrected to verify that established behavior. Both PostgreSQL runs passed
after that correction.

## Repository and PR handling

At the user's request, the previous history-scoring commit `44d9a85f` was
first fast-forwarded into local `main` and pushed to `origin/main`. This
source-history fix was developed from that commit on
`fix/source-history-media-identity`.

The GitHub MCP pull-request endpoint again returned an empty array for
`cloudbyday90/Classifarr` with `state=open&per_page=100` on 4 September 2026.
There was no eligible open PR to select randomly or implement locally.

## Recommendation and next item

Retain this stack: shared identity primitives, a focused source-history
contract, captured input with parameterized query builders, and the existing
queue service. Its benefits are consistent identity, testability, and no data
migration. Its cost is that malformed legacy payloads stop contributing source
history until their producer supplies a valid explicit type. W3C identification,
quality, and provenance principles support the design; they do not prescribe
this database schema. Official sources and the alternatives table are in the
[design document](source-history-media-identity-design.md#official-guidance).

The next recommended fix is the producer-to-enrichment identity contract.
Review found that `queueRefillService.mjs` selects library media type and defaults
missing type to `movie`, while `queueTmdbResolutionService.mjs` and
`queueOmdbEnrichmentService.mjs` also default provider lookups to movies.
Persistence cannot detect an upstream guess already encoded as an explicit
type. Carry authoritative item type from the source record, validate it before
provider lookup or ID backfill, and add end-to-end tests for missing, conflicting,
and top-level/nested declarations. Preserve existing queued/history data unless
there is independent evidence to correct it. This issue should precede further
semantic study work because it affects the reliability of reference evidence.

After that, address atomic source-history deduplication. The existence check
and insert remain separate operations: two workers can both observe no match
and insert duplicates. Compare a suitable uniqueness constraint with
transaction-level locking, inventory existing duplicates without modifying
them, and prove simultaneous submissions with two database connections. A
constraint can cover every writer but needs a historical-data strategy;
coordinated locks avoid immediate cleanup but depend on every writer using
the same locking contract. Decide that separately before implementation.

The existing exact-title fallback can conflate same-title remakes without
TMDb IDs; media-type isolation does not solve that identity limitation. No
claim is made that the local inventory already contains incorrectly typed
records, or that this change measures semantic accuracy. The held-out semantic
study still needs an eligible prospective cohort and independent human labels
before readiness and frozen-study preflight can justify a review-only
counter-evidence feature. Automatic semantic routing remains out of scope.
