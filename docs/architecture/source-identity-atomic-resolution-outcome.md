# Source identity atomic resolution outcome

Date: 2026-09-09. See the separate
[design](source-identity-atomic-resolution-design.md).

## Measured finding

The new `mediaSync` event's source fingerprint matches a current bounded
`conflicting_provider_ids` observation for `tmdb_id` in library 10 on media
server 1. The same library has one additional current TVDB conflict. This is a
repeated upstream identity conflict, not an AI, queue, database, or automatic
routing failure.

A read-only diagnostic used the existing generic TMDb external-evidence
resolver. The source record declares three distinct TMDb values, one IMDb
value, and one TVDB value. Its IMDb value maps to one TMDb result that is not
among the source's three TMDb candidates; its TVDB value has no TMDb result.
The resolver therefore returns `review_required` with
`incomplete_external_evidence`. No identifiers, titles, URLs, credentials, or
raw provider values were retained by the diagnostic.

The source remains correctly unresolved. There is no evidence that any of the
three conflicting TMDb values is the current identity, so no value was chosen
and no source data was modified. The result demonstrates an actual source
metadata contradiction. It does not establish whether the source match,
metadata hints, or an external catalog record caused it.

## Delivered behavior

One completed library sync now emits a single `Library sync skipped source
items` warning with only:

- the numeric library ID;
- the total skipped-item count;
- fixed reason counts; and
- fixed identity-issue counts.

Detailed source observations retain the controlled, bounded inventory view.
The summary never retains or logs titles, source keys, provider identifiers,
URLs, credentials, or fingerprints. Conflicts continue to block identity
authority until a complete later capture supplies non-conflicting evidence.

## Validation

Focused unit tests verify fixed-field aggregation, one post-capture summary,
the existing identity write guard, and that forged fields do not enter the
summary. The final focused set passed 157 tests in 9 suites. The full backend
unit suite passed 33,111 tests in 1,158 suites before final JSDoc-only typing
tightening; lint, typecheck, documentation lint, ESM static-import, and
mock-shape checks pass. A no-cache Compose rebuild completed and the recreated
container returned a healthy `/health` result. The working-tree security review
covered all 20 changed backend source and test files and found no reportable
finding.

## Recommendation stack and next item

1. Keep this record in review: the existing evidence is contradictory.
2. Correct the source match only after a reviewer verifies the intended item;
   Plex exposes this as a show-level Fix Match workflow. A later source capture
   can then clear the observation through the existing guarded path.
3. The delivered bounded retained-sample replay now measures exact candidate
   agreement, provider failures, and residual review rate without persisting
   source evidence. See the separate
   [replay design](source-identity-evidence-replay-design.md) and
   [outcome](source-identity-evidence-replay-outcome.md).
4. Only if that profile is favorable, add the compare-and-apply transaction
   described in the design: capture generation plus candidate digest must still
   match, the evidence result must name exactly one declared candidate, and the
   resolved inventory write and observation removal must commit together.

This item is not eligible for step 4. It must never trigger automatic routing.
