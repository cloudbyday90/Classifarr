# pgvector recall audit History ID outcome

Administrators can now target exact History IDs through PostgreSQL's
positive BIGINT maximum. `classification_id` and `classificationId`
accept canonical IDs and must agree when both are supplied. The audit
rejects malformed, repeated or bracketed selectors with 400 before reading
embeddings. Omitted or empty selectors still sample recent eligible rows.
A valid target without an eligible embedding returns 404. Safe IDs remain
numeric in the response, and larger IDs use exact decimal text.
See the [design and tradeoffs](pgvector-recall-audit-history-id-design.md).

## Verification

A baseline probe showed valid large selectors rejected before SQL and
conflicting aliases silently selecting the snake-case value. Ten new unit
cases failed before the fix. At the HTTP boundary, the baseline returned
400 for a valid large target and incorrectly accepted bracketed or
conflicting selectors. The first integration fixture assumed the snapshot's
vector width. Reading the isolated database's actual column dimension
made the fixture valid for the integration schema as well.

After the change, 40 focused unit tests and all 49 isolated PostgreSQL
RAG tests passed. The authenticated tests verified 401 for a missing
token, 403 for a regular user, and exact targeting and neighbor IDs for
adjacent rows, a safe numeric ID, and the BIGINT maximum. They exercised
real pgvector queries in both approximate and exact modes. Astra reviewed
the scope, alias validation, and integration coverage.

Fresh backend coverage passed with 64,886 tests, one existing skip, and
89.34% statement coverage. The client inputs and coverage report hash
matched the prior passing run of 7,750 tests at 87.84% statement coverage.
The coverage ratchet, preflight, type checks, lint, migration integrity,
and ESM checks passed. The root, server and client runtime dependency
audits reported zero known vulnerabilities.

## Follow-up

Preserve exact BIGINT record IDs in web-search provider health and route
history. Both projections currently convert their record IDs to JavaScript
numbers, and the health view uses that ID as its Vue row key. Validate
neighboring large events through PostgreSQL, the API, and client row keys.
