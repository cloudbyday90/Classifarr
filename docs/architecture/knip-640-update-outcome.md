# Knip 6.40 update outcome

Date: 2026-10-08. Implements the [design](knip-640-update-design.md).
Source commit: `c6f9357d19b9721437d79187bc8c6cc1450ec49b`, on `main`.
No application version bump, tag, release, PR merge or Unraid change.

## Change and before/after evidence

- Server development dependency Knip: 6.39.0 → 6.40.0. Lock review found no
  transitive additions, removals or version changes. Runtime dependency versions,
  strict install policy, security overrides and Knip configuration are unchanged.
- Existing nine installed-CLI contracts passed on 6.39. New entry tests reproduced
  two false negatives: test usage masked an unused production export, and null
  package-export targets hid a private orphan and unused internal export.
- All twelve contracts pass on 6.40. Development-entry negation also remains
  correct. The existing missing-import, tagged-export, cache and invalid-config
  checks remain in place. A shared ESM helper preserves shell-free execution,
  environment filtering, time/output bounds and disposable cleanup.
- The initial new unused-file assertion used the wrong JSON field; it was corrected
  after reading the installed reporter, before testing 6.40. The old-version
  failures occurred at earlier semantic assertions, not at that field access.

## Local verification

Node 24.21.0 / npm 12.2.0 on Windows:

| Check | Observed result |
| --- | --- |
| Scripts-disabled lock generation; strict `npm ci` | Pass; only Knip changed |
| `npm ls --all` | Pass; no dependency-tree problems |
| `npm audit --json`, including development dependencies | Zero reported vulnerabilities at review time |
| Installed-CLI contracts | 12 passed |
| Full repository Knip, normal and production dependency modes, without cache | Both passed, before and after upgrade |
| Existing cached modes through `test:ci:preflight` | Both passed; no extra ignores |
| Backend test/security lint and typecheck | Passed |
| Backend unit suite | 1,750 suites passed; 54,326 tests passed, one Linux-only skip; 296.151 seconds |
| Dependency/toolchain tests | 40 passed |
| Copyright, Markdown lint and ESM static-import gate | Passed |
| Frontend production build | Passed inside the no-cache image build |

The ownership preflight still reports its reviewed baseline of 501 unresolved
paths and `productionCompatible: false`; passing means no unreviewed static
drift, not full writer isolation. Client unit tests, coverage ratchet and the
full local database integration matrix were not rerun for this tooling-only change.

## Random open PR trial

Fresh enumeration found two open PRs, 555 and 556. `Get-Random` selected
[PR 556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`.

Applied its manifest/lock patch locally: server Node declarations 24.19.1 → 26.6.4
and undici-types 7.24.6 → 8.9.0. The runtime-baseline gate passed 8/8 before the
trial, then failed the server declaration-major check (7 passed, 1 failed).
Reversed only that patch; 8/8 passed again. The incompatible versions were not
installed or retained. The PR remains open; no merge or close action was taken.
This is a rejected local trial, not a second dependency update shipped in this commit.

## Image and schema evidence

Local Docker Desktop Linux image IDs (not published registry digest acceptance):

- Baseline: `sha256:55c581b59fccfb6d81dbe50b22ada55bacdba3675f6feb7f49b1e23feb0effea`.
- Candidate: `sha256:bb55f9b6362f6106da9a0004ccace0a19c10c8d41fa1b6dfb3e25ef59eece7aa`.
- Candidate platform manifest: `sha256:a088c0524c95c0a30d9208f4bc4b9bd1a7741f549af92cc240912d3a105ef839`.
- Candidate config: `sha256:e2eb312cd13a7aad9d5584d31be2776ae2ba88f3fcfdb327a7852e8ad98572d9`.

The existing Compose runner used `build --no-cache --require-provenance`,
`PGVECTOR_BUILD=multi`, and the clean source commit above. The first attempt
failed resolving Alpine's package server. Host/container DNS subsequently worked;
the unchanged command succeeded on retry. No DNS, repository or security-policy
workaround was applied. The source label is local evidence, not a signature.

Isolated, network-disabled image probes verified:

- Knip absent from installed production dependencies in both images; all 172
  installed npm and 58 Alpine package versions match.
- Actual candidate migration-copy code passed Linux directory fsync, exclusive
  complete copy, duplicate-target rejection and unchanged-source checks. This
  exercises the behavior skipped by the Windows unit suite using synthetic data.
- Curl negotiated HTTP/2 and received the exact 26,624-byte synthetic response
  on loopback in both images. Both use nghttp2 1.70.0. A temporary probe initially
  expected package drift based on the failed build log; installed inventory
  disproved it. Corrected that expectation and required exact inventory equality.
  The [upstream release notes](https://nghttp2.org/blog/2026/07/29/nghttp2-v1-70-0/)
  were reviewed, but this round did not upgrade that library.
- Every probe container was removed and cleanup verified. No application data
  or credentials were mounted into those probes.

After rebuilding, ran the existing schema-container runner in dump mode and
then check mode against two fresh disposable databases. Both passed through
`20261005_180000_ingestion_compatibility_fence.sql` with 22 seed migrations;
`database/schema/current.sql` is unchanged. Both owned containers and temporary
data directories were removed and verified absent.

## Local replacement and release follow-up

Before replacement, created an exclusive 75,906,320-byte local database backup;
verified its copied checksum and archive listing, and pinned the exact old image
under `classifarr:pre-memory-90a6730d-991b-4344-99a5-aa89bf04d811`.
This was not a full restore drill. The backup remains ignored under `.tmp/`.

Recreated only the existing local Compose service. It reached healthy status,
and `/health` reported a connected database. It retains UID/GID 1000, read-only
root filesystem, no-new-privileges, existing capabilities/mounts and the 2 GiB
limit. Unraid and all memory/retry safeguards are unchanged.

Observed container `8ef4add44d6c2102fc14b9855f50fb9d981deb038a619dd67f8c2f19f99c9704`,
started 10:51:19 UTC. The five-minute sampler completed successfully: 19 readings
from 10:52:03.992 to 10:56:58.831 UTC, all healthy, zero OOM events, zero cgroup
memory-limit failures and zero container restarts. Raw cgroup usage was
489.15–820.04 MiB; the kernel high-water mark was 905.13 MiB. These are whole
container readings, not Node heap sizes or proof of long-term memory retention.
Read-only, startup-scoped database diagnostics found no new stored log entries.

Hosted CI for the implementation commit, observed at 10:57 UTC:

| Workflow | Result |
| --- | --- |
| [OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/37765606038) | Passed |
| [Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/37765605336) | Passed |
| [Gitleaks](https://github.com/cloudbyday90/Classifarr/actions/runs/37765605325) | Passed |
| [CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/37765605318) | Passed |
| [Copyright](https://github.com/cloudbyday90/Classifarr/actions/runs/37765605317) | Passed |
| [Resource capacity](https://github.com/cloudbyday90/Classifarr/actions/runs/37765605385) | Passed |
| [Main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37765605679) | Database integration and installation/upgrade jobs passed; build/test still in progress |

Do not equate the local image with published/native multi-platform evidence.
The subsequent documentation-only commit is not the image's source revision;
it has its own CI run and does not retroactively make the pipeline above green.

Next: release preparation using `.agent/workflows/release.md`, starting with
the pre-existing restore-admission integration failure in
[run 37763137059](https://github.com/cloudbyday90/Classifarr/actions/runs/37763137059).
On the preceding docs commit, 244 database suites passed, one failed and one
was skipped. `runtime-admission.test.mjs:28` received `RESTORE_RUNTIME_BUSY`
immediately after releasing both normal sessions. Session shutdown timing is a
code-supported hypothesis, not a confirmed root cause. Reproduce against an
isolated database and observe lock/session teardown; do not weaken restore
exclusion or replace the assertion with an arbitrary sleep. The earlier source
run 37761681793 and the current implementation run both passed their database
jobs, so this needs intermittent-failure analysis, not an assumption that Knip
caused it. No release-readiness claim is made here.
