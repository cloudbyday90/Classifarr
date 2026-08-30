# Library Evidence Profile Outcome

## Status

Implemented locally for the unreleased branch. This change does not create a
release or change routing, policy thresholds, AI-provider behavior, or
learning.

## Delivered Behavior

For a pending decision with two or three current policy-eligible libraries,
the Command Center now offers an expandable **Library evidence profile**. It
compares each candidate's policy score, margin from the leader, and fixed
evidence states for declared policy, observed contents, identity and metadata,
similar-item/RAG retrieval, and confirmed outcomes.

The display is intentionally read-only. It explains why the deterministic
policy ranking exists; it does not ask a model to select a destination or let
a model alter a route.

## Security Outcome

The server constructs the profile from the existing, policy-owned candidate
set and caps it at three destinations. The client revalidates the version,
score mechanics, unique ranks, candidate identity, and fixed evidence-card
shape before rendering.

The following remain server-only: raw metadata and descriptions, catalog
titles, policy terms, internal IDs, provider/model information, prompts, raw
model responses, retrieval text, and all routing controls. This avoids an
excessive-data-exposure pattern and avoids presenting free-form AI output as
policy evidence.

## Verification

- Server unit tests cover bounded candidate selection, score margins, fixed
  evidence-state projection, and raw-field exclusion.
- Client unit tests cover strict normalization, malformed margin rejection,
  semantic table headers, bounded display, and integration with the pending
  recommendation actions.
- The component requires no new network endpoint, persisted field, migration,
  or provider permission.

## Pull Request Check

GitHub was queried for open pull requests in `cloudbyday90/Classifarr`; none
were open at the time of implementation. Consequently, there was no random
open pull request to implement locally. No closed or inferred pull request was
substituted.

## Next Recommended Item

Delivered as [Policy Candidate Correction Analytics](policy-candidate-correction-analytics-design.md).
The next recommended item is **uncertainty-aware calibration readiness**: a
read-only minimum-cohort and confidence-interval gate for the aggregate
correction signals. It must identify an area for human policy-evidence review,
not automatically change a threshold, RAG behavior, AI configuration, or
routing.
