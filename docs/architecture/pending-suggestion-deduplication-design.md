# Pending suggestion deduplication design

## Problem and decision

The [eligibility assessment](feedback-analysis-eligibility-outcome.md) reproduced
duplicate pending patterns from two analysis branches. The store compares JSONB
rendered as text with `JSON.stringify` output. Equivalent objects can differ in
whitespace and key order. Its separate check and insert also race across workers.

Use structural JSONB equality for the existing identity: policy ID, suggestion type
and the complete resolved configuration, restricted to pending status. Serialize
storage for each policy with a PostgreSQL row lock in one explicit Read Committed
transaction. The audited production insertion path is
`feedbackAnalysisSuggestionStore.mjs`; every future insertion path must use this
service or acquire the same policy lock before checking for duplicates.

## Architecture and behavior

Extract configuration resolution into a small pure ESM module. Preserve the existing
threshold/weight calculations and defaults, but return a copied configuration instead
of mutating caller objects. Store the whole batch on one transaction client:

1. Set Read Committed explicitly before querying, even if the connection has a
   different default isolation level.
2. Read the policy and acquire `FOR NO KEY UPDATE`. This serializes competing stores
   and policy changes without blocking ordinary foreign-key checks on the policy.
3. Resolve each configuration from the locked policy values.
4. Check pending rows using `suggestion_config = $3::jsonb`. The separate statement
   sees prior commits after any lock wait and inserts earlier in the same batch.
5. Skip duplicates and return only newly inserted rows. Commit the complete batch;
   failure rolls it back and releases the lock through the existing transaction helper.

No provider/network calls occur inside the transaction. All identity/configuration
values remain bound parameters. Existing database statement timeouts still apply.
Different policies do not share a serialization lock. A changed configuration or
type remains distinct; applied/rejected history does not block a new pending record.
Supporting IDs, confidence and impact text outside the configuration do not change
identity, matching the original intended contract. The first pending record retains
its provenance; duplicate submissions do not overwrite or combine evidence.

Existing duplicate rows remain untouched and visible as history/pending records.
This prevents new duplicates through the service; it is not a database-wide unique
constraint against arbitrary SQL writers or older application instances. Deploy
updated writers together. There is no migration, new dependency, API change or new
operator workflow. Existing suggestion approval, eligibility and write authority
remain separate responsibilities.

## Official research and alternatives

Official URLs were discovered using web search and read on 6 September 2026. These
established semantics support the August 2026 baseline; living documentation is not
an archived August snapshot.

- [PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html)
  describe JSONB normalization and complete-document equality. Database equality
  handles object key order and numerically equal JSON numbers; array order and
  missing-versus-null members remain meaningful.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  explains statement snapshots in Read Committed. A check after lock acquisition
  sees a preceding writer's committed suggestion; a fixed older snapshot is unsuitable.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  documents row-lock conflicts and transaction lifetime. `FOR NO KEY UPDATE` conflicts
  with another such lock while allowing key-share locks used by foreign-key checks.
- [PostgreSQL index creation](https://www.postgresql.org/docs/18/sql-createindex.html)
  supports partial uniqueness but notes index-entry size limits. A unique index over
  unrestricted configuration JSONB could reject large metadata-derived values and
  cannot be installed over current duplicates without a history transition.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) provides generation, derivation and
  invalidation concepts. Preserving original records and their evidence rather than
  silently rewriting duplicate history is an application policy informed by these
  concepts; no RDF or W3C conformance claim is made.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| JSONB equality alone | Correct structural comparison | Check/insert still races | Insufficient |
| In-process mutex | Simple within one process | Does not coordinate replicas | Reject |
| Per-policy database lock plus JSONB equality | Coordinates workers; supports large configurations; preserves history | Same-policy writes wait; future writers must follow the contract | Implement |
| Partial unique index on full JSONB | Database-wide enforcement | Existing duplicates and large index keys require migration policy | Defer |
| Unique digest of JSON text | Small index keys | Text/numeric representations and hash collisions need a separate identity design | Reject for this fix |

Recommended stack: eligible evidence → pure configuration resolution from locked
policy values → per-policy transaction serialization → structural pending comparison
→ atomic batch storage → existing approval and policy write authority.

## Validation and follow-up

Use real PostgreSQL for reordered nested keys, numeric representations, distinct
arrays/null members, separate types/policies, repeated runs, large configurations,
concurrent connections, transactions starting at Repeatable Read, rollback and preservation
of existing duplicates/history. Test configuration immutability and all calculation
branches separately. Strengthen the previously permissive duplicate integration test.

Next, enforce a single pending-to-applied/rejected transition. Static review found
that application does not check pending status and rejection updates any matching ID.
Test repeated application and concurrent apply/reject under a consistent lock order.
Then record full cohort provenance and revalidate evidence when applying suggestions;
threshold and weight suggestions currently have empty supporting-ID arrays.
The separate [outcome](pending-suggestion-deduplication-outcome.md) records measurements
and remaining limits.
