# Gateway row-mode comparison outcome

## Decision and subjects

Retain the current production object-row reader. The approved array-row
comparison passed correctness and safety checks, but failed the predeclared
allocation-benefit screen. No runtime optimization, retry/cooldown change,
verification removal, table/schema/identity or administrator control was added.
All implementation is modular ESM measurement tooling; existing UUIDv7 database
identities remain unchanged. See the separate [design](gateway-row-mode-design.md)
for official research, alternatives and the approved protocol.

| Subject | Exact identity |
| --- | --- |
| Previous accepted main | `b408a1e21173498bd9857493305ae636b7a61cfd` |
| Tested implementation | `0bff6f90328c03ddbd4787706a49776d7211bb08` |
| No-cache local image ID | `sha256:e2f163495e19499d6263792103f8fc8f8d902b92df12f47a44dfae8909c0c4f9` |
| Verified fixture-binding SHA-256 | `0fa3d093a530254ed5aa2ecb254550a17dbb557a8c14e52ed9d9254ce5cd2f7b` |
| Catalog UUIDv7 | `01a1516c-99e2-720c-98b0-973f42a854b3` |
| Catalog manifest SHA-256 | `1358b1a7c33544edfb71683708d20b9d7f9609335350d266a903d6528a7b5172` |
| Real dump bytes | 233,157,833 |
| Dump SHA-256 | `49abf1150992b5c7c589c1b4b7e4e8a99343c656da5b9c5912894e2ba8d51221` |
| Complete source SHA-256 before/after | `ea3e8cb1e51bf5502b53a94d6b0bad9fa34f9789b0d89c28fe4b2df2185933db` |

The checkout was clean and committed during the no-cache provenance build and
the complete study. The inspected OCI revision matches the implementation.
These are local image/source checks, not signed registry or multi-platform
acceptance evidence. This outcome document was added afterward without changing
the measured code. Ignored `.tmp/row-mode-*.log` files are local intermediates.

GitHub MCP enumerated no open PR, so none could be randomly selected or
implemented. Work stays on main: no release/tag, PR merge, Unraid/Plex/shared
Ollama change, live recovery or production purge. No real model call was issued
by these fixtures.

## What was measured

The existing isolated setup produced one real prerequisite archive/private
restore, 3,000 varied failed-history rows and a real v7/catalog-v3 dump. The
prerequisite retains shared attempt 1; the pending catalog retains attempt 2.
No catalog receipt was accepted, source attempt refunded or runtime job added.

Each separate measurement container used network none, read-only root, UID/GID
1000, no capabilities, no-new-privileges, 1536 MiB/no swap, one CPU and 64 PIDs.
Artifacts, fixtures and the disposable source socket were read-only mounts. Its
only SQL login was `soak_reader`, default read-only with no UPDATE privilege.
This benchmarks SELECT-only catalog reads against one frozen source view, not a
candidate's full private PostgreSQL restore. The source view includes its pending
catalog admission; it is not claimed to be the dump's pre-admission table view.

Every measured scan visited 3,002 rows, transferred 233,854,390 canonical body
bytes and charged 233,857,392 bytes including one newline per row. Exact table
counts, maximum IDs and hashes matched production. The aggregate content digest
was `fa6d20d4a4f85e03437cfc1c87d398b107d8281e74760bb47681488ded40ecd0`.
No canonical bodies or raw profiles/stacks were published.

Each lane used a production baseline read and an unmeasured common-accumulator
warm-up, followed by object/array/array/object twice. All reads in that lane used
one UTC/ISO repeatable-read read-only transaction. SQL/client/lock limits stayed
at 4/5/2 seconds, with the existing finite scan/cancellation bounds. No heavy
tests/builds overlapped measurements. Natural and profiler lanes used fresh
processes; they are not a profiler-overhead crossover.

## Results

MiB means 1,048,576 bytes. Allocation estimates are sampled operation totals,
not live bytes, retained ownership, process RSS or exact native-buffer allocation.

| Ordered run | Mode | Natural elapsed ms | Separate sampled allocation MiB |
| --- | --- | --- | --- |
| 1 | Object | 7,496.80 | 236.08 |
| 2 | Array | 7,461.93 | 237.11 |
| 3 | Array | 7,388.57 | 233.31 |
| 4 | Object | 7,538.83 | 233.54 |
| 5 | Object | 7,578.60 | 243.73 |
| 6 | Array | 7,416.66 | 230.08 |
| 7 | Array | 7,689.89 | 237.11 |
| 8 | Object | 7,870.37 | 224.67 |

Natural medians were 7,558.71 ms (object) and 7,439.30 ms (array): an observed
1.58% lower elapsed median, not a demonstrated general speed improvement. The
four mirrored allocation ratios (array/object) were 1.00432, 0.99901, 0.94397 and
1.05536. None met the predeclared 0.90 maximum for every pair. The screen returned
`promising:false` and `productionAuthorized:false`. No extra trials or weaker
threshold were used to obtain a positive result.

Natural sampled process RSS peaks ranged 187.66–192.21 MiB for object runs and
189.61–191.14 MiB for arrays. The natural lane's lifetime cgroup peak was 196.35
MiB; the profiler lane's was 162.22 MiB. These counters have different accounting
and timing, overlap with other memory measures, and are not additive. Both lanes
had zero OOM, OOM-kill, memory-limit-hit and PID-limit events.

Natural observations: 253 samples, maximum gap 256.77 ms, no missing required
counters, zero forced GC, 618.02 ms total measured sampling-read time over
60,441.65 ms of measured scans. The profiler lane had 274 samples, maximum gap
258.80 ms, zero forced GC and 821.83 ms of sampling-read time. Those elapsed read
times exclude some observer effects and are not CPU-overhead measurements.
Backend CPU ticks remain explicitly unavailable: a private PID namespace cannot
identify the source backend safely. Missing optional I/O/pressure evidence is
not reported as zero.

This negative finding is consistent with the
[installed upstream parser](https://github.com/brianc/node-postgres/blob/0980cefebe0ae461da8883703be049fe13ca96cf/packages/pg-protocol/src/parser.ts):
large DataRow fields are already strings before keyed-versus-array row mapping.
It does not prove arrays are never useful. The candidate's required tuple/field
validation is included in its cost; removing those checks for a benchmark would
not establish a safe runtime improvement.

## Weak points addressed and remaining limits

- Bound all 25 copied fixture files to committed source and exact copied bytes,
  checking them before setup, before comparison imports and again on the host
  afterward. Packaged row-reader/content sources were also bound. A real worker
  with an intentionally wrong candidate hash exited 1 in bootstrap, before a
  comparison import or SQL read; its manifest was then restored. No executable
  file or history was tampered with for that refusal test.
- Enforced deterministic source parity: candidate differences are limited to
  import rebasing, array FETCH/field validation and positional access; the common
  accumulator differs only by visitor injection. Production source was untouched.
- Each lane passed ten pre-abort, cumulative-budget, consumer-error,
  cancellation/cursor-closure and empty-selection probes across both readers,
  plus selected dependency equality and a real read-only UPDATE denial. The
  complete source fingerprint and original attempts matched after both lanes.
- Native study exited 0 with `row_mode_passed_cleanup_verified`; exact-label
  inventories confirmed no study containers/volumes remained. Only disposable
  owned resources were removed; they can be regenerated.

There were only four mirrored pairs in one synthetic distribution on a shared
desktop. Counterbalancing/warm-up reduces some order effects, not all drift or
cache/GC differences. No forced GC, cache dropping, raw heap dump or inspector
listener was used. These scans do not prove endurance, live Ollama capacity,
purge safety or leak freedom. The fixture bindings are local integrity checks,
not protection against a malicious host administrator or signed attestations.

The new provenance gate is currently scoped to this mode. Existing restore and
history study modes still have their earlier identity contracts; do not describe
them as receiving the new copied-file binding automatically.

## Verification and local handoff

Gateway tooling: 41 tests passed. Affected backend preflight, code-health and
ownership contracts: 36,319 tests in three suites passed. Preflight/copyright,
both Knip modes, server/client lint and types, four policy gates, static ESM
imports, mock shapes, syntax, Markdown and secret/whitespace checks passed.
The first direct Jest invocation failed ESM setup before running tests; using
the repository's `run-jest.mjs` launcher corrected the invocation, not application
code or test expectations. A test initially tried reversing the palindromic ABBA
sequence as an invalid order; it was corrected to swap unlike adjacent modes.

This tooling-only patch did not rerun full backend/frontend coverage. Symmetric
end-to-end candidate restore endurance was deliberately not run: the low-level
candidate failed its promotion screen and never entered production. The unchanged
default native safety rehearsal exited 0 with
`online_archive_rehearsal_cleanup_verified`. It covered real restricted restores,
tamper/legacy-receipt refusal, mixed-version rotation to two roots, shared pins,
late-file changes, interrupted retirement, oversized excluded history and 10,001
jobs. History/attempts were preserved with zero provider calls. Label-filtered
container/volume inventories were empty after cleanup. Sparse capacity checks
are accounting evidence, not real dump throughput.

The first protected normal local refresh retained a fresh mode-0600 backup,
`data/backups/gateway-row-mode-ready-20261018.dump`, 76,251,009 bytes, SHA-256
`204de9271f1c029c18c1cc88f0455f3067d59da72db9321ebae4581af98ab924`.
`pg_restore --list` passed, not a full application database restore. The tested
image started healthy; health, readiness and UI endpoints returned HTTP 200.
Optional gateway namespaces remained absent and capture budget revision 2,
all four zero call/token/reservation counters and its existing next-check time
were unchanged. The preceding image/backups were retained; no pruning occurred.

Final review identified a bootstrap ordering weakness: although the host checked
the emitted binding digest, the worker originally imported a fixture before
checking the expected file-name set. Hardened the command to carry the trusted
expected manifest digest and compare it before parsing/imports. The extra unit
contract brings tooling to 42 passing tests. The original well-formed comparison
above remains recorded against its exact source; the hardened build, adversarial
refusal and repeated study must be verified separately before final handoff.

## Recommendation stack and next item

1. Keep object rows and all current integrity/resource/attempt limits. Advantage:
   no runtime complexity for an unproven gain. Tradeoff: decoding cost remains.
2. Retain the source-bound paired comparison as a reproducible diagnostic, not
   an automatically recurring task or an admin action. Advantage: exact negative
   results are preserved. Cost: fixture parity must be maintained explicitly.
3. Next, extend copied-fixture source binding to the other existing archive and
   restore studies, reviewing their callers and CI compatibility first. This
   addresses an observed evidence weakness without changing recovery authority.
4. Defer batch tuning or a real raw-byte streaming/COPY prototype to a separately
   reviewed design. Smaller batches add round trips without eliminating text
   decoding; raw transport could avoid decoding but expands protocol, encoding,
   cancellation and whole-statement deadline obligations. No parser trick,
   cross-snapshot cache or removed validation is recommended.

Final stack: committed source bindings → exact same-view equivalence → natural
counterbalanced measurements → separate statistical sampling → retain the known
path when benefits are unproven → unchanged native safety checks → private backup
and protected local refresh. No release or production activation follows.
