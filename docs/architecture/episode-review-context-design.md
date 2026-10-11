# Episode review context

Decision: 2026-10-11. Follow-up to [reviewed episode mappings](reviewed-episode-mappings-design.md).
The remaining four identity conflicts require verified decisions, not another
automatic approval rule. The current confirmation shows a catalog title but only
source coordinates, making it harder to check the intended source episode.

## Contract

Opt into bounded source episode titles only during explicit human-mapping preview
and approval. Reuse the existing paginated Plex/Emby/Jellyfin layout reads; no
extra provider requests, metadata refresh, file reads or provider writes. Keep
titles separate from the existing structural layout digest, so ordinary sync,
saved source identity and legacy approval fingerprints do not change.

Project only requested review rows (maximum 64), with a nullable source title and
the existing typed catalog target. Normalize display titles to at most 500
characters, remove control/format characters, render as text and never expose
source item IDs, filenames, credentials, raw payloads or provider URLs. Missing
titles are explicit, not fabricated. No title equality score or identity inference.

Bind displayed source context into the human-mapping preview fingerprint and
compare it across the existing repeated source reads. Changed context rejects
an in-flight preview/approval and requires renewed review. Old manual previews
also require a fresh check after upgrade. Existing materialized mappings remain
governed by their structural source-layout fence; display-only title changes do
not revoke them. A title is context, not an independent identity guarantee.

No background work on fresh/disabled installations or status polling. Retain the
one-installation lease, 90-second deadline, 10-second/1-MiB provider reads,
2,000-source-episode cap, 32 catalog seasons and complete-coverage requirement.
Transient errors, cancellation, changed configuration/actor/source and unknown
failures produce no approval. No network I/O inside approval transactions.
Uncertain writes still require checking saved mappings, not blind retry. No new
retry budget, schema, scheduler or cache. Restart uses existing durable state.

## Research and findings

Official sources discovered/opened through MCP on 2026-10-11:

- [Plex episode ordering](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)
  allows different provider orders; matching season/episode numbers are not proof.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  supplies the typed catalog season used by the existing checks.
- [W3C confirmation guidance](https://www.w3.org/WAI/WCAG22/Techniques/general/G168)
  supports explaining the selected action and consequences. This technique is
  informative, not a claim of complete WCAG conformance.
- [TF1's Action special announcement](https://tf1pro.com/actualites/article/semaine-speciale-developpement-durable-miraculous-les-aventures-de-ladybug-et)
  corroborates that a Miraculous plastic-pollution special exists. It does not
  verify the contents of a particular local file.
- [Netflix's season-10 reunion announcement](https://www.netflix.com/tudum/articles/love-is-blind-season-10-reunion-date-time)
  describes a separately published special. This offers a possible explanation
  for its absence from the checked season, not a valid substitute TMDb ID.
- [DefinitelyTyped guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  informs the separate Node declaration compatibility trial.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Coordinates alone | Minimal data | Administrator must cross-reference both systems unaided | Improve |
| Titles alongside typed coordinates | Clearer review with existing reads | Titles can be absent or incorrect | Implement as context only |
| Match titles automatically | Less review | False matches, translations and generic episode names | Reject |
| Approve all four real conflicts | Clears the counter | Unverified identities contaminate backfill | Reject |

Stack: inspect both sides → verify actual identity → explicit confirmation →
complete owned sync/backfill. Leave Plex and Unraid unchanged. Next obtain the
operator's item-specific verification; missing catalog targets remain blocked.

## Independent PR trial

Fresh open-PR enumeration found #555 and #556. The random draw selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), unchanged head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Trial its exact server Node declaration
update locally; retain only if current Node 24 compatibility checks pass. Do not
merge or weaken the guard. Fresh outdated metadata also reports Zod 4.6.6; defer
that separate patch batch rather than mixing it into this identity change.
