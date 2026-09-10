# Retrieval-Representation Study — Outcome

Status: implemented, unreleased on 10 September 2026. This work creates no
release or version bump.

## Delivered

- Added a strict ESM-only retrieval-representation artifact contract for media
  description, declared library purpose, and nearest-item history.
- Bound every artifact to the same redacted fixture and retrieval snapshot
  documents using SHA-256 content addresses, with exact full-fixture coverage
  for every representation.
- Added a pure aggregate result service and
  `study:retrieval-representation-results` local workflow. It compares each
  representation against the same independent reference set and writes only
  `summary_available` results.
- Extracted the shared aggregate statistics helper from the existing semantic
  results summary, keeping decision agreement, review precision/recall,
  abstention coverage, stratum output, reviewer consensus, and Wilson
  intervals consistent across studies.
- Added focused regression coverage for raw-field rejection, duplicate and
  missing variant rejection, snapshot substitution, missing independent labels,
  aggregate-only output, no-write failures, and strict command arguments.

## Result

Classifarr can now measure the real question behind a low-confidence or
misleading candidate: whether the media description, the declared library
purpose, or nearest historical items best match independently reviewed
outcomes. It cannot claim that one is better until a real controlled artifact
and reference set are supplied.

No raw description, purpose, library, item, neighbour, prompt, vector, model,
or reviewer content crosses the result boundary. The implementation does not
call a provider or RAG, retain study content, learn from a result, change
policy, retry classification, or route media.

## Open-PR check

GitHub's public pull-request API returned zero open pull requests for
`cloudbyday90/Classifarr` on 10 September 2026. No random open PR was
available to implement locally; no closed or merged change was reapplied.

## Next item

Create a controlled, redacted representation-artifact producer that evaluates
the three representations for the same pinned cohort. It should first run
offline, record only categorical outcomes and fingerprints, and include an
explicit ablation for historical classification labels before any proposed
live advisory change.
