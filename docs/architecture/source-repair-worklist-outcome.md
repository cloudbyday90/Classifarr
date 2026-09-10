# Source repair worklist outcome

Date: 2026-09-10. See the separate
[design](source-repair-worklist-design.md).

## Delivered behavior

Classifarr now exposes `GET /api/libraries/source-repair-worklist` and shows
the result on the Libraries page. The worklist selects a daily rotating window
of 12 active libraries in library-ID order, then selects up to 32 fresh source
identity conflicts with at most eight entries per selected library. It uses
only current conflicts from completed full captures that had no omitted or
uncapturable source items. Rotation prevents larger library IDs from being
permanently excluded while keeping each database read bounded.

Every entry contains the local library name, source title/year/type, a fixed
conflict category, fixed provider-field labels, a last-seen timestamp, and a
fixed repair instruction. It contains no provider values, source key,
media-server configuration, URL, credential, or replay result. The displayed
instruction is generic: correct the source match in the media server and run
a full sync.

The endpoint is authenticated, parameter-free, rate-limited, and non-cacheable.
It makes one parameterized read and does not call a media server or TMDb. Its
scope reports selected and excluded library counts rather than scanning all
active libraries for a global conflict count. It cannot modify a source match,
establish an inventory identity, clear an observation, select AI work, invoke
AI, or route media.

## Deliberate limit

The previous replay's 17 non-exact cases are a count, not an addressable item
list. Its privacy contract intentionally retained no per-item result. The new
worklist therefore returns current, evidence-qualified source conflicts from
its reported daily window, including the two exact-agreement observations when
they fall in that window. Those items remain
source-conflicted and cannot be corrected automatically under the measured
error profile.

This preserves the safety rule while reducing operator effort: the platform
discovers the affected library and source item, classifies the issue, and
states the only valid repair sequence. The remaining source match decision
stays with the source media server.

## Validation

Focused backend tests cover the complete-capture eligibility predicate,
per-library and global SQL bounds, opaque response boundary, empty result, and
parameter rejection. Focused client tests cover the central API helper,
escaped source titles, table semantics, no-conflict state, and retry behavior.
Targeted lint and server/client type checks pass. A final no-cache compose
build and live local read returned 10 active and selected libraries with 19
selected entries; its serialized response exposed neither an external ID nor a
media-server ID.

## Next item

After source administrators repair the surfaced items and a fresh full sync
completes, rerun the bounded aggregate external-evidence replay. Compare its
new aggregate outcome profile with the 2026-09-09 baseline. Do not add
semantic counter-evidence, automatic identity application, or automatic
routing unless the fresh measurement demonstrates a materially better error
profile and a separately designed atomic compare-and-apply boundary is
approved.
