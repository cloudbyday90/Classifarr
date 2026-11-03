# v0.49.4-beta release outcome

Date: 2026-11-02; publication completed 2026-11-03 UTC.
Status: published, independently verified, both registry aliases accepted.
Design: [release qualification](release-0.49.4-beta-design.md).
Runbook: [release workflow](../../.agent/workflows/release.md).

## Published identity

| Subject | Verified identity |
| --- | --- |
| Immutable prerelease | [v0.49.4-beta](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.49.4-beta), release 432125400, published 2026-11-03T00:44:11Z |
| Qualified source and peeled remote tag | ef5b50ed1b1d24c9407f669eb11b4c35646bc620 |
| Annotated tag object | 205168be727072b2066fd9db0ca593e8833a5f53 |
| Tag workflow | [41549155570](https://github.com/cloudbyday90/Classifarr/actions/runs/41549155570), attempt 1, success |
| GHCR and Docker Hub version/index/latest | sha256:21d75a2940ffaa49aabc9ec94bad9e44cbb1b8dc7ba8b4a7f1689126146eacc2 |
| Public v3 evidence | [v0.49.4-beta-evidence.json](https://github.com/cloudbyday90/Classifarr/releases/download/v0.49.4-beta/v0.49.4-beta-evidence.json), asset 703721715, 5,512 bytes |
| Exact asset SHA-256 | e785c7f235abe393c69ab1fe5d6b3983db2345ed05f69f664f87284cc61b032b |

The tag remains bound to the qualified source. This outcome and the README
publication marker are a documentation follow-up on main; they do not change the
released source, image, immutable asset or tag. No release was created manually.

## Preparation and CI/CD repair

Main began clean at 46ba1290dfb644293b657f77021c7716b3a89dc1. The changelog
consolidation was committed separately as bfc4a67c4; its
[review record](release-0.49.4-beta-changelog-review.md) covers system coverage,
historical fidelity and navigation. Candidate preparation f9d753267 aligned all
package/lock/UI/README/notes/changelog versions without initially resolving new
dependency artifacts. The approved CI/security follow-up produced the final
qualified source above. The root changelog retains a fresh Unreleased section.

Repeated database CI failures came from ten legacy fixtures attempting TRUNCATE
through immutable capture guards. The shared test-only helper now deletes
restrictive dependants and History through the supported cascade lifecycle.
Production guards, schema and runtime SQL remain intact. The coherent glob
14.0.3/minimatch 11.0.4 development graph fixes the demonstrated cancellation and
expansion regressions in both workspaces. See the separate
[CI/security outcome](release-0494-ci-security-outcome.md) for lock review,
old-failing controls, consumer tests and scanner triage.

Docker Hub reported exactly 21,997 image pulls at 2026-11-02T21:04:30.4829176Z
from [its repository endpoint](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/).
README/notes retain that dated observation. It excludes GHCR and does not count
unique installations or establish a growth rate.

## Fresh qualification

All local gates below use the committed final source. Private raw receipts remain
under .tmp and are not release assets.

| Gate | Result |
| --- | --- |
| Version contract, strict installs and dependency trees | Passed with pinned Node 24.22.1/npm 12.2.1 and reviewed installer policy |
| Full lint, documentation, copyright and dependency controls | Passed; 97 dependency checks |
| Fresh combined test:ci | Passed: backend 1,927 suites / 62,405 tests; client 484 files / 7,521 tests; coverage ratchet passed |
| Complete isolated integration | Passed: 323 suites / 4,084 tests; repaired fixtures and immutable lifecycle guards included |
| Production browser | Fresh build, 8/8 Chromium checks passed |
| Synthetic provider fault | Local explicit Compose runner and fresh source-bound tag receipt passed |
| Schema and embedded PostgreSQL | Dump/check unchanged; four extension/preload/upgrade-path startup smoke scenarios passed |
| Local installation and routing | Same-image fresh/upgrade checks and all eight routing phases passed; cleanup passed |
| Frozen no-cache rehearsal | Thirty-minute workload plus settled idle and standard/Unraid/custom saved profiles passed on one image; cleanup passed |
| Exact-source main workflows | CI 41531574314, CodeQL 41531573975, Gitleaks 41531573976, OSV 41531575061, copyright 41531574032, resource capacity 41531574046 and Trivy 41531574272 all passed |
| Exact tag workflows | Full CI 41549155570, Gitleaks 41549155479, OSV 41549155789 and Trivy 41549155518 all passed |
| Published consumers | Digest-only health/readiness smoke and native AMD64/ARM64 routing passed |
| Publication and promotion | Attested immutable prerelease, both original-digest latest aliases and existing automatic Docker Hub retention passed |

Backend coverage: statements/lines 89.25%, branches 86.65%, functions 90.80%.
Client coverage: statements 87.90%, branches 82.04%, functions 87.69%, lines
89.57%. These are fresh combined reports, not earlier development receipts.

The local Windows unit run skips one Linux directory-fsync case; the exact-source
Ubuntu CI explicitly passed it. Default integration skips the opt-in provider-
fault Compose case, covered by the separate explicit runs. The tag's optional
policy synthetic replay and manual retention job were correctly skipped; neither
is reported as passed. Its required automatic retention job passed.

### Distinct local image subjects

| Rehearsal | Exact local image ID |
| --- | --- |
| Schema and PostgreSQL smoke | sha256:a08d46a2c1fef15c6170d7ab195658f1da1d01eb141c92b31fcd557afc889550 |
| Installation and eight routing phases | sha256:79f3ec65a30d29b26c930f1fe64c3d4098cb9ad69ce509ef17da95b5c82bc509 |
| Frozen soak and all three saved profiles | sha256:89b3bb7995ac20c406444541855b4a50a4c5f381c43eb33d8f2701e34c02e358 |

The frozen subject was independently observed while running and compared with
the completed receipt. Under 2 CPUs / 2 GiB / 128 PIDs, it completed 1,600/1,600
unique items, 20/20 pressure-recovery items and 8/8 provider-recovery items. Final
backlog: 1,972 completed, zero pending/failed/routing. Sampled container peak was
514,367,488 bytes (490.54 MiB), CPU p95 1.12037 cores, event-loop p99 maximum
79.495 ms and peak 61 PIDs. These bounded synthetic observations are not an
instantaneous-peak, production-capacity or long-term-leak guarantee.

The supported installation baseline is the separately attested v0.48.4-beta
source a0e417fd714919bb4ca30e20f9cd2380136ca74e and digest
sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f.
It is not a claim about the current NAS. A saved Unraid profile rehearsal is not
an inspection or deployment of the live Unraid installation.

## Independent published evidence verification

The release API reports draft=false, prerelease=true and immutable=true.
Independent gh release verify, verify-asset and attestation verification passed.
The exact downloaded bytes match the API's size and SHA-256. Evidence and both
OCI index attestations were checked against cloudbyday90/Classifarr,
.github/workflows/ci.yml, the approved source and refs/tags/v0.49.4-beta, using
public trusted roots and rejecting self-hosted signers. One initial local GHCR
verifier initialization failed; an unchanged sequential retry passed. No trust
setting, credential store or network configuration was weakened.

Production validators accepted the v3 evidence with the independently supplied
index, source, tag, run 41549155570 and attempt 1. Both embedded routing receipts
exactly match the separately downloaded current-run artifacts. Each passed all
eight phases with two movie GETs, two TV GETs, zero provider writes, History
preservation, legacy non-enrolment and successful cleanup. Their native manifests
are AMD64 sha256:0b04fc37352ec4d75aba8f26da75b044c99c104b2574fb67c29715ea6445842a
and ARM64 sha256:ce630c865a15fb063c6c74271ab3ac80dd091207e005b50342b92aea6059db23.
The provider-fault fingerprint also matches its independent artifact.

After automatic promotion passed, the existing promotion verifier ran locally
without --write. It verified immutable release authority, provenance, hashed
indexes and every child including attestation manifests in both registries, and
rechecked the aliases. Its dry_run_passed result was additionally checked to
require both observed previousDigest values equal the released index. This
establishes both latest aliases actually advanced; a dry run alone would not.
Registry writes remain non-atomic as documented; this completed run has no
remaining partial promotion.

## Security checklist sign-off

Reviewer: Codex, source review and automated verification; no independent human
reviewer is claimed. Scope: the qualified source and described rehearsals.

| Section | Verified outcome |
| --- | --- |
| A: automated gates | Fresh lint/tests/coverage/audits/copyright and exact-source checks passed |
| B: route authentication | Central/delegated admin, authenticated and scoped-token boundaries reviewed; regressions passed |
| C: external authentication | Stored encrypted webhook secrets validated; constant-time comparison retained |
| D: HTTP headers | Helmet script CSP retained; configured CORS origin/credential behavior reviewed |
| E: sessions/tokens | httpOnly/lax cookies, request-aware HTTPS, refresh rotation, CSRF and scoped grants retained |
| F: credentials | Encryption, masking and logging/privacy controls retained |
| G: Git/debug hygiene | Checked tracked-file patterns contain no credentials, environment secrets or logs |
| H: errors | Production health, exceptions and API 404 responses remain sanitized |
| I: input/injection | Fixed parameterized SQL and path controls reviewed; no user-data eval/Function path introduced |
| J: runtime | Existing root-init/embedded-PostgreSQL design acknowledgement retained; tag scans and startup rehearsals passed |
| K: supply chain | Zero high/critical workspace audit findings; exact scoped CNA triage below; npm exception below |
| L: secrets | Exact-source main/tag Gitleaks green; changed files reviewed |
| M: passwords | bcrypt rounds 12 and sanitized authentication responses retained |
| N: rate limiting | Auth/sensitive-write limits and real window-reset controls retained |

Full workspace audits report root/client zero, server five low wrapper records
from the single officially rejected deepmerge advisory; production server/client
audits report zero. Directory-local server OSV triage covers only
GHSA-gcqx-w48m-w2h4 and expires 2026-11-09, citing the immutable CNA rejection. Real
scope and expiry negative controls pass. Audit database lag remains disclosed;
this triage is not a package fix and must not silently extend.

The maintainer explicitly accepts the separate moderate npm 12.2.1 bundled
ip-address 10.7.2 finding for v0.49.4-beta only, conditional on all other gates.
Fresh inspection of the published AMD64 image physically resolves that copy
through npm's socks dependency and the separate application copy to 10.7.4.
The advisory remains active; no remediation or unreachable-path claim is made.
Subsequent releases require a published, verified repaired npm bundle. See the
[design's official sources](release-0.49.4-beta-design.md#explicit-one-release-residual-risk-decision).

## Controls, housekeeping and next work

Fresh pre-tag checks confirmed immutable releases enabled and both release
environments restricted to v* tags without administrator bypass. No required
reviewer rule exists in this single-owner repository; secret names were checked
without exposing values or inferring token capabilities. The invalid inherited
GitHub token override was omitted only in agent processes; stored credentials
and persistent environment were not altered.

Artifact checks used the same desktop-linux daemon. At handoff, the three
pre-existing containers and five worktrees remain; the local Classifarr identity,
image, start time and healthy state match intake. Owned runners removed their
disposable resources. Current receipts, models, toolchains, archives, rollback/
release images, backups, shared cache/volumes and other projects were preserved.
The intermediate inventory measured 13.43 GiB; no unreviewed stale artifact or
generic prune was applied and no storage saving is claimed. Published-image
inspection used an isolated, read-only, network-disabled disposable container.

First security follow-up: verify and adopt the published npm repair before any
subsequent release, and revisit the rejected-advisory triage before its expiry.
For classification work, follow the
[settled next step](source-pair-publication-admission-outcome.md): obtain fresh
read-only Unraid revision/schema and saved automatic purpose-evaluation status.
Distinguish undeployed capability, absent choices, gaps, stale/deferred/failed
work before changing classification logic. If capability is undeployed, prepare
a separate deployment-readiness recommendation. Prioritize a demonstrated
disagreement once evidence is available, using existing application surfaces.
No additional speculative fencing, dashboard or routine operator CLI is proposed.

No live Unraid cleanup, restart, migration, deployment or provider operation was
performed. Release publication does not establish classification accuracy or
repair historical labels.
