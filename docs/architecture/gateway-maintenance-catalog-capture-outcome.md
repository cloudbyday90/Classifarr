# Gateway maintenance-catalog capture — outcome

Date: 2026-10-17. See the second implementation gate in the
[design](gateway-maintenance-catalog-design.md) for research and tradeoffs.

## Implemented scope

An internal v5 capture option extends the existing online archive service. It uses
a separately checked read-only source, the existing non-waiting maintenance lock,
one exported snapshot and a fixed ten-table dump. The three maintenance tables
have explicit column/type, row-count, row-byte and aggregate-byte limits. Database
text preserves timestamp, bigint and transaction-ID precision. New tables and
dependencies were not added; existing native UUIDv7 identities are preserved.

The verifier restores through its private checked input and packaged schemas.
Only five named ingestion guards are suspended in the fresh isolated target;
they are restored before acceptance, and loading privileges are removed. A real
restricted connection checks forbidden writes and cleanup execution. Exact row
digests and independent relationships precede read-only dependency checks.

The result distinguishes restored rows, required-file availability and disabled
runtime. Retired/unfinished history is not rewritten or replayed. Missing ready
protection markers are not recreated. The file inventory is a compact summary,
not recursive copying of older archives. Availability is checked at that time;
future rotation can invalidate it. No perpetual recovery-set claim is made.

No live setting, administrator command or coordinator activation was added. The
existing v3/v4 reader/receipt contracts remain unchanged. The ordinary verifier
cannot turn a v5 result into a live worker receipt. Normal Classifarr deployments,
Unraid, Plex and shared Ollama are not activated by this code.

## Verification checkpoint

451 gateway unit tests passed. The first new PostgreSQL suite passed 11 tests:
actual reader permissions, forbidden writes/cleanup calls, privilege drift,
microsecond text, snapshot consistency, oversized rows before transmission,
aggregate limits, cancellation, unknown schema and non-waiting contention.

Typecheck, both Knip modes and test/security lint passed at the initial checkpoint.
The ownership gate identified the changed verifier and the new restore module.
Both were reviewed in full and given a specific isolated-restore review; no
unrelated entry was refreshed. Final regression, image rehearsal, no-cache build,
local replacement and push results will be recorded after execution.

A fresh GitHub MCP enumeration found no open PR to select. No PR was merged or
substituted, and no release/tag is part of this work.

## Next gate

Integrate persistent catalog-aware scheduling only after dependency-preserving
rotation is proven. Preserve the original attempt budget and unknown outcomes;
do not treat verification as authority to resume restored workers. Protection
expiry and off-host disaster recovery remain out of scope.
