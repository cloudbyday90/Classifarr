# Owned catalog snapshots — outcome

## Scope and artifact

Implemented the [approved design](gateway-owned-catalog-snapshot-design.md) on
main on 2026-10-20. This is an optional gateway runtime change, not a release or
deployment to Unraid. Plex and shared Ollama were not accessed or changed. No new
admin controls, tables, schema migrations or provider requests were added.

Implementation commits: `99e741e21`, `0f324e5f9`, `aa9215db0`. The final no-cache
local build used clean source `aa9215db07bd45fdb42b4d5ceab484246eee6108`:

- Local image: `sha256:c8f6cb6c324fc783981c2205a54fef9901811924a85142995a618dcf588517db`.
- OCI revision matched that source. This is local build evidence, not a signed
  published-image receipt or release acceptance claim.
- The earlier two build attempts were cancelled when verification/review required
  corrections. Only the corrected final image was rehearsed and installed.

## What changed and why

The catalog coordinator now uses a dedicated, private SELECT-only connection for
its one bounded read transaction. Its caller gets immutable scheduling data and
one capture operation, not SQL, transaction or connection-close authority.
Connection end/error, cancellation, lost transaction state and escaped operations
refuse further work. Unfinished capture is cancelled and drained; even a settled
capture failure cannot be silently turned into success. A normal failure outcome
is returned only after its admitted attempt has been durably recorded. Unknown
persistence and publication remain blocked rather than automatically retried.

Only the first three catalog-table summaries are reused, and only in that owned
transaction. No row bodies or cross-run cache are retained. Successful replay
charges exactly the original bytes. If the base summaries cannot fit after prior
charges, the original complete stream runs again, preserving the same overflow
row and failed-budget value. The fourth table is still read freshly. Permissions,
relationships, admission records, retention inventory, files, capacity, pins,
dump validation and isolated restore verification remain independent checks.

Legacy captures still use their original streaming path. Existing source-parity
studies were updated to recognize the explicit full/base-tail range contract;
their guards were not relaxed. Production keeps its query, row, count, byte,
attempt, cooldown, idle-transaction and operation limits.

## Verification

- Final focused backend run: 10 suites, 36,432 tests passed, including code-health
  contracts, confinement, cancellation, disposal, byte boundaries and durable
  failure handling. Most of this count is the repository-wide generated
  code-health checks, not new feature tests.
- Real isolated PostgreSQL: 3 suites, 34 tests passed. These included backend
  termination, transaction replacement on a different connection, exact overflow
  accounting with earlier charges, genuine 80,000-binding history and a concurrent
  claim/completion. No private snapshot session remained afterward.
- Full frontend coverage: 477 files, 7,373 tests passed. Frontend build passed.
- Gateway tooling: 112 passed with one host Windows symlink skip. The final
  restricted Linux run passed all 113 tests with zero skips, including symlink
  refusal and the full-size argument boundary. Its generated bundles and
  disposable container were removed and absence checked.
- Full lint, server/client types, normal and production dependency checks,
  ownership, static ESM and mock-shape checks passed without baseline updates.
  All 43 dependency/install-policy tooling tests passed. Documentation lint
  checked 2,304 Markdown files with no errors.
- Completed broad backend coverage run: 1,874 suites / 60,226 tests passed;
  2 existing TLS suites / 54 tests failed solely because OpenSSL was absent from
  PATH. The final `--onlyFailures` recheck passed both suites and all 54 tests with
  `OPENSSL_BIN` set. One existing Linux-only directory-fsync test was skipped on
  Windows. This is combined full-run plus corrected-recheck evidence, not a claim
  that the original full command exited zero.
- Final coverage ratchet passed without baseline changes. Server statement/line
  coverage was 89.17%, branch coverage 86.42% and function coverage 90.70%; client
  statement coverage was 87.79%, branches 81.84%, functions 87.50%, lines 89.47%.

The first single-process backend coverage run found three undocumented
intentional rejection handlers. Their purpose is now explicit, and code-health
tests pass without disabling checks. That unbounded single-process run was
cancelled as its memory accumulated; the final run uses the repository's normal
two-worker command with 512 MB worker recycling. No result from the cancelled run
is counted as a passing full suite.

The bounded run also exposed a host prerequisite: OpenSSL was not on PATH for two
existing TLS fixture suites. Both were rerun against Git's installed OpenSSL
through their supported `OPENSSL_BIN` setting: 2 suites, 54 tests passed, then the
same result was confirmed by the final failed-suite-only recheck. No
certificate was committed and no application code, assertions or limits were
changed to address that environment issue.

## Real dumps, restores and pressure

Both sealed image rehearsals passed sequentially against the final image and
committed fixture inputs. An initial malformed revision argument was refused
before setup; the actual Git revision was then read and used for the successful
run.

The scheduling rehearsal exercised the packaged runtime worker, repeated quiet
assessments, registration/acknowledgment restart cuts and real replacement copies.
It preserved catalog ordinals `[2,3,2,3]`, two retained roots and historical rows;
obsolete files were released only after verified replacements.

The pressure extension appended consistent UUIDv7 synthetic bindings and
completion receipts without resetting existing counters, history or deadlines.
Two real inference archives were exported and restored. An owned catalog snapshot
then froze 80,000 bindings while a genuine inference claim/completion advanced the
live fixture to 80,001. Its v7 dump restored successfully in the separate packaged
verifier, with dependencies available and attempt ordinal 2. Earlier job rows
were unchanged, cleanup operations stayed zero, and no private source session
remained. The receipt did not enable runtime or authorize purge.

Scheduling observations in the controlled pressure/rotation drill were explicitly
simulated; timestamps, SQL, counters, admissions, dumps and restores were real.
This does not establish that an hour/day elapsed or that production throughput or
latency improved. The 80,000-row case is synthetic, not a production-library replay
or a sustained co-load benchmark.

The separate archive regression passed real restore, corruption refusal, missing
dependency/protection-marker refusal, files changed after export, candidate-page
proofs, legacy-receipt refusal, oversized excluded rows, 10,001-job refusal,
retention pins and interrupted fixed-file retirement. Its sparse capacity case
tests byte accounting, not dump throughput. All owned source containers,
verifiers, stagers, fixture/archive volumes and synthetic database directories
were removed; labeled-resource absence was checked. No Docker pruning or live
history deletion occurred.

Sources had 2 GiB memory/no swap, 2 CPUs and no network; packaged restore verifiers
had 1.5 GiB/no swap, 1 CPU, a read-only root and no network, fixture imports,
source socket, live credentials or Docker socket. Limits were not increased to
make the pressure case pass.

## Random PR, implemented without merge

Revalidated open [PR #567](https://github.com/cloudbyday90/Classifarr/pull/567)
and implemented client ESLint 10.13.0 locally with an exact direct pin. The lock
delta is limited to that declaration and ESLint's version, registry artifact and
integrity; no unrelated dependency updates or new lifecycle installers. Clean
installation, complete tree, lint, types, frontend tests and build passed. The
full client audit reported zero advisories on 2026-10-20; that is not proof that
the dependency tree has no vulnerabilities. The PR was not merged or closed.

## Local Compose and rollback

Local Compose was recreated without rebuilding or pulling after the rehearsals.
Container `605e47232a956fd7a0459357a524536731ba13a2a1add92bde4dd7cff81faa28`
started at `2026-10-20T10:33:36.538844625Z`, using the tested image: healthy,
read-only root, 2 GiB limit, no OOM. Optional gateway namespaces remain absent from
normal appdata. `/health`, `/api/system/health/ready` and `/` returned HTTP 200;
PostgreSQL reports 18.6 and pgvector 0.8.7. The capture guard remains
`2|0|0|0|0|2026-10-09 16:50:11.617278-04`.

A 76,212,009-byte mode-0600 local backup was retained before replacement at
`data/backups/gateway-owned-snapshot-20261020.dump`, SHA-256
`8bbbe5f68038bffb8f7e8386c9c3925141044fcf42ca77c69484f8b02a951911`.
Its archive list passed; this is not a full restore test of normal appdata.
Rollback tag
`classifarr-local-rollback:0a9070c96476b1e78eb4b466f4e2f17407f6dd99082b288b635badc6292641e7`
retains prior image
`sha256:0d017d65979924ad6c01d6e615111f3e86eb32e918b403f3489920af1b4cf1b2`.
Earlier backups and rollback images were retained.

## Recommendations, tradeoffs and remaining risks

| Recommendation | Benefit | Cost / remaining weakness |
| --- | --- | --- |
| Keep the private transaction owner | Confines ordinary caller authority; stable frozen data despite concurrent inference | One extra temporary connection; connection exhaustion must fail closed |
| Reuse only immutable base summaries | Removes duplicate base hashing without retaining row bodies | Initial streaming, fourth-table and filesystem checks still cost I/O; overflow deliberately re-streams |
| Preserve independent fences and restore | Detects stale files, tampering, broken dependencies and uncertain outcomes | More I/O and latency than trusting a cached success flag |
| Measure before broader optimization | Gives evidence about actual resource savings and interference | Synthetic correctness tests alone cannot predict production capacity |

[PostgreSQL's timeout guidance](https://www.postgresql.org/docs/18/runtime-config-client.html),
discovered through connected search and reviewed on 2026-10-20, explains that open
transactions can retain obsolete row versions and contribute to bloat. Inference:
keep this owner short-lived and preserve its existing 75-second idle and
120-second application bounds. Do not turn it into a pooled or process-wide
cache. This internal API is not a sandbox against arbitrary in-process code.

Final stack: private SELECT-only owner → immutable transaction-local summaries →
exact budget replay/fallback → fresh fourth-table and file/admission checks →
isolated restore proof → unchanged recovery and attempt gates.

Next recommended item: measure the implemented path during a bounded,
normal-cadence inference/archive/restore co-load study, including connection count,
snapshot age, memory, I/O and inference latency. Keep timing/limits unchanged and
use synthetic local providers only. Defer retention-summary reuse and further
check reduction until that evidence shows a worthwhile saving without weakening
recovery readiness. No new admin buttons or automatic purge authority are needed.
