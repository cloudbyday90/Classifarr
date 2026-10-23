# v0.49.3-beta release outcome

## Status

**Published and independently verified.** The maintainer selected v0.49.3-beta
on 2026-10-23 and requested the full [runbook](../../.agent/workflows/release.md).
See the [design](release-0.49.3-beta-design.md) for scope and safeguards.
The maintainer initially held publication and requested a fix/official research,
then explicitly accepted the npm finding for **v0.49.3-beta only** on October 23
and requested continued publication. **This finding must be fixed before the next
release.** No other security or release gate was waived. The complete runbook,
native consumers, immutable release/asset signatures and both registry aliases
passed. Publication is not a deployment: no live deployment, VM operation or
provider recovery was performed.

Development baseline: `0025d37802cf2c0c997f0d4819e617c6f68106ca`, initially
clean and synced on main. Previous published source:
`2eb62e0e2390ac837d79e0421d3ac3a1d3a8f98e` (v0.49.2-beta).
The remote version was unused before tagging. Released source:
`2fcf07bdc35e93bbe2f480b3268b15466f16e012`, clean and synced on main throughout
qualification. Annotated tag object: `def775a4ac1a7d27b37e6c639c677536eab922d1`.
Only that tag ref was pushed. This post-publication outcome update is documentation
only; it is later than the released source and is not part of the qualified image.

- [Immutable prerelease](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.49.3-beta),
  release ID `421904918`, published **2026-10-23T13:55:46Z**.
- [Tag CI/CD run](https://github.com/cloudbyday90/Classifarr/actions/runs/39958944483),
  attempt **1**, completed successfully; no workflow rerun or tag replacement.
- Published index in GHCR and Docker Hub:
  `sha256:aa1113480538fd9554cc57aaee30aaf6b576fd13b4b6f8dcf60d3ae25abd9978`.
  Both version tags and both `latest` aliases independently matched this digest
  at **13:58:29Z**, with provenance and complete graphs verified read-only.

## Changelog and release notes

The new [development archive](../changelog/CHANGELOG-2026-10-pre-release-0.49.3.md)
preserves the original Unreleased block. The root summary covers classification
checks/repair/retry, automatic same-ID recovery, background AI controls/readiness,
gateway routing/history/provider operations, archives/catalogs/cleanup, bounded
resource handling and synthetic studies, on-demand VM preparation, scheduler
diagnostics, dependencies, CI and security. Historical archives remain reachable.
Exact comparisons against the baseline passed: the archived block is verbatim,
published changelog blocks and prior release notes are unchanged, all three
lockfiles differ only in root/package version fields, categories are uniquely
ordered and local links resolve. Root changelog length is 285 lines. The actual
publication-note builder selected the new section in a preview explicitly marked
as containing no publication evidence. Documentation lint (2,360 files, zero
errors), product-language audit and the version contract passed. An archive EOF
blank-line lint error was resolved with a footer outside the preserved block;
the historical text itself was not edited.

Notes retain backups, four normal application migrations, stop-old-writers
guidance, preserved attempts/source evidence, ordinary admin-session repair
requirements, fresh-install evaluation defaults, optional gateway activation,
source runtime minimums, private-upstream/network limits and incomplete VM/study
work. No production speed, accuracy or leak-free claim is made.

## Docker Hub milestone

Live API response identity matched `cloudbyday90/classifarr` and reported
**21,344 Docker Hub image pulls** at **2026-10-23T10:05:08.8108181Z**.
Source: [Docker Hub repository statistics](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/).
README and release notes use that observation/date and explicitly exclude GHCR
and unique users/installations. The research connector could not retrieve this
JSON endpoint; a direct read-only HTTPS request to the runbook-provided URL
verified its repository identity and non-negative integer count.

## Verification ledger

| Gate | Observed status |
| --- | --- |
| Pinned Node 24.22.1 / npm 12.2.1 | Versions verified; no global tooling change |
| Three strict lockfile installations | Fresh `npm ci` on the released source passed: root 79, server 630 and client 295 packages installed; lockfile differences are version metadata only |
| Version contract and lockfile metadata review | Passed; version metadata only, no dependency-graph changes |
| Archive fidelity, categories, links, docs/language checks | Passed on the released source; original archive and earlier published history preserved |
| Fresh lint, full CI and coverage ratchet | Passed on the released source locally and in hosted tag CI; Linux 1,880 backend suites / 60,385 tests and 477 frontend files / 7,371 tests passed |
| Root/server/client and separate CLI audits | All four dependency trees validate; workspace audits 0 each, separate CLI audit exit 1 with one moderate, no high/critical |
| Candidate-image schema dump/check and pg_stat_statements | Passed with the same local verification image and isolated data; schema unchanged, all four startup/recovery smoke cases and cleanup passed |
| Production-policy browser and isolated provider-fault checks | Eight local production-policy checks passed; dedicated local and tag provider-fault runners passed, owned cleanup required |
| Local installation/routing receipt | Passed with resource budgets, 12 installation checks, eight routing phases, zero attempted provider writes and cleanup; local-only, not signed publication evidence |
| Complete frozen no-cache image/soak/profile matrix | Passed: same-image soak plus standard, Unraid-template and custom profiles; all 12 checks per profile, fresh/upgrade budgets and cleanup |
| Exact candidate main CI/security checks | Main run 39937290047 passed; applicable CodeQL, resource-capacity, OSV, Gitleaks and Trivy checks passed on the exact source; tag OSV/Gitleaks/Trivy also passed |
| Manual security checklist A–N | Completed bounded Codex-assisted review on the exact source; findings and limits below, not an exhaustive audit or independent human signature |
| Final live publication controls and credential scope | Immutable releases enabled; both protected environments tag-only `v*`, admin bypass false; registry-secret names present, publication credentials scoped to tag-writing jobs |
| Approved exact source and npm exception | One moderate finding accepted for v0.49.3-beta only; every subsequent release blocked until remediation; no other gate waived |
| Native AMD64/ARM64 published routing and digest consumers | Both native jobs passed on the exact published index, each with eight phases, zero attempted provider writes and cleanup; consumer smoke passed |
| Attested v3 asset, immutable release and aliases | Independently verified release/asset signatures, source/tag/run/attempt, fresh v3 record, two-registry graphs and exact version/latest aliases |

The existing migration/upgrade fixtures pin v0.48.4-beta, not the latest release.
They cannot be described as explicit v0.49.2-to-v0.49.3 upgrade proof. Separate
gateway ledgers/services are optional and are not ordinary application migrations.

Full CI included the existing preflight, types, policy gates, backend/frontend
coverage, ESM static/mock-shape checks and unchanged coverage ratchet. Local
Windows preflight had two symlink-privilege skips; backend omitted one Linux
directory-fsync case. Hosted Linux logs confirm those native cases passed, with
zero backend skips. Local frontend count was 7,374; both main and tag Linux logs
report 7,371, so these are recorded separately. Ordinary database CI passed
292 suites / 3,789 tests, with the separately gated provider-fault case omitted;
the dedicated tag provider-fault job then passed. No threshold, timeout, assertion
or installer decision was relaxed. Local coverage: server 89.18% statements/lines,
86.47% branches, 90.75% functions; client 87.79% statements, 81.84% branches,
87.50% functions, 89.47% lines. An additional 59 tooling and 196 focused
authorization/log-privacy tests passed. The PR-only synthetic replay and manual
cleanup jobs were intentionally skipped, not counted as passed release gates.

Development-inclusive audits were refreshed at 12:58–13:01 UTC on October 23.
These counts apply to the three application scopes and separate private CLI
prefix, not every historical tool or base-image layer. Host-global and retained
historical tooling were not changed. The live application remained untouched.

## Image, rehearsal and published evidence

These are separate artifact identities; a local image is not the published digest:

| Evidence | Exact identity and result |
| --- | --- |
| Local schema/pgss verification image | `sha256:9ccd377ee9119b6e58955245a056b77e23b61f2984a4fc2f38119e912e081113`; exact source, Node 24.22.1 / Alpine 3.24.3 / npm/npx 12.2.1 |
| Local budgeted installation | `sha256:6516f18371cdebd1a757d8f2c9d9215cb8aafc23a70661289dd16bac2fb5fdb4`; source and image independently bound to Buildx history; completed 10:59:09.995Z |
| Frozen no-cache candidate | `sha256:30233fb1e2f2c87dbe1e0a9f13ddc2daf31da2355e5c806097a7f0422230ce38`; Buildx `nka5shvrg81y8698qsf27b81n` confirms exact source and `NoCache=true` |
| Frozen receipt | Completed 13:05:06.762Z; SHA-256 `41946e3b77efe1dfce672d36bb159f789b663e20d22d4edf1f1252ac07102989`; existing soak/budget contracts independently reapplied |
| Tag installation receipt | Candidate `sha256:9c6eb9c35c080b751271de414f5e7bf49d2c90648b56b3096f5ab562281f9f77`; current run/attempt and trusted downstream needs-output validated independently; completed 13:19:03.213Z |
| Public evidence asset | `v0.49.3-beta-evidence.json`, asset ID `669286934`, 5,512 bytes, schema v3; SHA-256 `6e420f3f5bf8bad089844638c967b177c30dd1fe48bb2b19adab2c3bbb59f220` |

The frozen soak ran 30 minutes plus two minutes settled idle under 2 CPUs / 2 GiB /
128 PIDs: 1,600/1,600 unique inventory items, pressure recovery 20/20 and provider
recovery 8/8; pending/failed/routing backlog zero. Sampled peak was 481.11 MiB and
63 PIDs, with zero OOM, memory-limit or PID-limit hits. All three profiles preserved
the same image and database assertions: PostgreSQL 180006, historical baseline
222 migrations, fresh/candidate 330. Owned fixtures and candidate tag were cleaned
up, independently checking final container/volume/network inventory. This is local
synthetic evidence, not a production SLA, long-term leak verdict, AI accuracy test,
four-arm interference study or actual Unraid-host qualification.

Two incomplete frozen attempts were retained separately, not counted as full
matrix passes. The first failed fetching the pinned pgvector archive with curl35
TLS unexpected EOF. The second passed its soak but stopped at signed baseline
preflight; its generic verification failure has no confirmed cause. The unchanged
baseline preflight later passed. The entire third no-cache rehearsal passed; no
TLS, integrity, signature, source/signer constraint or trusted root was bypassed.

The public v3 asset was generated at **13:55:32.291Z** in tag run
`39958944483`, attempt `1`. Independent checks downloaded the actual immutable
asset, compared its API size/digest, ran `gh release verify`, `gh release
verify-asset`, and verified its SLSA attestation with the exact repository,
signer workflow, tag ref and source SHA, denying self-hosted runners and retaining
default public trusted roots. Verified statements bind the annotated tag object,
asset hash and exact workflow invocation; signatures alone are not correctness
proof. The existing v3 and routing validators were reapplied with caller-owned
source/run/attempt and the digest from trusted workflow output, not asset claims.
Provider and consumer summaries also matched their same-run raw artifacts.

| Native routing | Completed UTC | Platform manifest digest | Config / pulled image identity |
| --- | --- | --- | --- |
| Linux AMD64 | 13:55:03.614Z | `sha256:d8d1211f2e1a908df88d1dee1187b2237640d1d4959e498460a8a1328353b04f` | `sha256:dcbfe329cb7ebb313470314142ecc3bf361ee73908903b5a479c1223f4f7795d` |
| Linux ARM64 | 13:55:02.169Z | `sha256:aea6fd281bfb96e4010cdeced3e41dab16451760015cc068841c1884f1b310a1` | `sha256:69a70aa9ff00b731b99e552793dae804ffa1908bffbf4b59648545699cede487` |

Each native receipt contains all eight routing phases, zero attempted provider
writes and successful cleanup, within the six-hour freshness limit. Their exact
manifest/config identities were independently compared with both registry graphs.
The published consumer smoke passed at 13:50:01.963Z; dedicated provider-fault
receipt passed at 13:39:06.139Z. Neither is operator deployment or model-quality
evidence. Raw local logs remain ignored intermediates, not committed payloads.

The promotion receipt completed successfully with both registries `verified`,
advancing the original index from
`sha256:4d62b4d3fb5c2fc64430424cd80f24d0c445b2176b867c864166aa17b79edac7`.
Independent read-only authority/provenance/graph checks confirmed both version
tags and `latest` aliases equal the new digest; this was not merely a successful
dry-run flag. Registry updates are not atomic; no partial failure occurred here.
Normal workflow retention deleted Docker Hub tag `v0.48.3-beta` after successful
promotion, keeping the newest five tags plus `latest`. No tag undelete mechanism
was verified; no GHCR deletion, manual cleanup dispatch or live data deletion ran.

## Security checklist and operational limits

The bounded A–N review was completed on the exact released source before tagging:

- Automated lint/tests/coverage/ESM/security checks passed. All 15 admin and 10
  authenticated route mounts retained their guards; sensitive queue operations
  require ordinary admin sessions and reject API-key/scoped-token access.
- Webhook secret authentication precedes parsing/queue work and uses encrypted
  storage plus constant-time comparison; this is not payload-signing HMAC.
  Helmet/self-only script CSP, configured CORS, HTTP-only SameSite cookies,
  short-lived access tokens, rotating hashed refresh tokens and CSRF checks remain.
- Credential storage/projections and URL/log sanitization were reviewed and
  tested; generic production 5xx/stack boundaries remain. No tracked credentials,
  environment secrets, raw operator reports or debug artifacts were introduced.
- Changed input contracts and bound SQL values were reviewed; no production
  eval/new Function match. Entrypoint privilege drop, root-owned code, nonprivileged
  production Compose, bcrypt cost 12 and authentication/webhook limits remain.
- Gitleaks scanned all 200 commits since v0.49.2-beta with zero findings. Workspace
  audits were zero; the separate npm moderate is the sole accepted exception.

This was not an exhaustive repository security scan or independent human review.
The configured Trivy filesystem/secret/config scan passed; it is not a complete
runtime-image vulnerability scan or advisory-free-image claim. Live controls were
rechecked immediately before tagging: immutable enabled; `release-publication`
and `release-acceptance` each allow only `v*` tags, admin bypass disabled. The only
collaborator is owner/admin cloudbyday90, so no reviewer separation is claimed.
Registry-secret names were observed; values/token capability settings were not
fetched or claimed verified. Read-only consumers receive no publication credentials.

Local CLI monitoring had transient API connection failures; the final watch and
independent MCP run metadata both confirmed overall success. Saved CLI identity
was retained, with only the previously authorized invalid environment override
omitted process-locally; no credential, network or persistent configuration change.
No test, signature or freshness gate was relaxed to recover monitoring.

The existing local application remained container `560a828dc212`, original image
`sha256:82a6025389df3ebfddb4ff47f4ee7f375cd7281e0d66b8b903c0acd733154baa`,
running healthy with zero restarts and no OOM after publication. No live Compose
replacement, appdata/database attachment, live provider request or VM power/network
operation was performed. Deployment still requires a separate decision and backup.

## Remaining npm finding

The server's `ip-address` override is 10.7.4; npm 12.2.1 separately bundles
10.7.2. The [moderate advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5)
affects that CLI copy, including files retained in the production image.
The fresh registry/release review identified no newer patched npm candidate.
No scanner suppression or vendor patch was applied. The maintainer initially
held publication, then explicitly accepted the residual finding for
v0.49.3-beta only. The affected files remain; no remediation or claim of
non-exploitability follows from that decision. The runbook and Unreleased block
every subsequent release until an actual fix and fresh verification are recorded.

### Official-source research and bounded experiments

- The parser maintainer's [advisory and patch](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-rxp7-6hxx-x8q5)
  identify 10.7.4 as fixed. npm's [published 12.2.1 release](https://github.com/npm/cli/releases/tag/v12.2.1)
  explicitly includes 10.7.2; the [current upstream lockfile](https://github.com/npm/cli/blob/52f30938bd372dac25667f38fb771f5fe825e6e6/package-lock.json)
  still uses 10.7.2. No supported patched npm release was verified.
- A disposable consuming project with an exact 10.7.4 override installed npm's
  actual 10.7.2 bundle and retained the moderate finding. The lock-only command's
  initial zero count did not prove the subsequently unpacked bundle safe.
- Updating a copied npm package directory with scripts disabled, development
  dependencies omitted and workspaces disabled failed with E404 for unshipped
  `@npmcli/docs`. Its complete 1,969-file inventory remained unchanged except
  the generated diagnostic log. Neither experiment changed the active CLI.
- A 64-MiB bounded regression probe replaced the legacy matcher with a refusing
  sentinel rather than performing expensive work. Four line-terminator classes
  reached it four times in 10.7.2 and zero times in the released 10.7.4 control.
  Legitimate zoned/CIDR and canonical IPv6 controls passed. This was a comparison
  against a patched control, not proof of a remediated active CLI.
- npm's [documented bundle exception](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#overrides)
  and [repair implementation](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/arborist/build-ideal-tree.js)
  advise updating the bundling package. The supported path is a refreshed npm
  release, followed by exact adoption and qualification. A private package overlay
  would be a downstream distribution change; it was not approved or applied.
- Live GitHub MCP queries found related open issues
  [#10120](https://github.com/npm/cli/issues/10120) (bundled overrides) and
  [#9949](https://github.com/npm/cli/issues/9949) (installed npm manifest).
  [#10062](https://github.com/npm/cli/issues/10062) was closed October 14 after
  the earlier refresh to 10.7.2. Exact advisory/CVE, 10.7.4 and description searches
  found no public npm issue/PR specifically tracking this remaining advisory;
  search absence is not proof that no private or unindexed report exists.

No issue or comment was created. npm's current bug template expressly excludes
dependency-CVE-only bump requests, and its security policy directs vulnerability
reports privately; the requested public report could not satisfy that required
declaration. No private message was sent. Sanitized investigation evidence was retained
separately; raw package/debug output and temporary dependency trees are not
published in the repository. The original issue remains present in the active
CLI. No remediation or clean-image claim is made.

## Next item

Publication is complete. Before the next release, remediate the npm finding across
the relevant toolchain/image copies and verify closure; this is mandatory, not a
recommendation to reuse the exception. Any private upstream report needs its own
reviewed channel/payload approval. After a verified release, resume the bounded
representative-refresh investigation; retained VM fixture cleanup and the
isolated archiving comparison still require their separate safeguards/authority.
