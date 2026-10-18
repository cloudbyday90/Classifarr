# Incremental gateway archive evidence outcome

Work date: 2026-10-18. Scope and alternatives are in the separate
[design](gateway-incremental-evidence-design.md).

## Implementation

The optional coordinator now keeps ordered job summaries and fetches full
manifest/receipt evidence by exact ID. PostgreSQL rejects an individual projected
record above 128 KiB before sending its body. Each read compares all captured
headers plus a complete stored-job digest, refusing changed or missing evidence.
The original 10,000-job and 8 MiB metadata limits remain.

Protection reconciliation retains small membership records, validates all groups
before readiness writes, and repeats the scan after cancellation/restart.
Protection selection retains only its newest matching pair. Cleanup still checks
every required archive, receipt and marker before admission; rotation still
requires preservation evidence and checks catalog pins. No persisted validation
cache, schema migration, new admin action or production activation was added.

The recovery-change workflow guided the cancellation, late-corruption and
exact-image checks. The implementation follows the approved grill-me agreement;
it does not extend consent to live cleanup or shared-provider operations.

## Code verification

- Regression first: six of the seven initial SQL tests failed against the old
  eager reader. All seven passed after the change.
- Targeted gateway checks: 495 unit tests in 25 suites and 320 SQL tests in
  18 suites passed. SQL checks include 12,000,000 aggregate payload bytes,
  exact 128 KiB / next-byte boundaries, changed/deleted records, unchanged stored
  manifest hash with changed receipt, native timestamps, tied-time ordering and
  preserved capacity/attempts. Unit checks cover interleaved groups, a late bad
  member, incomplete groups and cancellation with a fresh full rescan.
- Repository lint, server/client typechecks, Knip, strict ESM mock shapes, static
  imports, copyright, Markdown and inventory-writer ownership checks passed.
  Staged secret scanning passed. Full application coverage was not rerun.
- The first unit invocation lacked the local OpenSSL executable path and had
  environment-only `ENOENT` failures; the correctly configured invocation passed.
- Review found a timestamp-only comparison gap caused by JavaScript Date rounding.
  A microsecond-change regression failed first; the digest now includes exact
  stored job fields, not just manifest/receipt bodies. Final retest is pending.

No open PR existed when enumerated through GitHub MCP on 2026-10-18. No PR was
invented, merged or closed. Official locking and cursor guidance was rechecked
through MCP; see the design for verified links and tradeoffs.

## Container evaluation

Evaluation is in progress; image measurements and replacement results will be
recorded here before handoff. No passing image qualification is claimed yet.

The large protected-history fixture constructs actual dumps and independent
restore receipts, in bounded batches. It uses synthetic historical job insertion
to avoid waiting through production scheduling intervals; this is not evidence
of elapsed daily cadence. Each pair uses a distinct real inference revision and
attempts 1/2, without refunding attempts. Only the fixture verifier loops through
20 restores per invocation; the production verifier cadence is unchanged.

## Limitations and next recommendation

This removes aggregate evidence allocation, not the cost of hashing every file.
More SQL round trips are the deliberate tradeoff. Measure repeated verification
I/O next, then consider reducing duplicate work within one locked assessment.
Do not introduce cross-run trust or raise deadlines as a shortcut.

Keep the optional feature disabled in ordinary installations until separately
approved. Unraid, Plex and shared Ollama are outside this local change. These
checks do not establish ARM64, power-loss durability or off-host recovery, and two
local copies still share a host/disk failure domain. No release or tag is planned.
