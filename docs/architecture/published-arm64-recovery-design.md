# Scheduled crash rehearsal for a published arm64 image

November 22, 2026 Eastern.

The native branch workflow exercises a locally built image. The published
`v0.49.4-beta` evidence includes a native manual-routing crash and restart.
The scheduled ingestion checkpoint and backfill are a different workload.
The published image already includes that fixture and can run it without
rebuilding. [Published beta evidence](https://github.com/cloudbyday90/Classifarr/releases/download/v0.49.4-beta/v0.49.4-beta-evidence.json)
· [Native branch qualification](native-arm64-recovery-outcome.md)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Verify the published manifest and existing routing receipt | Fast, with no additional container run | Leaves the scheduled crash case unobserved |
| Run the existing scheduled drill on the exact published child | Direct native evidence for the released artifact | Requires a native runner and disposable container run |
| Add the case to the publication gate | Would require this evidence of every future release | Changes release acceptance and needs a separate policy decision |

Use a separate, read-only GitHub Actions dispatch from `main` for the
historical beta. This builds no images and uses no production data. The
same workflow can be used for a later immutable release with compatible
fixtures. Keep existing publication and promotion gates independent.
[Workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
· [Least-privilege workflow permissions](https://docs.github.com/en/actions/reference/security/secure-use)

## Verification stack

1. Require a clean exact `main` checkout and native Linux arm64. Record the
   harness revision and GitHub run and attempt independently of release source.
2. Resolve the release tag using the existing immutable GitHub release and
   evidence verifier. It checks the release signature, signed asset digest,
   expected workflow, source revision, and release-tag ref. Use only the
   verified evidence's GHCR index digest as the input to image resolution.
   [GitHub release asset verification](https://cli.github.com/manual/gh_release_verify-asset)
   · [Artifact provenance verification](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
3. Verify the index signature and raw bytes. Select exactly one native arm64
   manifest, check its bytes and referenced config, and pull that exact child.
   Run the borrowed inspected image by ID. Record index, manifest, config and
   local ID separately. [OCI Image Index](https://specs.opencontainers.org/image-spec/image-index/)
4. Run the existing fresh-only Unraid-profile crash drill and reuse the branch
   workflow's recovery validation. Keep its synthetic data, startup and
   PostgreSQL safeguards, exact crash boundary and owned resource cleanup.
   Record only bounded evidence. Keep the borrowed image in the disposable
   runner's image store until GitHub retires the VM.

The result covers one published child and the scheduled crash fixture.
The workflow exercises no web interface or accessibility conformance claim.
[W3C evaluation scope](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
