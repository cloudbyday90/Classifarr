# Exact History IDs in RAG stage logs outcome

November 23, 2026. See the [design and source review](rag-stage-history-id-design.md).

The RAG stage logger now preserves the exact History ID passed by the
classification producer. The native INSERT binds the normalized ID to the
existing BIGINT column. If an existing schema-compatibility error selects the
fallback INSERT, it places the same value in `metadata.classificationId` so
the administrator log list and export can find the event.

Safe IDs are numeric and large IDs are decimal strings. Unusable values leave
the event unlinked. The snake-case field takes priority when valid, and the
camel-case field can supply a valid ID when the first is unusable. The change
preserves existing suppression, severity, fingerprints, metrics, and error
handling. An ordinary range error still follows the existing failure path.
The RAG-specific recent-errors query uses the native columns as before.

## Verification

- The original writer failed both new PostgreSQL 18 regressions. The current
  schema lost a large ID supplied by the real stage producer. The temporary
  older-schema table produced PostgreSQL error `42703` on the normal INSERT,
  and the fallback row could not be found by its exact History ID.
- The focused tests cover safe and large IDs, both aliases, invalid input,
  exact fallback JSON, ordinary write refusal, and deduplication across IDs.
  The normal path continues to keep the ID in the typed column alone.
- The patch passed 97 focused tests and 24 PostgreSQL integration tests. The
  PostgreSQL checks exercised the native recent-errors reader, exact list and
  export filters for adjacent large IDs, and retrieval from the fallback row.
- The ownership report kept the same analysis digest and indirect-query
  limitation for the logger. The ownership review updates only its source hash.
- The full server run passed 1,958 suites and 64,574 tests, with one existing
  skip. The coverage ratchet passed with 89.33% server and 89.58% client line
  coverage. The client tree and existing coverage report matched the previous
  tested revision. Lint, type checks, preflight, ESM and policy gates passed,
  and npm audits reported zero advisories across all three workspaces.

GitHub listed no open PRs at intake or before delivery.

## Next UUIDv7 readiness item

Audit the web-search provider diagnostic History paths. Both
`webSearchProviderHealthHistory.mjs` and `webSearchProviderRouteHistory.mjs`
coerce IDs before the INSERT and again when returning a row. Trace the input
sources and the settings diagnostics response so the next repair can preserve
the ID through both boundaries. The
[UUIDv7 assessment](classification-uuidv7-readiness-outcome.md) covers the
separate requirements for a public identifier or primary-key migration.
