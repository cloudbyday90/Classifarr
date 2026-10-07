# Vector validation experiment outcome

Date: 2026-10-07. See the [design](vector-validation-allocation-design.md).

## Decision

**Keep the production validator unchanged.** Thirteen small alternative loops
were compared with the existing implementation. None established both reduced
allocation across the relevant histories and unchanged observable behavior.
This round adds a reusable offline reproduction and semantic regression tests,
not a production memory fix. All memory, freshness, retry and ownership safeguards
remain unchanged. No dependency, schema, version or release change is intended.

The reproduction uses the real decoder, validator and fingerprint helper in a
dedicated process, with fixed synthetic sizes and existing heap-sampling code.
The Linux CLI requires explicit opt-in and the existing 2 GiB/two-CPU/128-PID
budget, checks budget continuity, and emits only bounded numeric evidence.
It never connects to a database or provider, opens a remote inspector, writes a
raw profile, or forces GC. A cooperative deadline and external process timeout
bound execution. The diagnostic is not called by application startup or requests.

## Candidate evidence

The baseline development image was
`sha256:797b3347423babba64e02b4fad977929b7927b40c1b3d9479d00fd69a198be89`,
Node 24.21.0. Each alternative ran in its own network-disabled, read-only container
with 2 GiB/two CPUs/64 PIDs, three parsed rounds followed by three clone-conditioned
rounds. These initial probes used a decoder-shaped prototype, not replacements
mounted over application source. Each round processed 5,776 entries from repeated
256-row batches of 1,024-dimensional synthetic vectors; counts/checksums matched.

| Candidate | Parsed history MiB | Clone-conditioned MiB | Decision |
| --- | ---: | ---: | --- |
| Unchanged validator | 34.77–48.37 | 180.23–189.27 | Control |
| Scalar-check helper | 39.80–55.43 | 167.63–187.24 | Spike remains |
| Numeric local | 43.33–46.86 | 173.69–182.19 | Spike remains |
| Precompute numeric checks | 126.32–135.86 | 254.12–289.22 | Regresses |
| Captured hasOwnProperty call | 44.33–49.88 | 157.63–187.27 | Spike remains |
| Ownership check first | 38.79–54.41 | 177.68–199.36 | No benefit; changes access order |
| Numeric addition hint | 44.84–51.39 | 264.20–275.72 | Regresses |
| Explicit nonzero branch | 37.78–51.90 | 163.12–192.76 | Spike remains |
| Native values iterator | 340.39–346.86 | 363.87–373.36 | Regresses |
| Retained string index keys | 40.31–43.83 | 171.65–193.73 | No useful benefit; adds retention |
| Exact rounding-range predicates | 40.82–49.88 | 170.15–188.70 | No useful benefit; adds numerical complexity |
| Earlier finite guard | 44.33–45.34 | 172.14–180.28 | Spike remains |
| Native array at | 131.31–142.37 | 125.89–149.89 | Regresses parsed control; extra length reads |
| Native every plus visited count | 127.34–134.90 | 139.78–142.86 | Regresses parsed control; changes iteration semantics |

These are cumulative statistical allocation estimates, not concurrent usage,
retention or CPU guarantees. Three rounds do not establish the significance of
small differences. The measured history sensitivity persists; the exact V8
allocation instruction is still unproven. The alternatives remain ignored local
experiments, not production implementations or supported modes of the new CLI.

Local experiment source SHA-256:
`f74d16a9e12fbb97154b613e653edd02668277f9dadeb9903ff9232047a80ad2`.
Receipt SHA-256:
`943dec608d1f075d0619df29dc7e95004deba1bbec79f52c0ca54ff615680861`.

## PR trial

Fresh enumeration found two open PRs. Random selection chose server
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Applied its exact manifest/lockfile change
locally: @types/node 24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0. Registry
integrities/dependency metadata matched. The runtime-major gate passed 8/8 before,
failed 1/8 with the candidate and passed 8/8 after reverting it. The PR is unmerged;
no candidate installation, installed audit or candidate build is claimed.

The Node 24 runtime remains authoritative. Separately, npm outdated reports
dotenv 18.0.6, express-rate-limit 8.7.1, js-yaml 5.4.3 and Knip 6.40.0 as candidates;
review those in their own dependency batch.

## Recommendation stack

1. Retain the current validator and the new semantic/measurement controls. Benefit:
   no integrity regression or speculative production rewrite. Cost: the reproduced
   temporary allocation remains unresolved.
2. Use this small reproduction to isolate V8 optimization/deoptimization and
   allocation sites on the pinned runtime before proposing another validator fix.
   Keep engine flags confined to the disposable probe; do not tune production GC.
3. Only accept a future fix after both micro-controls and complete sampled/natural
   catalog cycles show benefit with identical warm-read counts and all checks.
   Defer broader vector representation or transport changes until justified.

This follows the recovery-change skill's evidence-before-fix gate. The next item
is engine-level attribution of the clone-conditioned path, not another blind loop
rewrite, removal of checks, or a larger memory allowance.

## Verification before image build

- Full backend: 1,740 suites, 54,021 tests passed, one platform-specific skip,
  328.187 seconds. Focused regression/sampler coverage passed 70 tests; the final
  diagnostic receipt checks were rerun separately (11 tests passed).
- Isolated PostgreSQL: two suites, 20 tests passed in 11.607 seconds.
- Server lint/type check, full/production Knip, static imports, copyright, npm CLI
  policy, ownership gate and Markdown passed. No ownership baseline was refreshed;
  that gate means no unreviewed static drift, not proof all legacy paths are safe.
- The first unit harness exceeded the unchanged 60-second diagnostic deadline
  under Jest's cross-realm VM. The full numeric workload now runs in a native Node
  subprocess with a 30-second external test deadline. Work size and production
  diagnostic deadline were not reduced/increased to obtain a pass. Fault-only unit
  cases inject bounded sampler results; the image CLI supplies real sampling.
- Before replacing the local tag, the running baseline image was pinned as
  `classifarr:pre-memory-26606ab0-0539-4595-a955-5672ed15d8f9`. Backup
  `.tmp/pre-memory-fingerprint-26606ab0-0539-4595-a955-5672ed15d8f9.dump` contains
  75,540,185 bytes and passed checksum/archive-list checks, not a restore rehearsal.

Prior documentation commit `a0399d89` has a failed
[CI run 37652685022](https://github.com/cloudbyday90/Classifarr/actions/runs/37652685022),
despite successful Build and Test, Tests with Database and Fresh Install/Published
Upgrade jobs. The API lists no acceptance-readout job or failed job log. This is
an unresolved workflow-level result, not a regression attributed to this change.
The new source revision needs its own CI receipt; no release approval is implied.
