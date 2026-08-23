# Release-Candidate Evidence Attestation

Status: implemented for the next tag-triggered release. The intended next tag
is `v0.48.2-beta`; this document does not create that tag, modify package
versions, or publish a release.

## Outcome

The generated public release-evidence JSON is now a separately attested build
subject. `release-candidate-publication` creates a SLSA provenance attestation
with the pinned `actions/attest` action, then verifies the exact local JSON
file before `gh release create` can make a release draft.

Verification fails closed unless the attestation:

- belongs to this repository;
- was signed by this repository's `CI/CD Pipeline` workflow;
- is bound to the tag workflow's source revision and exact `refs/tags/v*`
  source reference;
- has the SLSA provenance-v1 predicate; and
- was produced on a GitHub-hosted runner rather than a self-hosted runner.

The GitHub release asset is the same file that was attested and verified. This
adds signed provenance and byte-level integrity for the public evidence JSON;
it does not expand the evidence itself. In particular, the v2
provider-fault-receipt semantic SHA-256 fingerprint remains the sole
provider-fault detail retained in that asset.

## Design

```text
validated CI + provider-fault receipt + digest smoke
                      |
                      v
         assemble bounded v2 evidence JSON
                      |
                      v
        actions/attest: signed SLSA provenance
                      |
                      v
 gh attestation verify: repo + workflow + tag + SHA + hosted runner
                      |
                      v
  create immutable-release draft with the verified JSON asset
```

`server/src/scripts/checkReleaseCandidatePublicationWorkflow.mjs` treats this
ordering as a security contract. It requires the pinned attestation action,
only `attestations: write`, `contents: write`, and `id-token: write` at the
publication boundary, the exact evidence path, verification constraints, and
verification before release creation. Focused tests mutate those properties to
ensure workflow drift is rejected before tag CI can execute.

No artifact-storage record or generic CI-log attestation is created. The JSON
is the only subject, so the permanent trust record has the same intentionally
small surface as the public release asset.

## Research Basis — August 2026

- GitHub's [artifact attestation guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
  documents `actions/attest`, `subject-path`, and the required `id-token: write`,
  `contents: read`, and `attestations: write` permissions for file provenance.
  This publication job already needs `contents: write` to make the immutable
  release; it does not add any broader token scope.
- The official [`actions/attest` action](https://github.com/actions/attest)
  documents that the default file-subject mode creates SLSA build provenance
  and persists the signed attestation through GitHub's attestation API.
- The [GitHub CLI attestation verifier](https://cli.github.com/manual/gh_attestation_verify)
  documents exact repository, signer-workflow, source digest, source ref,
  predicate, and hosted-runner constraints. Explicitly supplying them avoids
  accepting a different workflow or an attestation for the same file from a
  different source context.
- GitHub explains that [artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
  establish cryptographically signed provenance using Sigstore. For public
  repositories, GitHub uses the Sigstore Public Good instance; therefore the
  verifier retains its default trusted roots and does not use `--no-public-good`.

## Options Considered

### Upload the evidence JSON only

Pros:

- No additional workflow permissions or verification call.
- The immutable release still protects the uploaded asset after publication.

Cons:

- Does not establish how the asset was built before it is attached.
- Cannot independently bind the file to the release workflow and source
  revision.

Decision: rejected.

### Generate an attestation but do not verify it in the publisher

Pros:

- Consumers can perform a later manual verification.
- Smaller tag-workflow change.

Cons:

- A delayed, missing, or mis-scoped attestation does not stop release
  publication.
- The publish step could attach evidence before the provenance requirement is
  known to be satisfiable.

Decision: rejected.

### Selected: attest then verify before the release draft

Pros:

- Adds independently verifiable, signed provenance to the public asset before
  the immutable release is created.
- Pins the exact repository, workflow, source revision, tag reference,
  predicate type, and hosted-runner trust boundary.
- Uses a narrowly scoped, SHA-pinned GitHub action and five bounded lookup
  retries for attestation-service propagation.
- Retains no new provider data, local evaluation reports, credentials, CI logs,
  or broad artifact subject.

Cons:

- Requires `id-token: write` and `attestations: write` in the already
  release-authorized job.
- Introduces a GitHub attestation-service dependency and up to 20 seconds of
  bounded retry delay.
- File provenance is an integrity and build-origin control, not a substitute
  for the existing acceptance, provider-fault, consumer-smoke, or human
  release-readiness controls.

Decision: selected.

## Final Recommendation Stack

1. Preserve the local deterministic and disposable provider-fault evaluation
   layers for diagnosis; never attach their raw reports to a release.
2. Require the clean-host provider-fault receipt, image provenance, and
   published-digest consumer smoke before evidence assembly.
3. Assemble bounded v2 public evidence, including only the receipt's semantic
   fingerprint and fixed pass metadata.
4. Attest and verify that one JSON file against its exact tag workflow before
   release creation.
5. Create the immutable draft, attach the verified asset, publish, and verify
   the separate GitHub release attestation.
6. Before `v0.48.2-beta` is intentionally tagged, complete the existing
   version-update and release-readiness procedure; do not bypass this workflow
   with a local `gh release create` command.

## Next Recommended Item

Prepare the `v0.48.2-beta` release candidate only after this work is reviewed:
update the documented package/UI/release-note versions together, run the full
local readiness suite, and let the tag workflow exercise the complete evidence
and attestation chain. Do not create the tag as part of this implementation
change.
