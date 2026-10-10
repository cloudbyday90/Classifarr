# Source identity cross-reference outcome

## Result

The new read-only diagnostic distinguishes incomplete catalog mappings from
contradictory movie/series matches. It deliberately does not drop an unknown ID,
claim ownership, change metadata or make unresolved items appear repaired.
The existing scheduled replay and automatic recovery are unchanged.

Use the deployment's normal server environment and database credentials:

```sh
npm --prefix server run study:replay:source-identity-evidence -- --cross-references
```

For the bundled image, invoke the existing script inside the container:

```sh
docker exec --user 1000:1000 classifarr node /app/src/scripts/runSourceIdentityExternalEvidenceReplay.mjs --cross-references
```

Adapt the container name and runtime UID/GID to the deployment; do not put API
keys in command arguments. This is an explicit diagnostic, not a new background
job or permission to alter production. It performs bounded source and TMDb GETs.

## Interpreting results

- `agreement_with_missing_mappings`: some IDs agree with a source candidate,
  but at least one has no match in the requested movie/series bucket. Missing
  mappings are not evidence that an ID can safely be discarded.
- `conflicting_matches`: independently queried IDs map to different identities.
- `no_typed_matches`: no queried ID maps to the requested media type.
- `matches_outside_source_candidates`: matches point outside the declared set.
- `all_agree_current_candidate`: all queried IDs agree, but this diagnostic
  does not verify title/year or authorize repair.
- `provider_review_required`, `provider_unavailable`, `source_changed` and
  source/budget outcomes remain distinct from successful evidence collection.

`stableEvidenceLookups` counts only lookups whose source evidence survived the
final recheck, not all attempted network requests. Other media-result buckets
are context only; an episode or season result cannot identify a series.
The run reference identifies this report, not a persisted recovery record.
Selected versus inspected counts expose partial runs. The fixed sample is at
most 12 items, four per library; this is not a full-library audit.

## Local findings and recommendation

On 2026-10-10, a private read-only investigation of 11 remaining conflict cases
found nine with one mapped and one unmapped-at-series-level TVDB ID, plus two
with multiple TMDb candidates and inconclusive independent evidence. Six of the
nine passed the existing strict title/year verification, three did not. Plex
descriptions and artwork existed; they did not resolve the ID disagreements.
Titles, source IDs and provider payloads are intentionally excluded here.

Recommended order: use bounded diagnostics, verify the authoritative records
for the extra IDs, then correct confirmed catalog/source errors or design a
separately reviewed recovery rule. Do not bulk-rematch correct Plex items or
relax identity, ownership, retry or memory safeguards. A read-only browser check
of Unraid at 08:06 Eastern confirmed the same 12 displayed titles: nine with
insufficient independent evidence, two awaiting another external-ID retry, and
one blocked by title/year verification. All ten library summaries were current
and no library import issue was reported. Unraid was not changed; its catalog
lookups were not replayed independently of the local investigation.

A later local read found 11 unresolved items: the previous round's exact-alias
recovery had completed through normal scheduling. The formerly title/year-blocked
item now has its recovery receipt and completed metadata backfill. No attempt or
cooldown was reset for this investigation. That local result is not a claim
that the unreleased fix has been deployed to Unraid.

See the [design and tradeoffs](source-identity-cross-reference-design.md).

## Open-PR trial

Randomly selected [#556](https://github.com/cloudbyday90/Classifarr/pull/556)
was applied locally at its recorded head. Both scripts-disabled and reviewed
policy installs passed, as did `npm ls --all`. The complete server npm audit
reported zero advisories on 2026-10-10. However, Node 26 declarations violated
the Node 24 runtime gate and produced a real Discord/undici `BodyInit`/`File`
type incompatibility. The exact trial was reverted; no PR was merged.

The affected-workspace outdated check also found Express 5.3.0 and Knip 6.41.0.
These were not bundled into this diagnosis; review them in separate bounded
dependency batches. Current supported Node 24 declarations remain in place.

## Verification

Focused tests, quality gates and the requested local image rebuild are being
completed for this change. Final receipts will be recorded here before handoff.
