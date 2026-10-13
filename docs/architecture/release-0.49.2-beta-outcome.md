# v0.49.2-beta release outcome

## Status and scope

**Published and independently verified on 2026-10-13.** The maintainer requested
the complete release runbook and separately approved both security fixes below.
[v0.49.2-beta](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.49.2-beta)
is an immutable GitHub prerelease, published at **2026-10-13T16:47:35Z**.
Both registries' `latest` aliases resolve to its accepted digest. Final independent
verification completed by 16:53 UTC. Work stayed on main, without a separate branch.

Released source: `2eb62e0e2390ac837d79e0421d3ac3a1d3a8f98e`.
The annotated tag was pushed only after all pre-tag gates passed. This outcome
update follows publication and does not change the immutable tag or attribute
runtime evidence to its later documentation-only commit.
No live local, Unraid, Plex or shared Ollama deployment was changed.

Development baseline: `6c85e7938cf7ebac898a77448cc7c2d99ffaa77b`.
Previous release: `v0.49.1-beta`, source
`7d94ef136c7a4b8d77ab0f4c10e38b271bb98268`.
The remote tag and published release list were checked: `v0.49.2-beta` was unused.

## Changelog and release notes review

Reviewed the changes since v0.49.1-beta against Unreleased. The summary covers
identity mapping and consent, mixed-media/season evidence, classification recovery,
comparison incidents, scheduler/database diagnostics, embeddings, evaluation,
provider health and quotas, settings/navigation, HTTP/configuration behavior,
local rollback protection, dependencies and CI security.

The original Unreleased block is preserved verbatim in the
[development archive](../changelog/CHANGELOG-2026-10-pre-release-0.49.2.md).
Published v0.49.0-beta and older blocks were moved unchanged into the
[release archive](../changelog/CHANGELOG-2026-10-releases-through-0.49.0.md).
v0.49.1-beta remains unchanged in the root. Exact block comparisons passed;
the root remains below 300 lines after the release security fixes, with unique ordered categories
and working archive links.
Original root-relative links within historical blocks remain verbatim, with
working companion links supplied outside those blocks.

The new notes retain backup/migration requirements, stop-older-writers guidance,
explicit approval, incomplete groups, optional evaluation limits, separate
placement/learning authority, memory and quota safeguards, and the distinction
between image rollback and data restoration. No measured accuracy, speed or
leak-free claim is made. No changed system was intentionally omitted.

The publication assembler successfully selected the new notes; its local preview
uses a clearly marked placeholder, not fabricated publication evidence.
Package versions, three lockfile root records, UI, README, changelog and notes
validate as v0.49.2-beta. Lockfile changes are version metadata only.
Documentation lint and product-language audit passed before this checkpoint.

## Download milestone

Docker Hub API repository identity was checked as `cloudbyday90/classifarr`.
Observed **20,872 Docker Hub image pulls** at **2026-10-13T11:33:07.6720737Z**.
Source: [live repository statistics](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/).
README and release notes record the date/count, explicitly excluding GHCR and
not representing users or unique installations.

## Final-source validation ledger

Every result in this section targets the released source above, with a clean
checkout throughout the frozen rehearsal. Earlier interrupted rehearsals are
not counted as passes. Local Docker image IDs below are not registry digests.

| Check / command | Outcome |
| --- | --- |
| Node 24.21.0 / npm 12.2.0; root, server and client `npm ci` | Exact toolchain and committed lockfiles used |
| `npm run lint`, backend types, copyright and workflow validators | Passed |
| `npm run test:ci` | Passed: 1,819 backend suites, 57,375 tests passed and one skipped locally; 469 frontend files, 7,190 tests passed; fresh coverage ratchet passed |
| `npm --prefix server run test:integration` | 264 suites / 3,268 tests passed; one opt-in provider-fault suite skipped here and passed separately |
| Root, server and client `npm audit` | Exit 0; zero reported vulnerabilities in each |
| Version contract, archive fidelity, category order, root links, documentation lint and product-language audit | Passed; three lockfiles changed only version metadata |
| Production-policy browser and shared-form browser checks | 8 and 14 tests passed, respectively |
| Privacy / tooling / offline fault scenarios | 99 privacy tests and 42 tooling tests passed; four offline contracts and three expected negative cases passed, with zero live-provider calls |
| `test:integration:ai-provider-fault-compose` | Passed; source-bound receipt completed 12:48:02.562 UTC; owned resources removed |
| Fresh schema-container check and `docker:smoke:pgss` | Passed on the verification image below; snapshot unchanged, including the latest migration and 22 seed migrations |

The final verification image was `classifarr:release-0492-verify-2eb62e0e2`,
ID `sha256:6ecb67006b9329e4fa9faeaf8164a28228a5cf9125ed5aec152676fd15a88905`.
The schema producer used a bounded local wrapper (1 GiB, 2 CPUs, 256 PIDs,
network disabled); the pg_stat_statements wrapper used 2 GiB, 2 CPUs and 256 PIDs.
Fresh startup, missing-extension recovery, PostgreSQL 17 upgrade, included-config
diagnosis and ownership-checked cleanup passed. No live database was used.

The first final-source full CI attempt hit a 10-second frontend ESLint-config
setup timeout in `vueEventLintContract.test.js`. Its 28 cases passed unchanged
when retried, and the complete unchanged CI suite then passed without the
concurrent database integration run. No timeout, assertion or coverage threshold
was weakened. The cause of the initial timeout was not established.

### Isolated installation and routing

`node scripts/run-runtime-installation-acceptance.mjs --resource-budget` passed
at **2026-10-13T14:09:05.840Z**, using candidate image
`sha256:46c30a3dec0bc39f5dbd6491df790a17a66f863abb0cfb10e7924e5bb4728a2b`.
All 12 installation checks and eight routing phases passed, with zero provider
writes, preserved history, no enrollment of legacy tasks and verified cleanup.
The receipt was revalidated with the existing contracts; its workflow is null
because this was local evidence, not manufactured CI evidence.

Published upgrade baseline: v0.48.4-beta, source
`a0e417fd714919bb4ca30e20f9cd2380136ca74e`, GHCR digest
`sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
The separate historical routing baseline was source
`eef03e57ffdd26d638f32f1593c424b438041ea2`, local image
`sha256:44feea513c28a60da30f5c3e616811ae80fc8bf38f160b3d51d5eac076c510d9`.

Fresh and upgrade resource-budget cases passed at 2 CPUs / 2 GiB / 128 PIDs.
The original 600-second queue lease was preserved: all 600 synthetic tasks
completed, five interrupted claims were recovered only after expiry, and there
were zero early reclaims or duplicates. Connection-pressure injection released
all its connections; HTTP and new-connection recovery passed. These are bounded
observations, not a production minimum-capacity recommendation.

An initial provenance preflight stopped before owning resources. The unchanged
constrained verification and complete runner then passed; no signature, source,
digest or trusted-root requirement was relaxed. The initial cause is unknown.

### Frozen no-cache rehearsal

`node scripts/run-frozen-release-rehearsal.mjs --no-cache` passed at
**2026-10-13T15:40:05.825Z**, using one image throughout:
`sha256:e623aeb4c485e515fca3cb05e6f1731502f695b34cbac7ff69ea1b36bd66bcf1`.
All standard, Unraid-template and custom-template installation profiles passed,
including their fresh and upgrade budgets; saved template settings were unchanged.

The same-image 30-minute workload plus two-minute idle soak completed 1,600 of
1,600 unique items, with 400 evaluation rows, all pressure/provider cohorts
passing, and zero provider requests during memory pressure. Sampled container
memory peaked at 479,203,328 bytes (about 457 MiB), with a sampled PID peak of 61.
No pending, failed or routing backlog remained. These samples do not establish
production peaks, AI accuracy or long-term absence of memory leaks.

All owned rehearsal containers, volumes, networks and generated candidate tags
were removed and independently checked. The Unraid profile ran in local Linux
Docker on AMD64, not on the live Unraid host. Native published-image ARM64
verification is recorded separately below. Local logs and receipts remain ignored
under `.tmp/`; they were not published with credentials or operator data.

## Publication controls observed

GitHub reports immutable releases enabled. Both release-publication and
release-acceptance environments allow only v* tags and disallow administrator
bypass. The collaborator list contains one administrator, cloudbyday90; there
is no independent reviewer separation, and none is claimed.

The publishing and promotion jobs are tag-gated; published-image consumer jobs
have read-only permissions and do not receive registry publication credentials.
Repository secret names for the publishing token, dedicated pull token and
username exist; secret values were neither retrieved nor printed.

## Approved manual-cleanup restriction

The existing manual Docker Hub retention job accepted a cleanup dispatch from
any branch and then used the publishing token. The maintainer approved narrowing
that admission condition to `workflow_dispatch`, explicit `mode=cleanup` and
`github.ref` beginning with `refs/tags/v`. It uses the full ref so a branch named
like a release cannot qualify. The automatic tag-cleanup dependencies, manual
cleanup body and latest-plus-five retention behavior are unchanged. No cleanup
job or registry deletion was executed for verification.

The first regression run failed on the missing tag guard and acceptance of the
old condition (2 failures, 64 passes). After the patch, syntax checks, both
runtime-installation and release-publication workflow validators, and all 67
focused tests passed. Mutation coverage rejects removing the tag, event or mode
guard, using a v-prefixed branch path, or using ambiguous `github.ref_name`.
The legitimate checked-in tag-dispatch contract still passes. These are local
workflow-contract checks, not a destructive GitHub cleanup rehearsal.

The security-fix skill required independent read-only boundary investigation
and candidate review; both completed with no surviving bypass or compatibility
regression identified within this patch. Focused lint also passed. The preliminary
full suite was stopped after the approved change so it can be rerun against the
final candidate rather than treated as current-source evidence.
This is a checked-in workflow restriction, not a claim
that repository-level secrets are environment-scoped: historical tagged
workflows and a maintainer able to edit workflows are not retroactively
constrained. Broader secret migration is outside the approved patch.

## Approved diagnostic-token restriction

The security checklist found inconsistent enforcement of short-lived local
evaluation-token grants. Signature verification alone did not apply their
method-and-endpoint restrictions on the alternate JWT authentication path.
The maintainer approved fixing this before publication.

The combined authentication middleware now delegates its JWT branch to the
existing token middleware. This keeps one request-aware authorization policy
instead of copying checks into each router. Grant generation, matching rules,
ordinary session behavior, credential precedence and API-key permissions/auditing
are unchanged. No client contract, database migration or credential rotation is
required. Live deployments were not modified.

The isolated mounted-router reproduction confirmed the missing restriction before
the patch. New regression tests first produced 23 failures and 37 passes; the
patched regression and six adjacent authentication/queue suites then passed all
227 tests. They cover bearer and cookie tokens, mounted public paths, allowed
exact/prefix/template grants, denied mutations with no service calls, malformed
grants, audience checks, method/path variants, ordinary JWT access and API-key
precedence, permission checks and auditing. Credential verification is stubbed
in the new boundary tests; existing authentication-service tests cover token
generation and verification separately. No real queue or provider was used.

The security-fix skill required fresh independent boundary investigation and
candidate review. Investigation agreed with reuse of the existing middleware;
review found no concrete surviving bypass or regression and independently ran
nine focused suites (180 tests), all passing. Syntax, backend types/lint,
copyright, documentation lint, archive fidelity and version checks also passed.
The complete final-source checks subsequently passed as recorded above. The
checklist now includes this cross-path regression gate.

The first full-suite attempt also caught a test-fixture convention violation:
the new suite cleared calls without resetting mock implementations. The fixture
now resets each credential-service mock explicitly. Its regression suites plus
the repository code-health gate pass (eight suites, 34,796 generated checks).
This test-only correction does not change the authentication patch; the full
suite and image rehearsals were restarted and passed on its committed source.

Rehearsals for the preceding source were stopped when the issue was found.
Their owned synthetic containers, volumes, networks and generated candidate
images were removed and cleanup verified. Those interrupted runs are not release
passes; the complete frozen and installation rehearsals were rerun against
the committed fix. The running local container and its data remain untouched.

## Security checklist sign-off and limits

The A–N checklist was reviewed against the released source. This is a scoped
release review, not an exhaustive security audit or a claim of zero scanner alerts.

| Area | Result and qualification |
| --- | --- |
| A — Automated gates | Full lint, tests, types, copyright and coverage passed |
| B — Route authorization | Reviewed 15 admin and 10 authenticated mounts, plus routes with internal guards; the scoped-token gap was fixed and regression-tested |
| C — Webhook authentication | Secret required before body processing, encrypted storage, constant-time comparison for equal-length values; unequal lengths return false early. This is shared-secret authentication, not a per-request HMAC signature |
| D — HTTP headers | CSP script policy excludes unsafe inline/eval; CORS uses the configured allowlist. Empty configuration disables CORS response headers, contrary to the checklist's older wording; explicit wildcard remains an operator option |
| E — Sessions and tokens | HttpOnly/SameSite cookies, short-lived access tokens, refresh rotation, CSRF and cross-path scoped grants reviewed; secure cookies remain configuration-dependent |
| F–G — Credentials and debug artifacts | Encryption, log privacy and tracked-secret/debug checks passed; no real environment files or raw operator logs committed |
| H — Errors | Production health, global unexpected errors and API 404 responses reviewed; this is not a claim that every route-specific error response was exhaustively audited |
| I — Input handling | Reviewed parameterized queries, allowlisted SQL identifiers and path validation; no user-data eval path found in the reviewed scope |
| J — Runtime | Startup-root design remains acknowledged; application/database execution drops privileges; no privileged production Compose configuration; tag Trivy/OSV jobs passed |
| K–L — Supply chain and secrets | Three npm audits, OSV and Gitleaks passed; no dependency promotion or package update in release preparation |
| M–N — Passwords and limits | bcrypt cost 12, password-response filtering, and auth/setup/webhook rate-limit paths reviewed; there is no public registration route |

Trivy's filesystem HIGH/CRITICAL gate passed with its configured
`ignore-unfixed` scope. Its Dockerfile/Compose reporting job is not a failing
misconfiguration gate. The workflows contain no built-image vulnerability scan;
image provenance/runtime testing must not be described as one.

Five selected reports were statically triaged against this exact source and the
resolved root SECURITY.md, with deployment/code evidence defining the technical
boundaries. All five were **not actionable for their specific claim, high
confidence**, with no exploitability queue/rank. No alert was dismissed or edited:

| Report | Positive counterevidence and scope |
| --- | --- |
| Trivy 516 / DS-0026 | The isolated provider fixture's Compose file supplies its healthcheck; the fixed runner starts it with `--wait`. Missing Dockerfile HEALTHCHECK does not mean the supported fixture lacks a probe |
| Trivy 435 / DS-0025 | Dockerfile lines 103–114 remove the APK cache in the same RUN layer after package triggers finish |
| Trivy 434 / DS-0013 | The single-RUN pgvector directory change follows archive checksum verification and fails closed through `&&`; trusted build configuration, not an untrusted application input |
| Trivy 197 / DS-0002 | Dockerfile and entrypoint implement the checklist's acknowledged startup-root/non-root-exec design. Identity validation rejects UID/GID zero; this is not a rootless-container claim |
| New CodeQL 575 / user-controlled-bypass | `apiKeyAuth.mjs` lines 98–106 select between two credential validators. A header does not grant access: the API key is validated against active stored credentials, or the JWT is verified and scoped before `next()` |

Static triage does not prove runtime exploit resistance or assess nearby unrelated
weaknesses. The completed main CodeQL run reported 88 open alerts, including the
one new report above; the other 87 remain an existing, untriaged backlog in this
release review. They are not asserted to be confirmed vulnerabilities or false
positives. Root bootstrap exposure and repository-level publishing secrets remain
documented hardening boundaries, not silently removed risks.

## Remote checks and immutable publication

[Main CI 38424197526](https://github.com/cloudbyday90/Classifarr/actions/runs/38424197526)
passed for the exact released SHA before tagging, including same-run installation
and routing validation. Main OSV 38424198323, CodeQL 38424197548, Gitleaks
38424197499, Trivy 38424197581, resource regression 38424197512 and copyright
38424197796 also passed for that SHA.

[Tag CI 38427326395](https://github.com/cloudbyday90/Classifarr/actions/runs/38427326395)
passed on **attempt 1**, completing at **2026-10-13T16:49:47Z**. Source tests,
database integration, installation/routing acceptance, the provider-fault fixture,
multi-platform image publication/provenance, digest-only smoke, both native routing
jobs, immutable GitHub publication, both latest promotions and automatic retention
all passed. Tag OSV 38427327251, Gitleaks 38427326703 and Trivy 38427326140 passed.
CodeQL/resource workflows run on main, not tags; their same-SHA main results apply.

Manual cleanup and PR-only synthetic replay were intentionally skipped. Budgeted
installation is a manual mode and was not run by the tag workflow; both local
budgeted rehearsals passed. The general database suite's opt-in provider-fault
skip is covered by the required separate tag job. A local watcher hit a TLS
handshake timeout and reconnected; the GitHub workflow itself was not rerun.

Published multi-platform index in **both** GHCR and Docker Hub:
`sha256:4d62b4d3fb5c2fc64430424cd80f24d0c445b2176b867c864166aa17b79edac7`.

| Native platform | Selected manifest | Image/config identity |
| --- | --- | --- |
| linux/amd64 | `sha256:7da57944d48d1e52fff9d614a73e5a3b6854c89f23ccb1690c2f25caa6800d15` | `sha256:56aad66ba7eef9d8737f495bd8ce2b7ea3ee3f766756799e5f5d593d89a5d587` |
| linux/arm64 | `sha256:584c9a0000de72eb63da9b64591e58e3cb74542de5d85d113cde36b50ee813ec` | `sha256:00b7a779fe63ca245ed625958931e4cffc67e25f7fbadcbd5f931928bcb9b4d8` |

Both native receipts contain all eight routing phases, two movie GETs, two TV
GETs, zero provider writes, preserved history, no legacy enrollment and passed
cleanup. Their recorded workflow identity is run 38427326395 / attempt 1.

The attached [v3 evidence asset](https://github.com/cloudbyday90/Classifarr/releases/download/v0.49.2-beta/v0.49.2-beta-evidence.json)
is 5,512 bytes with SHA-256
`228ed16c1edbbb1c3fa9662efa874dae051cd9d86df4e1972885486d6b9aab94`.
Its internal evidence fingerprint is
`sha256:15c48ecbaa987fb98350dce5141f4aaba2ef66df138621c97bc76e43b5a66c74`.
The published release body exactly matches the deterministic assembler's reviewed
notes plus generated evidence (11,051 bytes after trimming the final newline).

Independent verification passed using `gh release verify`, `gh release
verify-asset`, and `gh attestation verify` for the asset and both OCI subjects.
Verification retained the expected repository, signer workflow, source tag,
source commit, SLSA provenance predicate, default public trusted roots and denial
of self-hosted runners. Existing evidence/routing validators were called with
the independently observed digest, approved SHA and exact run/attempt, including
freshness and cleanup checks; no GitHub environment variables were fabricated.

`SOURCE_TAG=v0.49.2-beta node scripts/promote-release-images.mjs` passed in its
default **read-only** mode, independently verifying release authority, registry
graphs, provenance and both current aliases. An initial attempt stopped during
the Docker Hub current-alias lookup; direct inspections and the unchanged full
retry passed. Its cause was not established, and no verification rule was bypassed.
No manual registry write or release mutation was performed. Cross-registry
promotion is not atomic; this run verified successful completion in both.

Automatic retention removed **only Docker Hub's v0.48.2-beta tag** at 16:49:44 UTC;
the tag endpoint subsequently returned 404. The newest five version tags and
latest remain. The same old digest's GHCR index and all four child manifests were
verified available; no restore, republish or downgrade was attempted. GitHub
releases and GHCR tags were not deleted. Docker Hub's aggregate count briefly
lagged its returned tag list and was not used as proof of deletion.

## Deployment and next work

No deployment is included in this release. Final local inspection still showed
the original image `sha256:ee519a81497550072ea47931930b952739a53079313d580900b087e9ab0ce397`,
started at `2026-10-13T11:19:07.952958521Z`, healthy, zero restarts and no OOM kill.
Unraid, Plex and the shared Ollama service were not modified.

Next: separately authorize deployment and capture installation evidence for the
actual target, preserving a consistent backup and the current rollback image.
Then triage the existing CodeQL backlog and reconcile the checklist's outdated
CORS/constant-time wording with the actual implementation. These are explicit
follow-ups, not claims that this release performed them.
