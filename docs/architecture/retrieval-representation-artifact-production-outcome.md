# Retrieval-Representation Artifact Production — Outcome

Status: implemented, unreleased on 10 September 2026. This work creates no
release or version bump.

## Delivered

- Added a strict ESM-only categorical submission contract for the same pinned
  held-out cohort used by retrieval-representation evaluation.
- Added a paired artifact producer for the historical-classification-label
  inclusion and exclusion conditions.
- Enforced that media-description and declared-library-purpose decisions are
  identical across the two conditions; only nearest-item-history may differ.
- Added artifact-set support to the aggregate result service, so the existing
  results workflow produces one content-free comparison group per condition.
- Added `study:retrieval-representation-artifacts`, a private `.tmp`-only CLI
  that writes nothing if the bundle or categorical submission is invalid.
- Made historical classification-label inclusion an explicit optional
  embedding formatter parameter. Existing embedding behavior is unchanged.

## Result

Classifarr can now preserve the two condition outputs needed to test whether a
historical `Classified:` field affects nearest-item evidence, without silently
changing the media-description or purpose representation. The artifacts carry
only opaque IDs, decisions, and pins; raw media, policy, library, candidate,
retrieval, prompt, model, provider, vector, reviewer, and independent-label
content is rejected or discarded.

The new producer does not score source content itself. It is deliberately a
safe admission and projection boundary. Existing vectors cannot be declared
label-free because their source text was not retained. The bounded private
scorer is now delivered separately in
[Retrieval-Representation Private Scorer — Outcome](retrieval-representation-private-scorer-outcome.md).

## Open-PR check

GitHub's public pull-request endpoint returned zero open pull requests for
`cloudbyday90/Classifarr` on 10 September 2026. No random open PR was
available to implement locally; no closed or merged change was reapplied.

## Next item

Collect an independently double-labelled reference set for the fixed cohort,
then run the new private scorer and paired aggregate report. Compare conditions
by stratum and uncertainty before considering a reversible re-embedding pilot.
