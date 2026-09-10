# Source identity evidence replay outcome

Date: 2026-09-10. See the separate
[design](source-identity-evidence-replay-design.md).

## Delivered behavior

The new `npm --prefix server run study:replay:source-identity-evidence`
command performs a bounded, database-read-only evidence replay. It first
selects a deterministic daily rotating window of at most 12 active libraries,
then selects no more than 32 current, complete-capture conflicts with an
eight-item cap per selected library. The replay and source-repair worklist now
share one small ESM library-window builder, so their fairness and database
bounds cannot drift apart.

The replay reads a single current item through its existing media-server
adapter. The adapter verifies source-item and library membership, and returns
only normalized provider candidate arrays in process memory. The generic TMDb
external-ID resolver then checks independent IMDb and TVDB evidence. Output is
an aggregate-only JSON record with fixed outcome and reason codes.

No database migration was needed because the replay consumes the existing
bounded observation and capture-state records. It performs no database write,
source write, item persistence, policy mutation, AI call, semantic selection,
or routing action.

## Safety decisions

An exact TMDb response is counted as `exact_candidate_agreement` only when it
is one of the item's current source TMDb candidates and all supplied
independent IDs agree. These conditions deliberately leave several outcomes
review-only:

| Condition | Aggregate result | Effect |
| --- | --- | --- |
| Source has changed or disappeared | `source_conflict_no_longer_present` or `source_item_unavailable` | No correction |
| Independent evidence conflicts or is absent | `external_evidence_conflicting` or `external_evidence_absent` | No provider guess |
| TMDb finds a value outside current source candidates | `resolved_not_current_candidate` | No correction |
| TMDb result is ambiguous, incomplete, invalid, or unavailable | `review_required` | No correction |

The output does not contain provider IDs, source data, library/server IDs,
credentials, URLs, titles, or fingerprints. It reports only aggregate outcome
codes and active/selected/excluded library counts. Per-item source and provider
errors become fixed aggregate codes, which keeps routine operation useful
without recreating an operator-managed error queue.

## Live measurement

The no-cache local-Compose rebuild completed successfully on 2026-09-09 and
the rebuilt container returned a healthy `/health` response. The read-only
replay then selected all 19 current conflicts within its 32-item limit. Its
aggregate-only result was:

| Outcome | Count | Interpretation |
| --- | ---: | --- |
| `exact_candidate_agreement` | 2 | Independent evidence named one current source candidate. |
| `external_evidence_conflicting` | 15 | The current source still declares contradictory independent identifiers. |
| `review_required` | 2 | Independent evidence was incomplete. |

The resolver reasons were one `external_id_match`, one
`external_ids_agree`, and two `incomplete_external_evidence` results. The
source and TMDb values behind those counts were neither written nor printed.

Two exact agreements among 19 cases, alongside 15 contradictory independent
evidence cases, is not a suitable error profile for automatic resolution. It
does not authorize semantic counter-evidence, an identity write, source
mutation, or routing.

## Bounded-window refinement

The original result cap was not enough: its CTE still considered observations
from every active library and then ordered by library ID. A growing deployment
would therefore do more database work than the 32-item response implies and
could repeatedly favor lower library IDs. The new shared selector bounds source
observation reads to 12 libraries and rotates the starting library daily. It
uses a deterministic order, does not persist a cursor, and does not introduce
an operator setting, source request, provider request, or data mutation.

The result now makes the selected scope explicit. A no-conflict result means
the current daily window contains no eligible conflict; it does not claim that
other active libraries have none. This is suitable for an operational evidence
replay, while a frozen cohort continues to retain its own fixed membership and
independent-label controls.

## Validation

Focused tests cover exact candidate agreement, disagreement with the current
candidate set, source repair, conflicting independent evidence, no-current-
conflict behavior, fixed source failure aggregation, bounded window SQL, and
rejection of non-positional SQL-limit text. Adapter tests verify that Plex and
Emby/Jellyfin read only one item and reject an item outside the recorded
library. Type checking and server security lint pass.

## Recommendation and next item

The bounded, source-agnostic [source repair worklist](source-repair-worklist-outcome.md)
is now delivered. It surfaces current complete-capture conflicts with only a
fixed source-side repair instruction and does not make automatic corrections
or expose identifiers. Because the replay keeps only aggregate results, its
17 non-exact cases cannot be singled out without expanding retention; current
source conflicts remain the safe repair boundary.

After source repairs and a fresh full sync, rerun the replay. Do not build a
compare-and-apply command or semantic counter-evidence unless that new,
complete-capture measurement has a materially better error profile.
