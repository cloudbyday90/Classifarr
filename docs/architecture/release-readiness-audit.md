# Release Readiness Audit

## Status

Audit date: 2026-08-09.

Classifarr is not yet ready to cut a new public tag because no target version
or final source revision has been selected and accepted in CI. The current
public beta label is `v0.47.5c-beta`; package manifests use
`0.47.5-c.beta`.

This audit separates three decisions that must not be conflated:

1. publish a tested source revision as an image;
2. accept one deployed installation; and
3. close the separate compatibility-removal maintenance track.

## Current 8R.36.11 Evidence

The current launcher run produced a fingerprint-valid
`policy.storage_closure_validation_evidence.v3` artifact with all four fixed
checks passed: focused tests, server lint, scoped Markdown lint, and the full
server suite. The same run correctly returned blocked after writing explicit
diagnostic artifacts because the supplied completion audit has no replay-valid,
approved active-installation removal evidence.

This is not a product runtime failure. Native policy conversion and normal
automation remain available. It prevents only an unsupported claim that the
compatibility-retirement work is complete.

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
   release revision. The audit found zero open Dependabot alerts on 2026-08-09;
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
2. Ensure GitHub's `release-acceptance` environment is protected with required
   reviewers, appropriate branch or tag restrictions, and self-review
   prevention where supported. The workflow file names the environment but
   cannot verify its repository-side protection settings.
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
