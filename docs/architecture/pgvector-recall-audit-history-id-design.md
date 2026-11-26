# Exact History IDs in pgvector recall audits

## Decision

The administrator recall audit in `GET /api/rag/retrieval/recall-audit`
can select one History row or sample recent embeddings. The query uses a
parameter bound to `classification_embeddings.classification_id`, a BIGINT
foreign key. The shared counter parser currently rejects IDs above the
JavaScript safe integer range before the query can run. A read-only probe
confirmed this for `9007199254740993` and `9223372036854775807`. It also
confirmed that two different aliases silently select the snake-case value.

Use the shared exact BIGINT validator for this selector. Accept one
canonical positive ID per spelling, through `9223372036854775807`.
Both `classification_id` and `classificationId` can be supplied when they
agree. Repeated, bracketed, malformed or conflicting selectors return 400
before the service reads any audit data. An omitted or explicitly empty
selector requests a sample. A direct service caller may still use null for
an omitted selector. An empty string paired with an explicit ID is a
conflict. Whitespace-padded IDs now receive 400.

Keep safe IDs numeric in JSON and larger IDs as exact decimal strings.
An eligible targeted request still samples one source. A valid selector
with no eligible embedding still returns 404. The existing administrator
middleware, limits of 10 samples and 25 neighbors, transaction settings,
projection and recall calculations continue to apply. There is no existing
browser caller for this endpoint.

## Research and tradeoffs

PostgreSQL BIGINT includes exact values beyond the interoperable numeric
range described in RFC 8259. W3C recommends machine-readable standard
formats and locale-neutral representations. For this JSON contract, safe
numbers and canonical decimal text preserve existing clients and exactness.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

Express treats query parameters as untrusted. Its simple parser retains
bracketed parameter names literally and produces arrays for repeated names.
Validate each supported spelling before selecting a target. Keep the current
bound SQL parameter and pgvector's transaction-local exact comparison.
[Express request API](https://expressjs.com/en/5x/api/request/) ·
[Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/) ·
[OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) ·
[pgvector recall monitoring](https://github.com/pgvector/pgvector#monitoring)

| Option | Benefit | Cost |
| --- | --- | --- |
| Exact selector with compatible JSON types | Handles the full database range and retains ordinary numeric responses | Consumers handle numbers and decimal strings |
| Extend the generic counter parser | Reuses a single entry point | Conflates identities and bounded work sizes, and numeric conversion can lose precision |
| Use strings for every ID | Gives clients one type | Changes existing safe-ID response types |
| Keep alias precedence | Retains the current precedence rule | Can silently run an audit against a different History row than requested |

Use strict alias admission, the shared BIGINT normalizer, the existing
parameterized comparison, and the existing read-only audit limits.

## Verification

Test malformed and ambiguous inputs before database access. Exercise
adjacent large IDs and the BIGINT maximum through the authenticated HTTP
route and real PostgreSQL embeddings. Check exact and approximate neighbor
IDs, safe numeric responses, 404 and sampling behavior, and administrator
authorization. Run affected and repository quality gates.
