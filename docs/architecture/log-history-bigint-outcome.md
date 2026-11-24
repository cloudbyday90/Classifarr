# Exact History IDs in application logs outcome

November 23, 2026. See the [design and source review](log-history-bigint-design.md).

The administrator log list and export can filter by exact positive History
IDs through `9223372036854775807`. Both query aliases still work. Invalid,
repeated, or conflicting values now return `400` before the log query. Callers
that supplied padded or partial IDs must send canonical decimal text.

The shared SQL expression keeps the native column authoritative and reads
legacy metadata as text when needed. It strips leading zeros from saved values
and compares them with the bound filter using the `C` collation. A list row
uses a number for a safe ID, a decimal string for a larger ID, and `null` for
an unusable ID. Export still returns its existing raw rows, including their
existing legacy JSON metadata decoding. Recovering previously rounded data
would require an independent source for the original ID.

## Verification

- The new PostgreSQL 18/HTTP fixture returned `500` on the original
  unfiltered list. It passed after the repair. The fixture verifies the
  integer boundary, the safe-integer boundary, adjacent large IDs, the BIGINT
  maximum, native precedence, legacy padding, and malformed stored metadata.
  It also checks exact pagination counts and raw export shape.
- The focused server and client tests verified pre-query request refusal,
  administrator middleware ordering, and exact forwarding through the client
  API adapter. The client production build passed.
- The ownership gate flagged the changed router source. The inventory showed
  the same analysis digest, no protected write candidates, and the same
  indirect-query limitation. The review refresh updates only the router hash.
- All 22 targeted PostgreSQL integration tests and 7,721 client tests passed.
  The coverage ratchet passed with 89.32% server and 89.58% client line
  coverage. Lint, type checks, preflight, ESM checks, and the policy gates
  passed. npm audits reported zero advisories across all three workspaces.
- The server coverage rerun passed 1,957 suites. One Discord fixture did not
  complete during concurrent coverage runs. Its isolated rerun passed all
  eight tests using the existing deadlines and assertions. The server run
  retained one existing skip.

GitHub listed no open PRs at intake or before delivery.

## Next UUIDv7 readiness item

Qualify the RAG stage-log producer. It currently accepts integer numbers and
drops exact decimal strings. Trace the callers that supply History IDs, then
test adjacent large IDs and invalid input through persistence and retrieval.
The [UUIDv7 assessment](classification-uuidv7-readiness-outcome.md) describes
the separate requirements for a public identifier or primary-key migration.
