# npm 12.2.2 security assessment outcome

Date: November 9, 2026 Eastern. Baseline main 76599f4de. Implemented and qualified
on main at 2d2d3b70c60572a58531eef58877231d6d637acd; subsequent delivery changes
only these outcome/design documents. See the [design](npm-12-2-2-security-design.md).

## Change and scope

Exact npm/npx 12.2.2 replaces 12.2.1 in Docker, CI, all three manifest/lock roots,
executing-version tests and the provider-fault workflow validator. Active setup
and maintenance guidance agrees. Node 24.22.1, Alpine, base digest, PostgreSQL,
pgvector, every override and install-script decision remain unchanged. The host's
global toolchain was not changed. The published beta's exception remains historical.

The archive's computed SHA-512/SHA-1 matches registry metadata. That is artifact
integrity, not independent registry-signature verification. Its 188 package.json
files contain 148 name/version instances, representing 145 unique components.
Seven bundled versions change, without added manifests or lifecycle hooks.

## Real controls

The three modular Node test suites exercise the actual executing CLI's bundle,
resolved through socks and node-gyp. All ten candidate controls pass. Old-copy
counterfactuals reproduce the parser, TLS callback, excessive-encoding, signed
manifest mismatch, cached-bin selection and literal shell-execution failures.
Old ordinary bin/peer/exit controls also pass. The parser test intercepts the
dangerous matcher before executing it; it does not consume unbounded CPU.

The controls retain string/object bins, exact argv/output, exit-13 propagation,
same-cache usability, neighboring sentinel files, valid peers and direct-conflict
refusal. Public exec/view calls demonstrate metadata refresh and offline cached
bin selection. Windows cmd and real PowerShell handle literal names/arguments;
forbidden percent/exclamation names refuse before execution. Signature-enabled
pacote accepts a real ephemeral signature and refuses name/id/version substitution
after its loopback registry closes. This is an opt-in verification API, not a
claim about ordinary npm install/view. Private patch-workdir cleanup is untested.

## Installation and application evidence

- Script-disabled npm-only lock generation changes only the three root engine
  fields. The independent Vue graph is reviewed in its own outcome.
- All three strict clean installs and complete npm ls trees pass using the real
  reviewed CLI. No peer, lifecycle-script, TLS or scanner bypass is added.
- Full development-inclusive audits: root zero, client zero, server five existing
  low findings. Those entries remain visible and unchanged.
- Dependency/tooling suite: 107 passing controls, including installer admission,
  exact npm/npx and rejection of the old executing CLI.
- Fresh backend coverage: 1,933 suites; 62,791 passing tests, one existing skip.
  All 5,319 frozen backend input hashes remain unchanged through completion.
- Fresh client coverage: 485 files, 7,547 passing tests. The combined ratchet
  passes: server statements/branches/functions/lines 89.28/86.72/90.81/89.28%;
  client 87.93/82.17/87.72/89.60%.
- Root/server/client lint and type checks, ownership review, both Knip modes,
  policy, ESM import/mock-shape and copyright gates pass. Provider workflow
  validator: nine passing controls, including rejection of npm 12.2.1.
- Client production build and eight production-browser checks pass. Broader
  browser results and unchanged baseline failures are disclosed in the
  [Vue outcome](vue-pr-583-outcome.md).

## Independent bundle scanner and remaining issues

Trivy 0.76.2 scans both installed CLI distributions against the same database,
detecting all 148 package instances/145 unique components. Its release artifact's
digest matches GitHub asset metadata and the published checksum listing; no
independent Sigstore verification is claimed. npm sbom cannot produce a valid
complete bill for the published distribution because its development/workspace
dependencies are absent. No vendor manifest or synthetic lock was added to hide
that failure; the actual installed package scan supplies the inventory instead.

The old copy reports eight findings: three high and five medium. The new copy
reports two medium findings, both also present in the old copy:

| Installed npm component | Scanner finding | Remaining assessment |
| --- | --- | --- |
| glob 13.0.6 | CVE-2026-118773 | Maintainer lists the installed version as affected; fixed in 14.0.2 or newer |
| minimatch 10.2.5 | CVE-2026-118764 | Scanner flags 10.2.5; maintainer names 10.2.6 and patch 11.0.1 |

The [Glob advisory](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4)
describes work continuing after cancellation. The
[Minimatch advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)
describes pattern amplification. The latter version-range discrepancy remains
explicit; a database hit is not proof of an exploitable application path.
Workspace overrides do not repair npm's independent bundle. No vendor patch,
scanner exception or publication acceptance is introduced.

Node's separately embedded Undici 7.30.1 remains unchanged and affected by the
six newer November 5 advisories requiring 7.30.2. This batch removes the reproduced
older defects from npm's 6.x copy; it cannot fix Node's built-in fetch or an
already published/running image. No all-transport or advisory-free claim is made.

## Frozen image and recovery evidence

One clean-source Linux x64 candidate carries Node 24.22.1, npm/npx 12.2.2 and the
same 148 npm package instances. Its local image ID is:

```text
sha256:1ccb4dba884989f2c06ffd194110339ff471594d18a91011042aa4595e03673d
```

This is a local image/config ID, not a published registry digest. All ten npm
controls pass inside that exact image, including POSIX executable handling. The
read-only test mount uses a separate executable temporary fixture filesystem;
TLS uses a host-minted ephemeral certificate through a test-only supplier.
Production image contents are unchanged by those fixtures. Native bcrypt hash,
matching and nonmatching comparisons pass. Actual image graph, scan target and
installation/routing receipts all bind to this same ID and source commit.

The full image scan reports three medium findings and no high/critical findings:
the two npm entries above plus Alpine zlib 1.3.2-r1, CVE-2026-4738, with scanner
fix version 1.4-r0. The [official zlib 1.4 release](https://github.com/madler/zlib/releases/tag/v1.4)
includes that contrib/infback9 fix and other API/security changes. Application
reachability was not established; no exception or package replacement is added.
Node separately reports its compression fork as 1.3.2.1-motley-285e94b, which
requires its own source assessment rather than inference from Alpine's package.
Compiled-in Node Undici remains 7.30.1; its newer advisory boundary is independently
known and is not cleared by this scanner's lack of a bundled-component finding.

The existing production-entrypoint installation runner passes all twelve checks,
including authenticated restore refusal/retry, interrupted restore, migration,
movie/TV recovery and real startup-scheduler progress. Published baseline:
v0.48.4-beta, revision a0e417fd714919bb4ca30e20f9cd2380136ca74e, image
ghcr.io/cloudbyday90/classifarr@sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f.
Fresh and candidate databases report PostgreSQL 180006 with 338 migrations;
the published baseline reports 222 migrations. Provenance constraints remain
enabled, using the established stored CLI login after clearing an inherited
credential override for the local invocation.

Both fresh and upgraded scenarios pass the two-CPU, 2-GiB, 128-PID budget checks,
real connection-pressure refusal/recovery and restart tests. Each unfinished
backlog retains 300 movie/300 TV items and all task identities, completes 600 tasks
with zero duplicate completions/early reclaims, and reclaims five interrupted
tasks after the original ten-minute visibility lease. No test-time lease advance
or provider/routing permission is substituted for that observation.

The same candidate also passes the existing routing upgrade/crash/retry/pause/
repair rehearsal against its separate locally built baseline eef03e57ffdd26d638f32f1593c424b438041ea2.
It records two movie/two TV GET observations, zero provider writes, preserved
history and no legacy enrollment. Installation and routing cleanup both pass.
The final v4 receipt completed at 2026-11-09T16:39:10.334Z with a clean checkout.
These are synthetic local AMD64 exercises, not native ARM64 or live-provider
quality evidence. No release, deployment or live configuration write occurs.

## Delivery, maintenance and next recommendation

All seven workflows for implementation commit 2d2d3b70c pass:

| Workflow | Exact-source receipt |
| --- | --- |
| CI/CD Pipeline | [42650233927](https://github.com/cloudbyday90/Classifarr/actions/runs/42650233927) |
| OSV Dependency Scan | [42650234818](https://github.com/cloudbyday90/Classifarr/actions/runs/42650234818) |
| Trivy Security Scan | [42650233786](https://github.com/cloudbyday90/Classifarr/actions/runs/42650233786) |
| CodeQL Analysis | [42650233700](https://github.com/cloudbyday90/Classifarr/actions/runs/42650233700) |
| Gitleaks Secret Scan | [42650233820](https://github.com/cloudbyday90/Classifarr/actions/runs/42650233820) |
| Resource Capacity Regression | [42650233751](https://github.com/cloudbyday90/Classifarr/actions/runs/42650233751) |
| Copyright Compliance | [42650233692](https://github.com/cloudbyday90/Classifarr/actions/runs/42650233692) |

CI reports 1,933 backend suites/62,791 tests and 485 client files/7,544 tests;
these are reported separately from the local Windows counts. Real PostgreSQL CI
passes 327 suites/4,142 tests, with one existing skipped suite/test, plus schema
replay and the upgrade canary. The eight production-browser and fourteen shared
form-control cases pass. Existing scanner severities, exclusions and triage
expiry remain unchanged. Passing repository scans does not supersede the separate
CLI/image findings above. No release/publication job is invoked by this batch.

Scoped maintenance verifies the same Docker daemon, protected service identities,
start times/state/health and four registered worktrees. The owned runner resources
and ephemeral certificate key are removed. No additional stale files/images meet
the established verified-removal policy; zero stale artifacts are retired.
Recovery/reference assets, current evidence, toolchains, shared build cache and
other projects remain preserved. Staged-secret and documentation checks pass.

Keep this qualified npm patch. Next assess a supported Node 24 runtime carrying
the newer Undici fixes, including the separate compression/OS findings. Then
assess a supported npm artifact resolving its remaining bundle findings; avoid
vendor-tree edits or a blanket scanner exception. Review the unchanged startup
browser contracts separately. Then choose provider-prompt evidence separately
from post-choice learning provenance; the [consumer trace](compatibility-purpose-consumer-boundary.md)
corrects the former queued-task label without changing runtime or historical
receipts. Publication qualification remains separate with fresh artifact evidence.
