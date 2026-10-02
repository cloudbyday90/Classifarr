# Release Readiness Audit

## Status

Audit date: 2026-10-02.

Do not cut a release yet. The complete no-cache, frozen-image, three-profile
rehearsal now passes, including all six interrupted-backfill cases. Sustained
resource evidence, actual saved-template operator acceptance and the supported
upgrade floor remain release decisions. See the separate
[crash-window design](crash-boundary-window-design.md) and
[passing outcome](crash-boundary-window-outcome.md). The
[earlier failed rehearsal](frozen-release-rehearsal-outcome.md) remains historical
evidence; its exact cause was not retroactively proven by the new pass.

The newest published release, including prereleases, is `v0.48.4-beta`
(2026-08-29). Root, server and client package manifests remain `0.48.4-beta`.
GitHub's non-prerelease `releases/latest` endpoint instead returns
`v0.48.0b-beta` (2026-08-09); do not use that endpoint as evidence of the newest
beta. This work changes neither versions nor release tags.

This audit separates three decisions that must not be conflated:

1. publish a tested source revision as an image;
2. accept one deployed installation; and
3. close the separate compatibility-removal maintenance track.

## Historical 8R.36.11 Evidence

The August audit recorded a launcher run that produced a fingerprint-valid
`policy.storage_closure_validation_evidence.v3` artifact with all four fixed
checks passed: focused tests, server lint, scoped Markdown lint, and the full
server suite. The same run correctly returned blocked after writing explicit
diagnostic artifacts because the supplied completion audit has no replay-valid,
approved active-installation removal evidence.

This is not a product runtime failure. Native policy conversion and normal
automation remain available. It prevents only an unsupported claim that the
compatibility-retirement work is complete.

That historical artifact was not rerun or renewed by this release rehearsal.

## Current Acceptance And Remaining Work

Source `a56e3f0f05b16520356837fb655df6b2f0323e38` passed
[CI/CD run 36993068277](https://github.com/cloudbyday90/Classifarr/actions/runs/36993068277),
including ordinary fresh/published-upgrade acceptance, database tests and the
release readout. CodeQL, Gitleaks, OSV, Trivy, copyright and the resource-capacity
workflow also passed for that source. Local backend unit validation passed
1,616 suites and 49,451 tests, with one existing skip.

That same clean source produced one no-cache image,
`sha256:4871ab61fd473f436e2b03bdc73b30e4a059d0a78f7710e0d70a61b1768567ea`,
which passed the complete standard, Unraid-style and custom-ID matrix at
`2026-10-02T11:35:06.615Z`. Every saved configuration remained unchanged.
Each of six 600-item backlog cases completed exactly once with five expired-claim
reclaims, 605 starts and no early reclaim. Owned cleanup passed. Later
documentation-only commits do not replace this image-tested source identity.

These are distinct from the heavier local rehearsal. Ordinary CI installation
acceptance uses the standard, non-budgeted profile. The manually dispatched
installation-budget mode and automatic capacity smoke are not a long soak or
proof that all three saved deployment profiles passed one image.

Release blockers and scope decisions, in order:

1. Run a bounded sustained workload and recovery soak, checking CPU throttling,
   memory growth, PID/connection limits, queue progress and return to idle.
   Point-in-time snapshots cannot establish peaks or minimum requirements.
   Reuse the existing soak runner's fixed-image input within the frozen-candidate
   lifecycle; do not combine unrelated image results into one acceptance claim.
2. Accept operator flows on an actual saved Unraid/Community Apps installation,
   including unchanged settings, imports, recovery and clear accessible status.
   A Linux container with Unraid-style IDs is not physical Unraid certification.
3. Define the supported upgrade floor. The pinned published baseline is
   `v0.48.4-beta`; older versions, including the non-prerelease latest label,
   require separate evidence if included in the release promise.
4. Select the version and freeze the final source; repeat applicable checks
   after version/runtime changes. Verify supported architectures and immutable
   published digests through the protected publication/consumer workflow only
   after an explicit release decision.

Recovery completion means import plus metadata. Optional AI/embedding jobs must
not prevent completion, and provider correctness/AI accuracy remain separate
evaluation work. The compatible maintenance worker uses the current OS/database
identity; it is not full privilege separation or authorization to take over an
unknown historical writer.

## Release Decisions

### Publish A New Version

Required before creating a new `v*` tag:

1. Choose the release identifier and update the root, server, and client
   package versions together with the README release label and the dated
   changelog heading.
2. Merge the exact release candidate to `main` and require the corresponding
   `CI/CD Pipeline` run to pass repository validation, isolated database
   acceptance, and the `policy-release-acceptance-readout` artifact.
3. Confirm the GitHub security workflows and Dependabot alert queue for the
   release revision. The audit found zero open Dependabot alerts on 2026-10-01;
   that is a point-in-time result and must be checked again before tagging.
4. Create the matching `v*` tag only after the accepted commit is known. The
   tag workflow blocks image publication unless the release-acceptance job
   passes, then publishes the multi-architecture image.
5. Pull and smoke-test the published immutable image digest in the supported
   Compose deployment before communicating availability.

### Accept A Deployed Installation

Required after deployment, before claiming a particular installation is
accepted:

1. Run the manual `Release Installation Evidence` workflow from the deployed
   source revision with its immutable image digest and bounded change reference.
2. Dispatch that workflow from the exact deployed `v*` tag. GitHub's
   `release-acceptance` environment is configured with a `v*` tag policy and
   administrator bypass disabled. This single-maintainer repository has no
   required-reviewer policy; it is a tag-restricted execution boundary, not an
   independent approval gate.
3. Download the CI and installation artifacts and assemble the installation
   readout. Capture an aggregate operator-decision metric only when a
   same-scope, same-duration baseline exists; otherwise retain
   `not_applicable`.

### Close Compatibility Removal

This is **not** a prerequisite for publishing a normal product image. It is
required only before declaring Phase 8R compatibility retirement complete or
removing further compatibility code. Obtain an approved, fingerprint-valid,
replayable active-installation completion-audit artifact through the deletion
workflow, then rerun 8R.36.11 and the generated 8R.34 and 8R.35 audits.
Neither historical JSON nor a local Docker Compose state can replace this
artifact.

## Supply-Chain Status

**10R.4.1 Container Image Provenance Attestation And Verification** is
complete. The tag workflow now creates and verifies GitHub build provenance for
the immutable multi-architecture digest published to GHCR and Docker Hub. It
uses a SHA-pinned `actions/attest` action and grants only `attestations: write`,
`contents: read`, `id-token: write`, and `packages: write`. Verification pins
the expected repository, signer workflow, source revision, GitHub-hosted runner
boundary, and GitHub trust root. See [Container Image Provenance Attestation
And Verification](container-image-provenance-attestation-and-verification.md).

**10R.4.2 Published Digest Consumer Smoke Acceptance** is now implemented.
Once a version and source revision are selected, its digest-only runner pulls
the exact published digest, verifies it from the consumer boundary, and runs an
isolated supported-Compose smoke and health check. Do not treat provenance as a substitute for
CI acceptance, protected installation approval, or compatibility-removal
closure.

**10R.4.3 Release Candidate Publication And Evidence Recording** is now
implemented. Tag CI validates the accepted source and smoke evidence against
one image digest, attaches a bounded JSON evidence asset to a draft release,
publishes through the tag-restricted `release-publication` environment, and
verifies the resulting immutable-release attestation. GitHub immutable releases
and the environment's `v*` tag policy are configured administrative controls.
See [Release Candidate Publication And Evidence
Recording](release-candidate-publication-and-evidence-recording.md).

## Recommendation Stack

1. Treat the final CI release-readout artifact as the publication gate for the
   exact tagged source revision.
2. Treat protected, fingerprint-bound installation evidence as the deployment
   acceptance gate for one installation.
3. Keep compatibility-removal closure separate and fail closed until its
   approved evidence chain exists.
4. Require the 10R.4.1 provenance verification and 10R.4.2 consumer-side
   digest smoke to pass for every release tag. Retain their 10R.4.3 bounded
   evidence asset in an immutable release record before communicating a selected
   release as available.

Administrative controls were rechecked on 2026-10-01: both
`release-acceptance` and `release-publication` allow only `v*` tags, disable
administrator bypass and have no required reviewer. Immutable releases are
enabled. These controls do not by themselves prove candidate acceptance or an
independent human approval.

## Research Basis

- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
  explains that provenance is useful only when consumers verify it and that it
  identifies the workflow, repository, commit, and triggering event.
- [GitHub build provenance guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
  documents the required permissions and digest-bound container attestation.
- [Node.js child process documentation](https://nodejs.org/api/child_process.html)
  documents direct `spawn()` argument arrays, `shell: false`, and
  `windowsHide`; the closure launcher uses those settings.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) recommends
  integrating secure development practices into the SDLC to reduce software
  vulnerability risk and impact.
