# Installation-budget CI validation

## Scope — September 28, 2026

Implementation follows the
[opt-in Linux CI design](installation-budget-ci-design.md).
It changes workflow selection, evidence upload and summary presentation only;
no production service, schema, routing setting or live resource limit changes.

## Checks

Focused validation passed: 7 suites / 187 tests, including workflow mutation
tests and budget-summary rejection tests. Actionlint, server/client lint and
type checks, Markdown checks, static ESM imports, strict mock-shape checks,
migration naming, copyright, dependency and ownership preflight all passed.

The full backend suite passed: 1,522 suites / 45,914 tests. No pre-existing
validation failures remained in these checks.

The checks cover fixed dispatch conditions, unchanged release gates,
least-privilege tokens, both fresh/upgrade budget receipts, malformed or missing
counters, readable cgroup v1/v2 summaries and bounded artifact paths.

## Clean local execution

Tested implementation: `e9e5554025d86d8ee951e520442ca911ab72afd6`.

```sh
node scripts/run-runtime-installation-acceptance.mjs --ci --resource-budget
```

The invocation supplied the expected HEAD SHA and used the intended stored CLI
login after removing an invalid inherited `GITHUB_TOKEN` only from the local
test process. An initial attempt failed provenance verification before creating
containers; its receipt correctly remained blocked with no budget measurements.
The cause of that attempt was not established. A direct verifier invocation
and one unchanged full retry succeeded without weakening trust constraints or
automatically switching credentials.

The successful receipt identifies a clean checkout, all twelve required checks,
separate fresh/upgrade budget proof and completed owned-resource cleanup.
The candidate image was
`sha256:78616bdbe75544e158f3d3e2075268ee6cfd9da3a24c9533e004049a651aefd1`.
The verified baseline's 222 migrations advanced to 296 on PostgreSQL 18.6.

| Local measurement | Fresh | Published-data upgrade |
| --- | --- | --- |
| Actual cgroup during pressure / after restart | v1 / v1 | v1 / v1 |
| Verified limits | 2 CPUs / 128 PIDs / 2 GiB | 2 CPUs / 128 PIDs / 2 GiB |
| Connection rejection / remaining injector connections | SQLSTATE 53300 / 0 | SQLSTATE 53300 / 0 |
| Connection pressure held | 5.000 s | 5.001 s |
| New connection and HTTP recovery | 0.031 s | 0.034 s |
| Restart readiness | 6.267 s | 6.288 s |
| Backfill completion after readiness | 31.978 s | 27.416 s |
| Memory observation during pressure | 296.09 MiB | 281.58 MiB |
| PID/thread observation during pressure | 66 | 66 |

All four snapshots per scenario had zero memory-limit events, OOM kills and PID
denials. Original inventory backfill completed, music stayed excluded and routing
tasks remained zero. These point readings are not peaks or production sizing
evidence. The isolated project's containers and volumes were absent afterward.

## Hosted Linux execution

The opt-in profile was dispatched against the same implementation commit:
[installation-budget run](https://github.com/cloudbyday90/Classifarr/actions/runs/36484050332).
It passed. The ordinary installation step was skipped, the budgeted step ran,
and every other job (including release acceptance, publication and both cleanup
jobs) was skipped. Artifact upload succeeded and contained exactly the two
bounded receipt files, not a directory of test data.

Downloaded evidence was checked against the implementation SHA, clean-checkout
flag, all twelve required results, passed cleanup, and regenerated Markdown from
the validated JSON. Actual runtime used cgroup v2 throughout both scenarios.

| Hosted measurement | Fresh | Published-data upgrade |
| --- | --- | --- |
| Actual cgroup during pressure / after restart | v2 / v2 | v2 / v2 |
| Verified limits | 2 CPUs / 128 PIDs / 2 GiB | 2 CPUs / 128 PIDs / 2 GiB |
| New connection and HTTP recovery | 0.038 s | 0.047 s |
| Restart readiness | 5.708 s | 5.695 s |
| Backfill completion after readiness | 27.623 s | 54.329 s |
| Memory observation during pressure | 296.70 MiB | 276.15 MiB |
| PID/thread observation during pressure | 66 | 66 |

Both scopes held 16 injector connections for 5 seconds, observed SQLSTATE 53300,
released all injector connections and completed original-inventory backfill.
No sampled memory-limit event, OOM kill or PID denial occurred. This is a real
hosted enforcement/recovery pass, not a sustained-load benchmark.

## Additional CI findings

The separate [ordinary CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/36484018832)
passed 190 database integration suites / 2,184 tests (one suite/test skipped),
then failed the release-schema replay comparison. The reported difference is
the serialized `reset_inventory_tmdb_observation_clocks` trigger at catalog line
9131. No migration, schema snapshot or comparison rule was changed in this patch.
The budget profile's success does not override that release blocker.

The [OSV scan](https://github.com/cloudbyday90/Classifarr/actions/runs/36484019670)
also reported two medium-severity advisories against the existing overridden
`ip-address 10.4.0`. The user explicitly approved a separate dependency fix:
advance the existing server override and lock entry to `10.5.1`, without changing
rate-limit settings or adding a production dependency. The new ESM tests target
the affected package methods and real HTTP limiter behavior. No reachable
application SSRF exploit was established through the inspected limiter caller.

Before the update, 11 regression cases failed and 18 controls passed; all 29
focused tests passed after it. A clean production-only installation resolved one
patched copy and passed classifier/limiter controls; the production npm audit
reported zero vulnerabilities. Independent read-only investigation and candidate
review found no concrete surviving package bypass or caller regression.

After the dependency update, the full backend suite passed again with 1,523
suites / 45,945 tests. The database-backed API-key route suite passed all 33
tests, including rate limiting. Server/client lint/typecheck and the ESM,
mock-shape, copyright, dependency and ownership checks also passed again.

The dependency fix was pushed as `c9e4e3bf`. Its
[new OSV run](https://github.com/cloudbyday90/Classifarr/actions/runs/36485824253)
passed without advisory suppressions. The hosted budget measurements above
remain explicitly tied to the earlier `e9e55540` implementation; they are not
silently relabeled as a test of the later dependency commit.

Upstream's [link-local advisory](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-rpw4-54j3-4h4q)
and [NAT64 advisory](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-2vr4-cq9g-pvrc)
identify `10.5.1` as patched. The former corrects range membership; the latter
classifies the entire operator-local NAT64 range as private, rather than guessing
an embedded IPv4 address. Tests include boundaries, alternative spellings and
adjacent negative controls. Endpoint trust policy and proxy configuration stay
unchanged.

## Follow-up priority

First reconcile the release-schema trigger difference using matched PostgreSQL
versions and catalog evidence. Determine whether the difference is structural
or serialization-only before changing the snapshot or comparator; do not
silence the gate or broadly strip parentheses. Then add the bounded mixed-load
soak described in the design to study sustained memory/backlog behavior before
proposing live CPU/PID limits.

The subsequent [trigger replay correction](inventory-observation-trigger-replay-validation.md)
reproduces the serialization difference on one server and restores catalog
agreement with a forward migration. The
[sustained observation outcome](sustained-resource-observation-validation.md)
records the subsequent mixed-load/idle work separately from these hosted results.

## PR availability

The GitHub MCP search for open PRs in `cloudbyday90/Classifarr` returned none.
There is no open PR to select randomly or implement locally. No PR was merged.

## Operational boundary

No release, tag, live rebuild or deployment is part of this change. Isolated
test resources retain the existing ownership-checked cleanup. Local generated
evidence stays ignored under `.tmp`; only allowlisted receipts are CI artifacts.
