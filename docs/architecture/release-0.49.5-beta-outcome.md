# v0.49.5-beta release outcome

November 24, 2026 (Eastern). Published, independently verified, and promoted
in both registries. See the [release design](release-0.49.5-beta-design.md)
and [runbook](../../.agent/workflows/release.md).

## Published identity

| Subject | Verified identity |
| --- | --- |
| GitHub Latest | [v0.49.5-beta](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.49.5-beta), immutable release 457081745, published at 12:08:31 Eastern |
| Qualified source and peeled tag | `ed97fa680c07fb525a6ad60aee99399a371b8d0f` |
| Annotated tag object | `fb3561706c7122c581014272cdadd9f757c31f5b` |
| Tagged workflow | [45437013915](https://github.com/cloudbyday90/Classifarr/actions/runs/45437013915), attempt 1, success |
| GHCR and Docker Hub version and `latest` | `sha256:7e870a1ac6ed3b67115f443b5af8f110c933b7e55dfbfb2fda4c1126d78388ad` |
| Signed v4 evidence | [v0.49.5-beta-evidence.json](https://github.com/cloudbyday90/Classifarr/releases/download/v0.49.5-beta/v0.49.5-beta-evidence.json), asset 788086518, 6,860 bytes |
| Evidence asset SHA-256 | `2e6d11c79a7e7a200e72b68f979d199ff2a95e5eb94c8b5f6e0b166728fca88a` |

The maintainer selected GitHub's full-release status for this tag so the
repository sidebar shows it as Latest. The package, UI, tag and notes retain
the beta designation. CI published the immutable release from its verified
draft. Its exact-tag condition leaves other beta releases' flags unchanged.

## Runbook checklist

- [x] Compared the release range with the previous public beta, archived the
  original development record and reviewed the consolidated changelog.
  [Changelog scope and fidelity](release-0.49.5-beta-changelog-review.md)
- [x] Aligned all three manifests and lockfiles, the UI and README labels,
  and the changelog and release notes. Structural lock comparisons identified
  version-only changes. The version validator and assembled notes review passed.
- [x] Recorded 22,338 Docker Hub image pulls at
  `2026-11-24T08:38:25.8448564-05:00`. This excludes GHCR.
  [Repository statistics](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/)
- [x] Ran strict clean installs with Node 24.22.3 and npm/npx 12.2.2. Lint,
  copyright, Markdown, dependency tooling and all three audits passed.
- [x] Ran fresh `test:ci`: 1,958 backend suites with 64,729 passes and one
  platform skip, and 491 client files with 7,739 passes. Both fresh coverage
  reports passed the ratchet. The tooling run passed 126 checks with its
  Linux-only WASI check skipped on Windows.
- [x] Rebuilt a local verification image from the qualified source. Its
  container dump matched the checked-in schema. The independent schema check
  and all four PostgreSQL startup, extension-file and upgrade smoke checks passed.
- [x] Completed the local eight-phase routing and installation checks with zero
  provider writes, the eight production-policy Chromium checks and the isolated
  provider-fault Compose run.
- [x] Completed the frozen no-cache workload, settled idle and 12 checks each
  for standard, Unraid and custom saved profiles on one local image. The runner
  verified owned-resource cleanup.
- [x] Verified immutable releases and both protected environments through
  GitHub's API. Both admit `v*` tags, and administrator bypass is disabled.
  Only one administrator was available. The workflows use the pull credential
  on verification jobs and gate publication-credential use on release paths.
- [x] Passed all eight exact-source main workflows, including source, database,
  upgrade, security, capacity and native ARM64 recovery. Pushed only the
  approved annotated tag after the local and main checks passed.
  [Main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/45411218821)
- [x] Passed the exact tag's CI, OSV, Trivy and Gitleaks runs. The publish
  chain used the versioned index, digest-only smoke, both native routing
  receipts and scheduled recovery on the tested ARM64 child.
- [x] Ran the read-only published verifier for attempt 1. It authenticated
  the immutable release and signed v4 evidence, matched the child images to
  the routing/recovery receipts, verified job results and confirmed both
  version and `latest` references in each registry at 12:11:28 Eastern.
- [x] Archived and removed the 158 approved GitHub release pages. Independently
  verified 30 remaining pages, the new Latest designation and all existing
  Git tag targets.

The tagged manual retention and pull-request-only synthetic replay jobs were
skipped. The automatic Docker Hub retention job was also skipped for this exact
release under the GitHub-pages-only cleanup scope. Both registry promotions
completed. No deployment was part of this release.

## Local evidence and security sign-off

| Check | Evidence |
| --- | --- |
| Schema, pg_stat_statements and production layer scan | `sha256:1577058ce5cbf531bb29e0430c3b5678a9af0b92d3b1f7debbf6c36aa0e0200d` |
| Installation and eight routing phases | `sha256:4138e1bcaa0f3742f03544be82b807d1d54345dd3f5032625d3ee6072433bbd4` |
| Frozen workload and saved profiles | `sha256:8f9c0fd4cb8c1e18b15400bc820faa0b24360ae86b485168d664df635aa27a80` |

The frozen fixture completed 1,600 unique items, 20 pressure-recovery items and
8 provider-recovery items. Final backlog was zero pending, failed or routing.
The sampled maximum was 475,639,808 bytes and 60 PIDs under 2 CPUs, 2 GiB and
128 PIDs. The Unraid profile used a disposable reproduction. The supported
upgrade baseline was the separately attested `v0.48.4-beta` image.

Local validation corrected a workflow-validator quoting error before freezing.
An older local provider-fault receipt was preserved when the writer refused to
overwrite it. A rerun created the fresh receipt. The first Windows tooling run
needed the existing OpenSSL installation added to the test process's PATH.
The exact-source retry passed with the normal tests and deadlines intact.

| [Security checklist](../SECURITY_CHECKLIST.md) section | Result |
| --- | --- |
| A. Automated gates | Lint, suites, coverage, copyright and all three audits passed |
| B. Route authentication | Verified central and delegated authentication and admin boundaries, including prompt and suggestion writes |
| C. Webhook authentication | Reviewed encrypted secret validation and constant-time comparison |
| D. HTTP security headers | Reviewed Helmet script CSP and explicit CORS configuration behavior |
| E. Session and token security | Verified httpOnly cookies, refresh and CSRF handling and scoped grants |
| F. Credential handling | Verified encryption and masking paths and request-log privacy regressions |
| G. Git and debug hygiene | Reviewed tracked files and production debug exposure |
| H. Sanitized errors | Reviewed production health, exception and 404 responses |
| I. Input validation | Reviewed exact IDs, parameter-bound queries and existing path controls |
| J. Runtime | Verified existing root initialization drops to the application user and shipped Compose is unprivileged |
| K. Dependencies | Zero findings in workspace audits, zero high or critical findings in the local production image scan and green tagged OSV/Trivy |
| L. Secret scanning | Full release-range Gitleaks scan and exact main/tag workflow checks passed |
| M. Password storage | bcrypt cost 12 and restricted auth response fields remain in place |
| N. Rate limits | Reviewed authentication and webhook limits and ran the request-counting regressions |

The actual local and Linux builder npm 12.2.2 resolved bundled `ip-address`
10.7.5 through `socks`. CI installed the same pin and passed its bundled
controls. The production image scan read 18 exported layers and found no
global package-manager paths. Running the exact image confirmed Node 24.22.3
and embedded Undici 7.30.2. The v0.49.4-beta npm exception was closed for this
release. Known builder-only findings remain recorded in the
[toolchain outcome](npm-12-2-2-security-outcome.md).

## GitHub release retention

After publication there were 188 release pages. The maintainer-approved
cleanup removed the 158 older pages from v0.46.2b-beta through v0.12.1-alpha.
The local ZIP preserves the original notes and release metadata. It was
opened to verify the archived JSON and rechecked after cleanup. The ZIP's
SHA-256 is
`55891acdb606af0bf2400b28fbc650a1d94abe5320a630fd2c754d413fb3d85d`.
The deletion set contained zero immutable releases, uploaded assets or linked
discussions.

A TLS handshake timeout interrupted the first pass after 62 confirmed
deletions. A fresh read confirmed the affected page still existed. The
second pass verified the remaining inventory against the archive and
removed the remaining 96 approved pages. The final list retained 30
published releases through v0.46.2c-beta, with v0.49.5-beta as Latest.

All 230 Git tag refs matched their pre-deletion targets. All five older
Docker Hub version tags retained their original digests. The cleanup used
only GitHub release-page operations. The local Classifarr container stayed
on its prior image and ran with zero restarts.
