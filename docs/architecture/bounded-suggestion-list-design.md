# Bounded suggestion list design

Reviewed and agreed November 23, 2026.

The existing global list returns all matching rows and exposes their stored
configuration and reference arrays. The dashboard also derives counts and dialog
content from that response. Its All filter currently omits the status parameter,
which makes the server use the pending default. The separate per-policy list has
its own pending-only contract. Both list contracts remain available.

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Add an authenticated page ordered by ID | Unique order, simple exact continuation and a small projection | Callers that rank by confidence must choose their migration behavior |
| Page by existing confidence and time | Preserves review priority | Requires a lossless cursor for nullable floats and microsecond timestamps, a tie-breaker and compatible index plans |
| Replace the dashboard feed immediately | Bounds the dashboard response in this batch | Couples pagination to count labels, proposal availability, rejection handling and member permissions |

Astra reviewed the legacy consumers, joins and sort behavior and recommended an
additive API before UI migration. The agreed first contract uses descending IDs.

## Recommended stack

1. Use the existing authenticated suggestion router for `GET /api/suggestions/page`.
   Register the static path before the legacy detail route. Accept `status`,
   `policyId` and `beforeId` once each, validate them before querying, and use
   cache control `no-store`. The continuation grants no authorization.
   [HTTP caching, RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5).
2. Use a parameterized PostgreSQL query with a positive ID seek, stable ID order
   and 21-row limit for a 20-row page. Return `nextBeforeId` from the last returned
   row only when another match exists. Independent requests read live data.
   Filtered scans may examine more rows. Measure representative plans before
   commissioning indexes or committing to a database work ceiling.
   [PostgreSQL 18 limits](https://www.postgresql.org/docs/18/queries-limit.html).
3. Select only IDs, clipped display labels, type and status, confidence, impact
   and lifecycle dates. Put the wire limit at 64 KiB before compression. Fetch
   saved configuration through the existing proposal read and feedback through
   the administrator evidence read. The page carries no total or reference count.
   [OWASP API3](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/)
   and [OWASP API4](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/).
4. Expose a named client adapter for a single explicit page. A later dashboard
   migration should reset continuation when filters or review state change, label
   counts by what they measure, keep keyboard focus usable and announce load,
   empty and error states through accessible status messages.
   [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

Verify authentication, malformed and repeated input, live continuation,
closed projection and worst-case payloads against isolated PostgreSQL. Check the
client adapter and legacy contracts through their existing entry points.
