# Container Image Provenance Attestation And Verification

## Status

Implemented on 2026-08-09 as roadmap task **10R.4.1**. The tag-release job now
attests and verifies the immutable multi-architecture manifest digest published
to both supported container registries. This adds a repository supply-chain
boundary; it does not change Classifarr runtime behavior, policy authority,
installation acceptance, or compatibility-removal status.

## Problem

A release tag previously pushed an image to GHCR and Docker Hub, but consumers
could establish only that a tag existed. Tags are mutable references and cannot
prove which checked-out source or GitHub Actions workflow produced the image.

The release job already uses a Buildx-produced manifest digest. That digest is
the immutable subject that can be signed and independently verified. The image
must be pushed before GitHub can attach a container attestation, so verification
gates successful completion of the release job and all downstream release work;
it does not claim to retract a registry push that has already occurred.

## Research Basis

- [GitHub: Using artifact attestations to establish provenance for builds](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
  requires `attestations: write`, `id-token: write`, and `packages: write` for
  container provenance; it specifies a fully qualified subject name, a
  SHA-256 image digest, `push-to-registry: true`, and `gh attestation verify`
  for container verification.
- [GitHub: Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
  recommends least-privilege workflow permissions and pinning third-party
  actions to verified full commit SHAs rather than mutable tags.
- [GitHub CLI attestation verification manual](https://cli.github.com/manual/gh_attestation_verify)
  documents repository, signer-workflow, source-digest, and hosted-runner
  identity constraints. Verification checks the signed certificate and trusted
  timestamps, rather than trusting workflow-controlled provenance metadata.
- [SLSA provenance](https://slsa.dev/spec/v1.2/provenance) distinguishes a
  verifiable statement about where and how an artifact was built from the
  artifact itself. The container digest and source revision remain separate,
  explicitly verified values.

The official `actions/attest` release was evaluated from its GitHub release on
2026-08-09. The workflow pins `v4.2.2` to
`1e69f48acb82d1966a394da916b4c1698aa569d6`.

## Options Considered

### Publish tags without provenance

Pros:

- No additional release steps.
- Simple familiar pull command.

Cons:

- A tag alone does not identify the source revision or builder.
- Consumers cannot detect a substituted image that reused a familiar tag.

Decision: rejected.

### Attest only the GHCR image

Pros:

- Covers the GitHub-native distribution target.
- One attestation and verification command.

Cons:

- Docker Hub is also an official release target and would lack an OCI-bound
  provenance statement.
- The same multi-architecture digest would have uneven consumer guarantees.

Decision: rejected.

### Selected: attest and verify each published OCI subject by digest

Pros:

- Binds both `ghcr.io/cloudbyday90/Classifarr` and
  `docker.io/cloudbyday90/classifarr` to the immutable Buildx digest.
- Uses GitHub's OIDC identity and an SHA-pinned official action.
- Verification requires the expected repository, workflow path, exact source
  revision, GitHub-hosted runner, and GitHub trust root.
- The release job fails closed before cleanup or any future deployment job can
  treat the tag as accepted.

Cons:

- The registry push must precede attestation, so a failed verification cannot
  erase a pushed manifest automatically.
- The job depends on GitHub attestation and registry propagation; it performs
  five fixed five-second attempts before failing.
- A consumer still has to verify the digest it chooses to deploy.

Decision: selected.

## Implemented Workflow Contract

`docker-release` remains a tag-only job and grants exactly:

```yaml
permissions:
  attestations: write
  contents: read
  id-token: write
  packages: write
```

`artifact-metadata: write` is intentionally absent. GitHub documents it as an
optional permission for linked-artifact inventory records, not a provenance
requirement. Leaving it absent keeps the release token limited to the
operations this job actually performs.

After `docker/build-push-action` exposes its `digest` output, the workflow:

1. attaches a GitHub build-provenance attestation to the GHCR fully qualified
   image name and digest;
2. attaches the equivalent statement to the Docker Hub fully qualified image
   name and digest; and
3. verifies both OCI digest URIs with `gh attestation verify`.

The verifier requires:

- the scoped job `github.token` as `GH_TOKEN`, which GitHub requires for CLI
  authentication;
- `--repo "$GITHUB_REPOSITORY"`;
- `--signer-workflow "$GITHUB_REPOSITORY/.github/workflows/ci.yml"`;
- `--source-digest "$GITHUB_SHA"`;
- `--deny-self-hosted-runners`; and
- the default trusted roots, which include Sigstore Public Good for this public
  repository.

The workflow writes the verified digest and the two digest-qualified OCI URIs
to the GitHub Actions job summary. It writes no credentials, Docker Hub token,
configuration, media metadata, policy data, or provider output.

`server/src/scripts/checkContainerImageProvenanceWorkflow.mjs` parses the
workflow with the server's declared `js-yaml` dependency. It rejects a missing
or reordered attestation, mutable action reference, widened permission set,
wrong subject, mutable tag input, absent verification constraint, or an
unexpected signer. The `check:release-provenance` command runs in the regular
CI build job after server dependencies are installed.

## Consumer Verification

Use the release job summary's digest rather than a tag when promoting an
image. After authenticating to the relevant registry, a consumer can verify
the exact image with the same identity constraints:

```bash
gh attestation verify \
  oci://ghcr.io/cloudbyday90/Classifarr@sha256:<manifest-digest> \
  --repo cloudbyday90/Classifarr \
  --signer-workflow cloudbyday90/Classifarr/.github/workflows/ci.yml \
  --source-digest <release-commit-sha> \
  --deny-self-hosted-runners
```

The command proves a signed builder identity and source binding. It does not
prove that an installation is healthy, that its configuration is safe, that a
policy decision is correct, or that the separate compatibility-removal track is
closed. Those boundaries retain their existing acceptance artifacts.

## Validation

- `npm run check:release-provenance --prefix server` parses the checked-in CI
  workflow and validates the exact security contract.
- `checkContainerImageProvenanceWorkflow.test.mjs` covers the accepted
  workflow, an unexpected signer, and accidental metadata-permission scope
  expansion.
- The release workflow will exercise actual OIDC issuance, OCI attachment, and
  CLI verification only on a signed `v*` tag, because pull requests and branch
  pushes must never receive release registry credentials or attestation write
  permissions.

## CI Failure Correction

The immediately preceding `CI/CD Pipeline` run
[`31288385830`](https://github.com/cloudbyday90/Classifarr/actions/runs/31288385830)
passed every server unit, server integration, client, build, and database test,
then failed at the schema snapshot drift gate. PostgreSQL 18 had rendered the
new canonical-history outcome expression index in a different but equivalent
canonical SQL form from the committed snapshot. The timestamp difference in the
reported diff was normalized by the existing dump logic; the index rendering
was the material drift.

The snapshot was regenerated through `npm run db:dump-schema`, which dumps from
the healthy Compose service and then repeats the dump with a fresh matching
PostgreSQL 18 container. `npm run db:check-schema` passed afterward. This is a
schema-snapshot correction, not a change to the history query, migration, or
container provenance contract. The next CI run must repeat the same container
drift gate before the release job can be considered accepted.

## Next Task

**10R.4.2 Published Digest Consumer Smoke Acceptance** is next once a release
candidate version and exact source revision are selected. It will pull the
published digest in the supported Compose deployment, verify the consumer-side
attestation, run bounded startup and health checks, and record the resulting
digest-qualified release evidence without accessing customer configuration or
claiming installation approval.
