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

451 gateway unit tests (21 suites) and 283 PostgreSQL integration tests (15 suites)
passed. The new PostgreSQL suite contributes 11 tests:
actual reader permissions, forbidden writes/cleanup calls, privilege drift,
microsecond text, snapshot consistency, oversized rows before transmission,
aggregate limits, cancellation, unknown schema and non-waiting contention.

Typecheck, both Knip modes, test/security lint, Markdown, copyright, static-import,
ESM mock-shape and npm CLI checks passed.
The ownership gate identified the changed verifier and the new restore module.
Both were reviewed in full under the existing isolated-recovery review; no
unrelated entry was refreshed or review limit raised. The full ownership gate
passed (no unreviewed drift); its existing `productionCompatible: false` and
unresolved inventory work remain, rather than being waived.

The first native fixture correctly failed relationship validation: it claimed
100 cleaned-up records, but the protected page contained 99 after exclusions.
The fixture now derives the count from that page. No production check was relaxed.
The corrected ordinary image rehearsal passed, including verified cleanup of its
generated containers, volumes and temporary directory. New v5 cases covered:

- One ten-table snapshot while a separate connection admitted/completed another
  synthetic inference request after snapshot export; the capture retained 109
  bindings and the original counter, not the later committed request.
- Native data-only restore through the restricted login, with independent SQL
  assertions for `9007199254740993` bigint/XID text, microsecond timestamps,
  cancelled attempt 3/cooldown and the unfinished exporting job. Exact-content
  and relationship checks also covered protection links.
- Missing protection marker: rows restored, dependency availability false, no
  marker recreated. Restoring only the fixture marker allowed verification again.
- Altered catalog digest: refusal. Restoring only the fixture manifest allowed
  verification again. No source attempt was refunded or completed by verification.
- Default verifier refusal of v5 without the explicit internal context; the
  separate result cannot become a legacy live-worker receipt.

The source uses synthetic completed-operation and large-counter values, not a
claim that this v5 scenario performed cleanup. The older fixture's explicit clock
adjustments do not prove elapsed daily cooldowns or retention periods. Restored
XIDs are historical values, never evidence of commits in the new database.

Image: local Linux/amd64 Docker image ID
`sha256:6d605885f2ec9b1d699d07964a2993bcc78926e709d897d7bce71beac1bc9a1a`,
built with `--no-cache --require-provenance --protect-running-image` from clean
source `9af6d318e9244b215ecea2235d717b9df8894282`. This is not a registry manifest
digest or signed publication. The fixture count correction runs separately from
the image and changes no packaged application input.

The first capacity-run attempt stopped before fixture execution on
`container_inspection_failed`. Its final diagnostic observed a running, non-OOM
container still starting, and cleanup was verified. The unchanged image and
readiness checks were retried; this does not establish the underlying Docker
inspection failure's cause.

The unchanged-image qualification rerun passed all five legacy-path regression
scenarios: capacity, oversize, cancellation, protection and cleanup. It exercised
100,000 inference bindings/completions, concurrent admission, actual native-process
interruption, preserved attempts/cooldowns, two protected copies, oversized export
refusal and 200 bounded synthetic deletions with subsequent rotation. It reported
zero provider calls and verified cleanup after every scenario. Deliberate fixture
clock changes are not elapsed-time evidence. These v3/v4 regression results do
not establish v5 maximum-size catalog performance.

Completed measured workers reported no OOM, memory-limit or PID-limit events.
Peak verifier memory was 561,721,344 bytes (about 536 MiB) against 1,536 MiB;
peak archiver memory was 132,132,864 bytes (about 126 MiB) against 256 MiB;
peak cleanup memory was 37,568,512 bytes (about 36 MiB) against 256 MiB. These
are local Linux/amd64, Docker/cgroup-v1 observations, not platform-wide guarantees.

Local Compose replacement used this exact image with `--no-build --no-deps
--pull never --force-recreate --wait --protect-running-image`; it completed
healthy. `/health` and `/` returned 200; unauthenticated
`/api/settings/ollama/gateway-history` returned 401. UID/GID 1000, read-only root,
no-new-privileges and the 2 GiB memory limit remained in place, with zero restarts
and no OOM indication. One post-start sample was 570.8 MiB, not a peak/soak claim.

Read-only SQL found no optional gateway/archive/cleanup schemas in the ordinary
application database. Capture-budget state stayed `when_idle`, zero daily calls,
tokens and reservations, revision 2 and the original next-check timestamp.
Harmoniarr's container ID/start time were unchanged. Unraid, Plex and shared
Ollama were not changed, and no optional gateway worker was enabled.

Retained backup: `data/backups/gateway-catalog-capture-before-20261017.dump`,
76,247,481 bytes, mode 0600, SHA-256
`EF6ECDE00AF837190D09938799C530738080445D240935AD7B97BD0B0B4928C0`.
`pg_restore --list` succeeded with 1,933 lines. This ordinary application backup
was catalog-checked, not restored. The prior running image is retained as
`classifarr-local-rollback:916581dd44cdce985333b66918181b9d6672d1bebb9923b0d001ab3675d64354`.

Source implementation is commit `9af6d318e9244b215ecea2235d717b9df8894282`;
the separately mounted fixture correction is `67a71cfe4`. Documentation follow-up
changes no packaged application input. Secret scans passed. Work remains on
`main`; the final push is reported in the handoff rather than predicted here.

Limits: v5 native restoration used the small synthetic catalog, not the maximum
10,000 jobs/1,000 protections/1,000 cleanup operations. Contract and SQL tests
exercise bounds but do not establish full-size catalog throughput. ARM64,
cgroup-v2, host power-loss durability, off-host recovery and published-release
upgrade paths are not established here. Frontend tests and full-repository
coverage/ratchet were not run; the unchanged frontend compiled in the image.
Remote CI was not evaluated.

A fresh GitHub MCP enumeration found no open PR to select. No PR was merged or
substituted, and no release/tag is part of this work.

## Next gate

The subsequent [retention increment](gateway-catalog-retention-outcome.md) adds a
separate registry and dependency-preserving rotation. Its documented remaining
admission/scheduling work supersedes the initial gate below.

Integrate persistent catalog-aware scheduling only after dependency-preserving
rotation is proven. Preserve the original attempt budget and unknown outcomes;
do not treat verification as authority to resume restored workers. Protection
expiry and off-host disaster recovery remain out of scope.
