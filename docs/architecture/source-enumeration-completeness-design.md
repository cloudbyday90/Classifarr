# Source enumeration completeness

## Decision and cause

An owned writer is not proof of a complete source enumeration. Media adapters currently
convert missing item arrays into empty lists, discard page metadata, and swallow
collection failures as empty lists. The runner ends on a short page and prunes unseen
records. These paths can confuse missing evidence with evidence of absence.

Introduce small ESM modules for provider page validation and enumeration accounting.
Keep legacy array-returning adapter helpers for callers, but require explicit page
envelopes in ingestion, including collections. Do not add a permissive array fallback.
Existing authenticated public REST endpoints and client contracts remain unchanged.

## Contract

- Validate JSON objects, arrays, bounded counts, stable source keys and pagination
  metadata before persistence. Preserve totals on empty pages and compare Plex
  header/body evidence when both exist. Accept omitted arrays only with explicit
  empty evidence, never merely because a field is absent.
- Require a declared media type before deciding to ignore an out-of-scope item.
  Missing types are malformed evidence, not confirmation that the source is audio.
- Advance by returned count, not requested count. Validate any reported offset,
  stable totals, unique keys and bounded progress across pages. Supported movie/TV
  items remain the only inventory inputs; unsupported metadata stays discarded.
- Require a known, consistent total equal to the enumerated unique keys before
  completion. Unknown totals are not fabricated: retain useful partial ingestion,
  withhold pruning/readiness, and use the existing durable retry checkpoint. This
  conservative policy can defer even conforming providers that omit optional totals;
  it is an application safety policy, not a declaration that those providers violate
  their API. No count can prove a transactionally frozen upstream snapshot.
- Validate both media and collection enumeration before finalization. Provider errors
  must not become empty collections. Empty libraries with affirmative zero-count
  evidence remain supported.
- Preserve the owning connection, generation fence, source rechecks, final atomic
  pruning/completion and bounded retry/backoff. Record a safe failure reason using
  existing sync status; deduplicate contract warnings. No raw response, credentials
  or content payload is logged. Readiness remains deferred through failed ingestion.

## Official research, verified 2026-09-27

URLs were discovered through web tools, not guessed.

- [Plex pagination](https://developer.plex.tv/pms/) states that actual returned sizes
  can differ from requested sizes and totals are optional; clients must inspect
  response pagination. Therefore a short page alone cannot establish completion.
- [Jellyfin query result](https://typescript-sdk.jellyfin.org/interfaces/generated-client.BaseItemDtoQueryResult.html)
  separates items, start index and total count. Optional schema fields do not
  independently authorize destructive absence reconciliation.
  Its [Items request](https://typescript-sdk.jellyfin.org/interfaces/generated-client.LibraryApiGetItemsRequest.html)
  supports explicitly requesting the total record count.
- [Emby Items API](https://dev.emby.media/reference/RestAPI/ItemsService/getItems.html)
  documents the item array and total record count for authenticated collection queries.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  structural metadata, provenance, data-quality information and coverage assessment.
  Preserve evidence and uncertainty rather than presenting unknown completeness as
  success. This is an application of its principles, not an RDF conformance claim.

## Tradeoffs and recommended stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Only reject malformed JSON | Small change | Valid but truncated pages still prune | Insufficient |
| Validated envelopes plus bounded enumeration | Protects destructive completion without a new dependency | Missing totals defer completion; upstream mutation remains possible | Implement |
| Treat repeated scans as an atomic snapshot | Works without totals in some cases | Extra provider load; repeated omissions can still agree | Do not claim certainty |
| New workflow engine | Broader scheduling features | Does not establish source completeness | Not needed |

Recommended stack: provider envelope validation, bounded unique-key accounting,
completion evidence for media and collections, existing ownership/generation guards,
atomic finalization, then durable retry and readiness deferral. Tests must exercise
malformed, short, duplicated, changing, unknown-total and legitimately empty sources.
No release, live deployment, routing change or music support is included.
