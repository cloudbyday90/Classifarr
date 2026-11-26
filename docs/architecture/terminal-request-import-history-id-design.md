# Exact History IDs in terminal request-import outcomes

November 26, 2026. The
[queue fingerprint verification](queue-evidence-fingerprint-identity-outcome.md)
found that terminal request-import admission rounds the History reference
before projecting it. The maintainer approved fixing that boundary.

## Contract

The queue worker calls terminal admission after classification returns.
The admission builder converts the History ID to a number before
creating the event, its `classification:<id>` source key and the
learning-intake outcome. Adjacent History IDs can therefore share a
source key in the saved queue result. The existing top-level History
link comes from classification and already retains the exact ID.

Use the shared BIGINT normalizer before constructing the admission
event. Keep positive safe values numeric and carry canonical decimal
text above that range through PostgreSQL's maximum. Invalid or
already-inexact IDs use the existing missing-reference result. The
worker omits that admission summary and acknowledges the ordinary
classification result under the existing claim guard.

Keep the current source and terminal-route conditions, successful and
missing-mapping event types, queue proof rules and outcome-only
learning decision. The downstream projections already support text
IDs. The change adds no SQL, routing attempt, learning write, profile
refresh or history rewrite. Existing rounded summaries are not
reconstructed from the projection.

## Research and alternatives

RFC 8259 describes the exact interoperable range for binary64 JSON
consumers. PostgreSQL JSONB accepts larger numeric values, but its
documentation warns about precision loss at interchange boundaries.
Keep existing safe values numeric and use canonical decimal text for
large IDs. W3C recommends stable identifiers and compatible changes
to consumer-facing formats.
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Validate at the History boundary | Preserves existing safe values and exact large IDs with one change | Consumers must carry the existing two-type identity representation |
| Use text for every outcome ID | Gives this summary one JSON type | Changes existing safe-ID outcomes |
| Change generic event and outcome normalization | Could enforce a uniform rule across more producers | Mixes History with other identity domains and changes unrelated contracts |

Use shared exact validation at terminal admission, existing projections,
and claim-fenced JSONB storage. Keep the admission summary descriptive.
Routing permission and learning authority remain with their current owners.

## Completion

Reproduce the rounded keys before the change. Verify safe IDs, adjacent
large IDs and the BIGINT maximum through routed and missing-mapping
outcomes, with and without fresh queue proof. Exercise the actual queue
processor and acknowledgement against isolated PostgreSQL, using
synthetic classification outcomes and joining the saved reference to
the intended History row. Verify malformed references cannot generate
a summary and that normal acknowledgement still succeeds.
