# Exact intent IDs in the bulk native policy reader outcome

The five bulk child lookups bind BIGINT intent ID arrays. The reader
still uses one policy-scoped header query and five child queries. The
same authority checks, ordering, latest-row selection, and grouping
apply. See the [design and tradeoffs](native-policy-bulk-intent-bigint-design.md).

## Verification

Both new isolated PostgreSQL tests failed on the original query with
an out-of-range error at `2147483648`. One test calls the bulk reader
and the other uses the policy engine's normal active-policy lookup.
The isolated production database adapter probe reproduced the same
failure at both adjacent large IDs and the BIGINT maximum. After the
change, bulk and single-policy reads returned the same exact IDs.

The six-query regression batches a small ID, the first ID above
INTEGER, the adjacent IDs `9007199254740992` and
`9007199254740993`, and `9223372036854775807`. It checks the
stored rules, templates, latest validation, latest routing target,
and linked observed evidence for each intent. The runtime test
verifies native authority and the matching policy contract for
each row.

The fixture establishes native policies through the production
service. Its newer validation record is dated relative to the
stored record, since the original fixture timestamp could put it
before PostgreSQL's validation timestamp. All 69 focused PostgreSQL
tests and 34 focused service tests passed. Astra's review found the
existing query count and selection semantics preserved.

Fresh backend coverage passed with 64,923 tests, one existing skip,
and 89.34% statement coverage. Unchanged client inputs and a matching
report hash verified 7,751 client tests and 87.84% statement coverage.
Preflight, policy checks, type checks, lint, migration integrity, ESM
checks, and the coverage ratchet passed. All three runtime dependency
audits reported zero known vulnerabilities.

## Follow-up

Preserve the generated replacement intent ID from the header insert
through rules, routing, validation, the migration event, and the
execution gate. Verify the saved intent link before commit, replay
the exact receipt, and check that the policy engine loads the
committed replacement. The original intent's acceptance and
verification path has a separate identity boundary.
