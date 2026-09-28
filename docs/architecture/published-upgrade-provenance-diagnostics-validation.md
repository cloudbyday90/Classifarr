# Published-upgrade recovery and provenance diagnostics validation

## Outcome — September 28, 2026

The previously blocked published-upgrade budget test now passes. Root cause was
an invalid inherited `GITHUB_TOKEN` overriding a valid stored GitHub CLI login,
not a missing attestation or an application recovery failure. Removing that
override only from the local test process allowed the unchanged provenance
constraints to verify the pinned release. Saved credentials and the machine's
environment were not changed.

Implemented the [diagnostic design](published-upgrade-provenance-diagnostics-design.md)
as a small ESM module with fixed policy and allowlisted failure reasons. The
default invalid-token invocation still exits unsuccessfully before Docker work,
but now identifies `GITHUB_TOKEN` and explains the corrective action in the CLI,
JSON receipt and Markdown summary. It never retries using another identity.

## Clean-source installation evidence

Tested code commit: `89575224942901e9993965a369dcfc983dc333b7`.
The later evidence commit changes documentation only.

```sh
node scripts/run-runtime-installation-acceptance.mjs --ci --resource-budget
```

The local invocation supplied `CLASSIFARR_INSTALLATION_SOURCE_REVISION` matching
HEAD and used the intended stored login with the invalid override removed.
The receipt reports `worktreeClean: true`, `status: passed`, all 12 named checks
passed, and owned-resource cleanup passed. This was local execution with the
strict CI source checks, not a claim of a remote GitHub Actions run.

Candidate image:
`sha256:65bcc6967ccb3410f8c0be7bacf72477b66eb24b0f7c7d61e43cff35e0316a6a`.

The immutable v0.48.4-beta baseline was verified with repository, signer workflow,
source digest, explicit GitHub host and hosted-runner constraints. Its 222
migrations advanced to the candidate's 296 on PostgreSQL 18.6. Fresh and upgrade
scenarios used separate owned volumes and the same candidate image.

| Measurement | Fresh installation | Published-data upgrade |
| --- | --- | --- |
| Enforced CPU / PID / memory limits | 2 CPUs / 128 / 2 GiB | 2 CPUs / 128 / 2 GiB |
| Disposable PostgreSQL connection ceiling | 32 | 32 |
| Injector connections held / hold duration | 16 / 5.000 s | 16 / 5.000 s |
| Rejected connection / remaining injector connections | SQLSTATE 53300 / 0 | SQLSTATE 53300 / 0 |
| New connection and HTTP health recovery | 29.0 ms | 33.5 ms |
| Normal-runtime readiness after crash | 6.27 s | 6.25 s |
| Backfill/profile completion after readiness | 16.38 s | 27.47 s |
| Original inventory items completed | 4 of 4 | 4 of 4 |
| Original ingestion and inventory identities | Preserved | Preserved |
| Music / routing tasks | Excluded / 0 | Excluded / 0 |
| Memory observation during pressure | 297.58 MiB | 283.10 MiB |
| PID/thread observation during pressure | 66 | 66 |
| Memory-limit events / OOM kills / PID denials | 0 / 0 / 0 | 0 / 0 / 0 |

All observed pre-pressure, pressure, recovery and post-restart counters passed;
Docker configuration and cgroup enforcement were independently checked. Memory
and PID readings are point observations, not continuous peaks or safe minimums.
Actual execution used cgroup v1; cgroup v2 remains unit-tested only.

The published-data path also passed an interrupted restore, rejection of normal
startup before restore verification, explicit verified retry, recovery-to-learning
handoff and normal restart. No observer repaired statuses, replaced original
inventory or invoked worker processing to manufacture a pass.

An earlier local run also passed both scopes before the diagnostic refactor.
Its source was marked dirty; the clean-source result above is the primary
evidence. Scheduler timing varies with ordinary ticks and is not a throughput
benchmark.

## Validation and operational safety

| Check | Result |
| --- | --- |
| Focused provenance, installation, receipt and crash tests | 6 suites / 155 tests passed |
| Full backend unit suite | 1,521 suites / 45,877 tests passed |
| Server/client lint and type checks | Passed |
| Markdown, static ESM and strict mock-shape checks | Passed |
| Migration, copyright, dependency and ownership preflight | Passed |
| Real invalid-token regression | Blocked before Docker; actionable, secret-free report |
| New verifier with intended stored login | Pinned provenance verified |
| Clean-source full budget acceptance | Passed |

The generated JSON/Markdown and logs remain ignored under `.tmp`. Both full
test projects cleaned up their owned containers, volumes, networks and candidate
images; no live data or shared image was removed. Read-only inspection confirmed
the live Classifarr container retained its ID, healthy status, original image,
2 GiB memory limit, no CPU quota and no PID cap. Other running containers were
not modified. No release, tag, live rebuild or deployment was performed.

GitHub MCP searches at the start and before handoff found no open PRs in
`cloudbyday90/Classifarr`. No random PR was available to apply, and no PR was merged.

## Recommendation stack and next component

Retain the existing scheduler, PostgreSQL pool, immutable provenance verifier,
isolated Compose drill and allowlisted receipts. The benefit is proven recovery
without adding production machinery or weakening trust; the cost is build/test
time and a dependency on valid verifier access. Small synthetic movie/TV fixtures
do not establish sustained capacity, leak freedom or arbitrary upgrade safety.

Next: add an opt-in budgeted installation profile to the existing CI workflow,
using its job-scoped `GH_TOKEN` and read-only contents/attestations permissions.
Record the runner's actual cgroup version and require the same fresh/upgrade
receipts, so Linux resource-enforcement coverage becomes repeatable before any
live CPU/PID cap proposal. Preserve default release gates while validating the
new profile. GitHub supports explicit dispatch inputs and job-scoped minimum
permissions: [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

Do not repeat the completed local recovery work, create a second orchestrator,
or deploy the test's 32-connection database setting as a production default.
