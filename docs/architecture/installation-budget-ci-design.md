# Opt-in installation resource recovery in Linux CI

## Decision — September 28, 2026

Add `installation-budget` to the existing CI/CD Pipeline's manual `mode` choices.
Reuse its installation job, candidate build, published-baseline verifier and
fresh/upgrade drill. Do not add another orchestrator, deploy a container, alter
live limits, change the release version or weaken normal release gates.

This follows the successful
[local published-upgrade budget recovery](published-upgrade-provenance-diagnostics-validation.md).
The remaining gap was repeatable hosted-Linux execution and a readable report
of actual resource enforcement, not another production recovery service.

## Execution and evidence contract

| Invocation | Installation command | Other behavior |
| --- | --- | --- |
| Normal PR, main push or release-tag push | Existing `--ci` | Existing CI and release gates remain |
| Manual `mode=ci` | Existing `--ci` | Existing full validation; no tag publication |
| Manual `mode=installation-budget` | `--ci --resource-budget` | Only installation job runs; no publishing or cleanup jobs |
| Manual `mode=cleanup` | None | Existing explicitly selected tag cleanup remains |

The two installation steps have mutually exclusive fixed conditions. Dispatch
values never become shell code. A 40-minute job deadline bounds the run; no
failure is converted to success. Manual budget evidence does not substitute
for the ordinary same-run release-acceptance dependencies.

Both fresh and published-data scenarios must prove Docker configuration and
cgroup-enforced 2 CPU / 128 PID / 2 GiB limits, bounded PostgreSQL connection
exhaustion, recovery after pressure, and automatic completion of the original
inventory after a real crash. The test-only 32-connection database ceiling is
never proposed as a production default. Existing source-SHA, clean-worktree,
baseline provenance and owned-resource cleanup checks remain mandatory.

The existing v3 JSON receipt already contains actual cgroup versions and
measurements. A separate small ESM formatter now presents them in a titled
fresh-versus-upgrade Markdown table. It revalidates and reconstructs aggregate
evidence, refuses incomplete claimed passes and never includes raw probe logs,
credentials, SQL or media payloads. Missing proof is explicitly “Not verified”.
Memory/PID readings are labeled observations, not peaks or safe minimums;
counters are not subtracted across restarts. A v1 result cannot imply v2 coverage.

Only the two named JSON/Markdown files under `.tmp/ci` are uploaded, including on
failure. Explicit hidden-file inclusion supports the `.tmp` parent without
broadening the artifact to logs, fixtures, backups or arbitrary hidden files.
Retention stays 90 days. The receipt schema and existing consumers are unchanged.

## Official-source research

Sources were discovered using online search and checked on September 28, 2026.

- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax):
  use a finite dispatch choice and job-scoped least privileges. Keep
  `contents: read` and `attestations: read`; pass the job's `GH_TOKEN` only to
  the runner steps. Checkout credentials are not persisted. No write scopes,
  OIDC token, deployment environment or privileged PR trigger is added.
- [GitHub action security guidance](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats):
  retain full-SHA action pins and reviewed executable workflow configuration.
- [Artifact action hidden-file guidance](https://github.com/actions/upload-artifact/blob/main/docs/MIGRATION.md):
  hidden files are excluded by default. Include them only with an exact safe
  path list; contract tests reject a raw-directory glob or removal of this setting.
- [GitHub job summaries](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions?tool=powershell):
  retain the existing `GITHUB_STEP_SUMMARY` Markdown output so operators do not
  need to read raw execution logs to see the measured result.
- [Docker runtime metrics](https://docs.docker.com/engine/containers/runmetrics/):
  cgroup v1 and v2 expose different controller files. Report the detected version
  from validated snapshots instead of inferring it from `ubuntu-latest`.
- [W3C table captions and summaries](https://www.w3.org/WAI/tutorials/tables/caption-summary/):
  provide context and clear headers. Within GitHub's Markdown renderer, use a
  nearby descriptive heading, simple columns, units and text statuses rather
  than color-only indicators. This is not a UI WCAG conformance claim.

## Alternatives and final recommendation stack

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| Local-only drill | No additional hosted execution | Misses runner-specific cgroup and credential behavior |
| Opt-in existing CI job (selected) | Same proof and permissions; controlled cost; no duplicate framework | Requires deliberate dispatch; not continuous budget coverage |
| Budget every default CI run now | Automatic regression protection | Adds scope and timing variability to release gates before hosted evidence exists |
| Apply live limits now | Immediately bounds resource use | Recovery fixtures alone do not establish sustained capacity or safe production sizing |

Recommended stack: GitHub-hosted Linux + existing Node ESM/Compose drill +
immutable published-baseline verification + bounded PostgreSQL fault injection
+ independently verified cgroup limits + allowlisted JSON and concise Markdown.
No new dependencies, daemon, singleton service or application API is needed.

## Operator steps and next boundary

In **Actions → CI/CD Pipeline → Run workflow**, select the intended reviewed
branch and `mode: installation-budget`. Alternatively:

```sh
gh workflow run ci.yml --ref main -f mode=installation-budget
```

Review the installation job's summary and its `runtime-installation-acceptance`
artifact. Require both fresh and upgrade proof, all twelve checks and owned
cleanup to pass. If provenance is blocked, follow its safe credential-source
diagnostic; do not disable attestation verification or switch identities silently.

Equivalent local command, with the source revision set to the clean checkout SHA:

```sh
node scripts/run-runtime-installation-acceptance.mjs --ci --resource-budget
```

After hosted enforcement is verified, the next distinct resource question is
sustained mixed-workload memory behavior: add a bounded soak profile to the
existing resource study, including drain/idle observations and backlog recovery.
That can distinguish transient startup/cache use from continuing growth before
any live cap proposal. It must remain isolated and must not treat forced GC or
process restarts as evidence that a leak is fixed.

Results and limitations belong in the separate
[validation document](installation-budget-ci-validation.md).
