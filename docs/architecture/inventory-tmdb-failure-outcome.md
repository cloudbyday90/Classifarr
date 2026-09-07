# Inventory TMDb failure diagnostics outcome

Date: 2026-09-07. See the separate [design](inventory-tmdb-failure-design.md).

## Investigation

The reported warning exists locally, but its saved metadata contains only
`provider_unavailable`. Exactly one movie inventory attempt was recorded within
three seconds of its timestamp. A read-only request using the configured provider
credential for that candidate returned HTTP 404. This reproduces a missing item
being described as a provider outage; the old log lacks enough correlation to
prove that this candidate generated the historical event.

No credentials, raw source items, titles, private database exports or provider
payloads are committed. The request did not modify inventory, identity, feedback,
classification history or the remote provider.

## Implementation and limits

Both movie and TV detail services now preserve safe status/code metadata. The
inventory warning records `identity_not_found` for 404 and fixed categories for
other failures, with media type and TMDb ID for future correlation. The wrapper
removes arbitrary exception text and transport configuration. Failure preserves
existing observation data and the established cooldown.

This repairs the misleading diagnostic, not the provider's missing catalog item.
There is no verified replacement ID, so none is assigned. Older warnings cannot
be retroactively attributed. No release was created.

## Validation

Focused tests cover HTTP status categories, network/TLS/timeout/cancellation/size
codes, private-data removal, existing-observation preservation, and both actual
detail-service wrapper entry points. Full-suite and rebuilt-runtime results are
recorded with the [source observation outcome](unresolved-source-observations-outcome.md).
The rebuilt runtime repeated the one candidate read through the actual detail
wrapper and inventory enrichment service. It returned HTTP 404, emitted
`reason: identity_not_found` and `category: not_found`, preserved validated
correlation fields, and left the prior in-memory observation unchanged. The
fixture made one provider read and requested no database writes.
