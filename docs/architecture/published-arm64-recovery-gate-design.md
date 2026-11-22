# Require scheduled recovery evidence for published arm64 releases

November 22, 2026 Eastern.

The read-only rehearsal passed on the exact published `v0.49.4-beta` arm64
child. Future tagged builds will require that scheduled checkpoint recovery
result before GitHub release publication and `latest` promotion. The normal
release build must first upload the versioned image to make its digest
available to the native consumer. A recovery failure leaves those versioned
images available for investigation. [Published rehearsal](published-arm64-recovery-outcome.md)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep the rehearsal advisory | Existing release timing and retry path | A failed scheduled restart does not block the release |
| Add the check to the existing native arm64 job | Shares the verified child with routing and records a separate result | Adds the drill and one receipt to release acceptance |
| Add a separate native job | Independent scheduling and failure ownership | Repeats startup, identity resolution and image preparation |

Use the existing native arm64 matrix job. Run the fresh-only Unraid-profile
drill after routing passes and borrow the same inspected local image ID.
The amd64 matrix keeps its existing routing checks. A missing, false,
unrelated, stale or cleanup-failed receipt blocks v4 evidence assembly.
[GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
· [Workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data)

## Verification stack

1. Keep the existing attested index, raw child and image checks. Use the tag,
   source revision, digest, run and attempt from trusted CI context. Validate
   the current routing receipt before starting the scheduled drill.
   [Artifact provenance](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
   · [SLSA artifact verification](https://slsa.dev/spec/v1.2/verifying-artifacts)
2. Require the existing scheduled crash, persisted checkpoint, resumed
   backfill and verified cleanup. Publish one closed receipt for the arm64
   child, with the run attempt in its artifact name. A failed execution keeps
   a bounded failure receipt when available. The verifier compares
   the full subject against the validated arm64 routing receipt.
   [GitHub run identity](https://docs.github.com/en/actions/reference/workflows-and-actions/variables)
3. Include the receipt in the new v4 record and its fingerprint, then use
   the existing release attestation and immutable release checks. New
   promotion code requires v4. Historical v1–v3 records keep their original
   verification rules. The read-only historical rehearsal may still inspect
   a signed v3 release. Historical tags keep their own workflow definitions.
4. Test missing, mismatched and out-of-attempt evidence, plus the workflow
   wiring, before pushing to `main`. A retry of only the publication job
   cannot borrow a prior attempt's proof. Report the exact source and keep
   live tagged publication for the next separately authorized release.

The qualification concerns a synthetic container fixture. It covers no
product view and provides no WCAG conformance evidence.
[W3C evaluation methodology](https://www.w3.org/TR/WCAG-EM/)
