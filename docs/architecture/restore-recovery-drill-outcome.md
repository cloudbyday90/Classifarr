# Disposable restore recovery drill outcome

## Delivered

Run from the repository root with Docker available:

```sh
npm run test:local:restore-recovery-drill
```

No arguments, installation database URL, backup file, project name or credentials
are accepted. The launcher builds the current checkout's production image in a
new Compose project. The first uncached build can take several minutes. It runs
the real Node entrypoint against a separate PostgreSQL 18/pgvector service and
uses only new scratch volumes. It does not run the production shell entrypoint.

The implementation is split between a host Compose launcher, a container scenario,
process/HTTP helpers and synthetic database fixtures. Production services and
runtime behavior are unchanged. No new dependency, migration, version, tag or
release was introduced.

## Measured recovery outcomes

The container drill passed on 2026-09-27, including a repeat with movie and TV
library fixtures. Its compact report names these six checks:

| Check | Evidence required | Outcome |
| --- | --- | --- |
| Fresh synthetic database | Empty named target, full schema, migrations, production backup exporter | Passed |
| Maintenance boundaries | Real login, unauthenticated rejection, CSRF rejection, ordinary API unavailable | Passed |
| Interrupted owner | SIGKILL after proven SQL lock wait; both probe values and movie/TV names rolled back; zero success receipts | Passed |
| Blocked normal startup | Exact expected rejection while owner is alive and after its death; unrelated crashes do not qualify | Passed |
| Explicit retry | New process restores values/names, ready gate, verification timestamp and exactly one receipt; remains maintenance-only | Passed |
| Normal restart | Real normal bootstrap reaches healthy; authenticated restore rejected with `RESTORE_MODE_REQUIRED`; no extra receipt | Passed |

The scratch containers, volumes, project network and project-local candidate image
were removed after execution. The running Classifarr container retained its image
and uptime. Build cache and downloaded base images are not globally pruned.

The drill does not infer success from an HTTP response alone. PostgreSQL confirms
the gate and receipt, and an exact blocking-session check establishes the kill
point. There are no production-only fault switches or mocked restore services.

## Validation

- Focused drill contracts: **31 tests across two suites passed**.
- Full backend coverage run: **43,832 tests across 1,472 suites passed**
  in 284 seconds; line coverage **90.38%**, branch coverage **84.49%**.
- Real PostgreSQL backup/runtime regression tests: **77 tests across six suites passed**.
- Server type checking, production/test lint, dependency checks, ESM import/mock
  checks and copyright checks passed. The existing nonliteral-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs` remains unchanged.
- The disposable production-image build includes the actual frontend build.
  There are no client-source or API-contract changes in this work.
- Coverage ratchet passed using the new backend report and the existing unchanged
  frontend report. Markdown checks and `git diff --check` passed. No coverage or
  naming baseline was relaxed. The previously documented unrelated production
  naming debt remains outside this test-tooling change.

## Failure handling and limits

The launcher refuses a pre-existing project resource, checks configuration before
assuming cleanup ownership, and bounds Docker commands. Scenario failure still
triggers teardown; teardown failure makes the command fail and reports the exact
generated project. Raw child diagnostics, tokens and backup payloads are not
included in the report. Child diagnostic buffering is bounded.

Forced termination of the host launcher or Docker daemon failure can prevent
cleanup. Inspect the exact reported `classifarr-restore-drill-...` project before
removing any leftover resources; never use a global prune to clean up a drill.

This proves current-candidate **configuration** recovery for synthetic movie/TV
libraries, not full operational-data restoration or end-to-end learning quality.
It does not yet prove recovery from a published release image, bundled PostgreSQL
upgrade, host power loss, network partition, disk damage or a lost response after
configuration commit. Existing targeted tests remain necessary for other restore
boundaries. No automatic routing or music processing is introduced.

## PR availability

GitHub MCP searches at the start and during validation returned **zero open PRs**
for `cloudbyday90/Classifarr`. A random open PR could not be selected. No closed PR
was substituted, no new PR was created, and no PR was merged.

## Recommendation and next acceptance item

Keep this drill as a fast, local recovery gate. Its advantage is repeatable,
real-process evidence without touching installations; its tradeoff is build cost
and limited synthetic coverage.

Next: a **digest-pinned published-release upgrade/recovery matrix**. Start the
supported release with disposable synthetic data through its real shell
entrypoint, export configuration, upgrade to the candidate, run interruption and
retry, then verify one movie and one TV recovery-to-learning outcome. Preserve
default routing controls and exclude music. Record exact image digests and named
outcomes so it can become a release/CI acceptance gate, not another dashboard.

Recommended stack: unit contracts → PostgreSQL regressions → this current-candidate
drill → published-image upgrade matrix. See the separate
[design, official research and option tradeoffs](restore-recovery-drill-design.md).
