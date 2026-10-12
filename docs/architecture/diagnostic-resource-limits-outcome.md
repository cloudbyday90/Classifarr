# Diagnostic resource-limit correction outcome

Date: October 11, 2026. Main; no release or version change.
See the separate [design and official research](diagnostic-resource-limits-design.md).

## Cause and implementation

Testcontainers 12.2.0 converts its memory argument from GiB to bytes. Two older
diagnostic paths supplied byte counts, so their requested caps were much larger
than intended. Corrected retry-query profiling to one GiB/two CPUs and the
profiling-maintenance fixture to half a GiB/one CPU. This does not change
Classifarr's application resource limits or establish any production root cause.

A shared ESM verifier reads only the exact owned container's memory/CPU settings
and fixed cgroup limit files before admitting fixture SQL. Missing, unlimited,
malformed, unsupported or mismatched evidence fails closed with a safe error.
Conventional v1 fallback is bounded; command timeouts do not trigger retries.
Both callers independently check cleanup after stopping their owned container.
No new framework, provider access, migration, UI or production query is introduced.

## Random open PR

Fresh enumeration found two open PRs. The random draw selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), exact head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Applied its two-file server patch locally:
Node types 24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0. Strict installation,
full dependency tree and full npm audit passed (zero advisories). Focused tests
passed 91/91. Tooling passed 40/41: the Node 24 runtime-major contract rejected
Node 26 declarations. Server typechecking also failed at the Discord request-body
boundary: the two FormData/File declaration families no longer agreed. This is a
compile-time compatibility finding, not proof of a runtime delivery failure.

Restored the exact PR patch and reinstalled: server typecheck and 41/41 tooling
tests passed again. No manifest or lockfile diff remains. The PR is unmerged and unchanged.
Fresh server outdated metadata also lists zod 4.6.6 (wanted/latest versus 4.6.5
installed) and Node types 26.6.5 (latest, but 24.19.2 remains wanted). No unrelated
update or global toolchain change is included.

## Verification

Final focused regressions passed 92 tests in four suites, including verification
refusal before fixture work and independent cleanup checks after stop failures.

The real PostgreSQL integration run passed 11 tests across maintenance and retry
benchmark suites in 27.913 seconds. Maintenance verified 536,870,912 bytes and one
CPU before SQL, while preserving extension admission, locks, restricted-role
refusal and rollback behavior. The additional integration-framework database is
not covered by this fixture's cap; this patch does not bound the whole test host.

The standalone default retry benchmark completed with 100,000 rows in each
populated scenario. Its actual Docker limits were 1,073,741,824 bytes and
2,000,000,000 NanoCPUs. Kernel readback agreed: 1,073,741,824 bytes and CPU quota
200,000 / period 100,000. This host uses **cgroup v1**, exercising the real fallback;
cgroup v2 and the alternate combined v1 CPU-controller path are unit-tested, not
separately exercised on another kernel here.

- PostgreSQL 18.6; inspected local image ID
  `sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2`.
- Snapshot SHA-256
  `6f8f391d44d7005094227b4517d623ac59687b4e5eeb39f402e1e687e5b60b50`;
  eight tables, two views and 36 indexes/constraints.
- 594 query comparisons across 11 scenarios, each with three warmed EXPLAIN
  repetitions; every expected ID/order matched. Eleven dispatch scenarios and
  three write-cost scenarios completed; schema/claim rollback was verified.
- Zero provider requests and production changes. Independent Docker inspection
  confirmed that the exact owned benchmark container was absent afterward.
- Other host containers stayed running. No OOM stress, peak-memory measurement,
  retained-memory soak, no-swap claim or production latency guarantee is made.

Earlier benchmark reports now explicitly retract the unverified one-GiB claim
without rewriting their observed timings or correctness results. The existing
ownership review was re-read and updated only for the changed offline entry
point; its classification and indirect analysis gaps remain unchanged. The
ownership gate passed, with `productionCompatible: false` and zero database
connections, writes or provider requests.

Full server lint, server typecheck, both dependency-boundary checks, static-import
and mock-shape gates, copyright and all 2,121 Markdown files passed. Full backend
coverage passed 1,799 suites and 56,290 tests in 801.776 seconds. The existing
Linux-only directory-fsync test is skipped on this Windows host. The coverage
ratchet passed: server statements/lines 89.71%, branches
86.14%, functions 91.14%. Its client input was the same-day 20:47 local-time
coverage report for unchanged client source and dependencies, not a new client
test run. No threshold, assertion or application safeguard was relaxed.

## Local image and schema evaluation

Built Compose with `--no-cache --require-provenance` from clean source
`59072071220bbdf0759511f489f8b1e95c91934c`. Docker reports local image ID
`sha256:36c5a9fb5913efee9db7d859039a61ccf7fdcdbf2ea39352cc6804eda30e75e1`;
the OCI revision matches that source. This is local image evidence, not a
published registry or multi-platform release receipt.

Before replacement, a 75,650,100-byte local database archive passed checksum and
archive-list readability checks. The archive and exact previous-image rollback
tag remain available; this was not a full restore exercise. Recreated only the
existing local Compose service with no build or pull during replacement. It is
healthy, reports no OOM kill, and retains its two-GiB limit, UID/GID 1000,
read-only root filesystem and no-new-privileges setting.

At 2026-10-12 02:05:44 UTC, the read-only post-start probe matched the pre-build
counts: ten covered/active libraries, 6,835 classified rows, four unresolved
identities (two source-review and two retry-wait), zero pending text embeddings
and 6,813 pending image embeddings. Ten requested batch rows were distinct.
The probe made no writes or provider requests. No startup warnings appeared in
that brief post-start window; the pre-existing cached-vector warning is not
claimed fixed by this diagnostic-tooling change.

After rebuilding, ran the schema dump against the exact candidate image in a
fresh, network-disabled fixture with one GiB, two CPUs and 256 PIDs. The snapshot
has no diff. Fresh-install consumer checks found no invented pending work or
unresolved identities. Its exact disposable container and data directory were
verified absent afterward; only those temporary fixture resources were removed.
Unraid, Plex and the shared Ollama service were not changed. The final outcome
documentation is a separate follow-up commit, not additional image source work.

## Next recommendation

Extend the existing corpus profile with representative season mappings and
complete refresh-worker/cache lifecycles, then measure retained memory across
repeated cycles on a disposable synthetic fixture. Keep all memory safeguards
unchanged; the historical production timeout and retention cause remain open.
