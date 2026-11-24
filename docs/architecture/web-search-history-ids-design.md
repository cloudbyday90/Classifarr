# Exact History IDs in web-search diagnostics

Reviewed November 23, 2026.

## Root cause

The web-search route-decision and provider-health writers pass optional
classification History IDs through `Number.parseInt` before PostgreSQL binds
them. Their readers then call `Number` on values returned from BIGINT columns.
These conversions can collapse adjacent valid IDs into one number. A rounded
route ID can attach an outcome to the wrong History row because provider outcome
feedback joins on that stored ID. A rounded value at the top of BIGINT can also
exceed the column range and lose the diagnostic write.

The existing admin diagnostics handler passes both result lists through, and the
Settings view consumes the diagnostics without displaying the History ID. The
usage ledger already passes valid decimal IDs to PostgreSQL. Search and queue
producers that lack an ID can continue omitting the optional association.

## Options

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| Normalize only the admin response | Small read-side change. | Cannot recover an ID rounded before storage or correct the feedback join. |
| Normalize both writers and both readers | Preserves exact new associations and existing numeric values for safe IDs. | Clients must allow a decimal string for a large ID. |
| Use strings for all IDs or migrate to UUIDs | Uniform transport representation or a separately generated identity. | Changes broad contracts, storage or references beyond these optional diagnostic links. |

## Recommendation

1. Reuse the shared positive BIGINT normalizer at the route trace and health
   write boundaries, and again in the two row readers. Bind valid IDs through
   the existing parameterized INSERTs. Invalid or absent values leave the
   diagnostic row unlinked. Keep the existing provider request validation,
   routing, accounting, and outcome-feedback query.
   [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
   · [node-postgres parameterized queries](https://node-postgres.com/features/queries)
2. Document `classificationId` as a safe number, exact decimal string, or
   `null` across the existing admin response and client adapter. Preserve
   the field name, permissions and response envelope. This follows W3C's
   API compatibility guidance while honoring the interoperable JSON integer
   range. Diagnostic row IDs and correlation IDs keep their own contracts.
   [RFC 8259 numeric interoperability](https://www.rfc-editor.org/rfc/rfc8259.html#section-6)
   · [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
3. Verify adjacent large History IDs, the BIGINT maximum, safe and invalid
   inputs, persisted values, real authenticated response JSON, and the
   existing outcome-feedback join in isolated PostgreSQL. Verify client
   passthrough of large IDs. Historical links keep their stored values.

Next, audit policy-library evidence keys built from History IDs. Those keys
have their own persistence and replay requirements.
