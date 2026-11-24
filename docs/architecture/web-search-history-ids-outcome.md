# Exact History IDs in web-search diagnostics outcome

November 23, 2026. See the [design and source review](web-search-history-ids-design.md).

Route decisions and provider-health events now use the shared BIGINT
normalizer before the database bind and on readback. The existing admin
diagnostics response keeps `classificationId` as a number for a safe ID, a
decimal string for a larger ID, or `null` for an unlinked event. The settings
adapter passes the values through unchanged.

The existing columns, provider selection, quota accounting, and outcome-feedback
SQL are retained. New exact route links let the existing feedback query join
and count adjacent History rows separately. Historical records retain their
stored links. Recovering a previously rounded link would require independent
evidence for its original ID.

## Verification

- The PostgreSQL 18 regression reproduced the collision in the original route
  records and refusal at the BIGINT limit. The patched test preserves adjacent
  IDs in both diagnostic tables and the authenticated admin response. It also
  verifies one positive and one negative outcome from the two separate links.
- The 10 PostgreSQL checks cover the BIGINT maximum, safe numbers and strings,
  malformed, out-of-range and missing IDs, and the existing admin access gate.
  The settings test uses the production handler and authentication middleware
  with a fixture candidate source.
- The focused server and client suites passed 67 and 49 tests, respectively.
  The client test verifies that the adapter preserves both large decimal strings.
- The full runs passed 64,575 server tests and 7,721 client tests, with one
  existing server skip. The coverage ratchet passed with 89.33% server and
  89.58% client line coverage. The client build, lint, type checks, preflight,
  ESM and policy gates passed. npm audits reported zero advisories in all
  three workspaces.

GitHub listed no open PRs at intake or before delivery.

## Next UUIDv7 readiness item

Audit the History IDs encoded in policy-library evidence keys. The pending
answer, outcome, and routing-outcome collectors currently convert History IDs
to numbers before constructing those keys. Adjacent IDs can therefore collide.
Check persisted key compatibility and replay before changing those collectors.
