# Release Candidate Publication And Evidence Recording

Status: implemented release-publication automation. A specific execution is
pending an intentionally selected release tag and source revision.

## Objective

10R.4.3 makes the repository's tag workflow retain a public, bounded release
record only after the selected source revision has passed CI, produced an
attested multi-architecture image digest, and passed the 10R.4.2 consumer smoke
check. It does not deploy an existing installation, alter policy authority, or
retire compatibility code.

## Research Basis

- [GitHub immutable releases](https://docs.github.com/en/enterprise-cloud@latest/code-security/concepts/supply-chain-security/immutable-releases)
  states that published immutable releases lock their tags and assets, create a
  cryptographically verifiable release attestation, and should be created as a
  draft before assets are attached and publication occurs.
- [GitHub CLI release creation](https://cli.github.com/manual/gh_release_create)
  documents that `gh release create` can create a missing tag unless
  `--verify-tag` is supplied. It also documents draft creation, asset upload,
  prerelease metadata, and `--fail-on-no-commits`.
- [GitHub CLI release verification](https://cli.github.com/manual/gh_release_verify)
  verifies the release attestation and returns metadata about the release and
  attached assets. This is a post-publication integrity check, not a source
  build or deployment proof.
- [GitHub release concepts](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
  describes a release as the user-facing record built from a Git tag and its
  assets. The workflow never creates a release from a branch tip.

## Options Considered

### Manual release after tag CI

Pros:

- Simple for an operator.
- No release workflow implementation.

Cons:

- A local command can create a missing tag or attach evidence from another
  revision unless every flag and path is independently reviewed.
- Evidence retention is an operator convention rather than a verified contract.
- Review approval, release notes, and attestation verification can drift apart.

Decision: rejected.

### Create a public release before consumer smoke

Pros:

- The release page is available immediately after image publication.

Cons:

- Availability becomes visible before the consumer has validated the exact
  published digest.
- The required evidence asset cannot be complete before the release becomes
  immutable.

Decision: rejected.

### Selected: tag-triggered draft, evidence attachment, tag-restricted publication

Pros:

- The release record binds the tag, full source revision, equal GHCR and Docker
  Hub digest references, CI acceptance, and consumer-smoke result.
- `--verify-tag` prevents the CLI from inventing a tag, while
  `--fail-on-no-commits` rejects duplicate release publication.
- The release asset is attached while the release is a draft. The publication
  environment admits only `v*` tags, after which the release is independently
  attestation-verified.
- The workflow only records bounded evidence: identifiers, timestamps, status
  identifiers, image digests, and a SHA-256 fingerprint. It contains no
  installation configuration, credentials, titles, policy content, or provider
  output.

Cons:

- Repository administrators must enable immutable releases and configure the
  `release-publication` tag policy. The workflow can reference an environment
  but cannot prove its GitHub-side policy from source code.
- Image publication occurs before the final GitHub release record. This is
  necessary to smoke the digest, so availability communication must wait for
  the final job.
- An immutable release cannot be repaired by moving or reusing its tag. A
  failed post-publication attestation verification requires a newer corrective
  release tag.

Decision: selected.

## Implemented Contract

The `CI/CD Pipeline` tag path now has four ordered boundaries:

1. `docker-release` emits the one Buildx multi-architecture digest as a job
   output after provenance has been attached and verified for GHCR and Docker
   Hub.
2. `published-digest-consumer-smoke` runs in a separate GitHub-hosted job with
   read-only repository and attestation permissions. It accepts only the GHCR
   digest, verifies expected provenance, starts the isolated no-port Compose
   project, and uploads `published-digest-consumer-smoke` evidence for 90 days.
3. `release-candidate-publication` downloads the CI readout and smoke artifact.
   It first validates the public tag against every package and lockfile version
   and the in-app display label, including the intentional semver-safe mapping
   from `v0.47.5c-beta` to `0.47.5-c.beta`. `releaseCandidateEvidence.mjs`
   then independently validates both artifacts and their common source revision
   and digest. It writes a public-safe JSON asset, deterministic release notes,
   and an evidence SHA-256 fingerprint.
4. The same tag-restricted publication job creates a GitHub draft with the JSON
   asset, publishes it, then calls `gh release verify --format json` with five
   bounded retries while GitHub makes the immutable-release attestation
   available. Its `contents: write` permission is isolated to this final job.
   Image cleanup waits for this job to succeed.

`checkReleaseCandidatePublicationWorkflow.mjs` prevents workflow drift that
would widen smoke permissions, remove the tag-restricted environment, omit exact
artifact names, synthesize tags, skip draft creation, omit attestation
verification, or separate evidence assembly from the tag/digest inputs.

## Required Repository Configuration

Before a release tag is selected, configure GitHub immutable releases and the
`release-publication` deployment environment with a `v*` tag policy. This
repository has one maintainer and intentionally does not configure a nominal
self-review gate. Add an independent reviewer and self-review prevention if
that ownership model changes. These settings are release-administration
controls, not application configuration and not data stored in a Classifarr
installation.

## Validation

- Focused unit tests cover passed CI/readout composition, revision mismatch,
  blocked CI input, evidence-fingerprint tampering, fixed temporary output, and
  release-workflow permission/order drift.
- The CI build job runs the workflow-contract verifier before the tag workflow
  can publish an image.
- The current audit found no open pull requests and no open Dependabot alerts,
  so there was no dependency PR to implement locally for this component.

## Next Task

Select the next intentional release version and commit after release readiness
review, then run this automated tag path. It will create the release-specific
10R.4.2 evidence and release record. Active-installation evidence and 8R.36.11
compatibility-removal closure remain separate and must not be substituted into
this release record.
