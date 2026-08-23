# Provider-Fault Receipt Release-Evidence Binding

## Outcome

New release candidates emit `classifarr.release.candidate-evidence.v2`. Before
the immutable GitHub release is created, the publication job downloads the
already validated `ai-provider-fault-compose-receipt`, validates it again, and
binds its canonical SHA-256 fingerprint into the public release-evidence asset.

The permanent asset retains only this fixed summary:

- receipt completion time;
- `passed` outcome and status;
- receipt schema, test-contract, and source-revision identifiers; and
- a SHA-256 fingerprint of the receipt's canonical six-field JSON object.

It does not retain the short-lived receipt artifact, logs, prompt or provider
data, test endpoint, container/project name, port, queue data, database data,
or fixture content. A failed, malformed, expanded, or source-revision-mismatched
receipt fails evidence assembly and therefore prevents release publication.

Existing immutable v1 release-evidence records remain valid for read-only
verification. The ESM builder creates only v2 records, so the new binding is
required for every future tag release.

## Design

```text
provider-fault CI job
  -> fixed, 14-day receipt artifact
          |
          v
release-candidate publication job
  -> downloads receipt by exact artifact name
  -> exact-schema + passed + source-revision validation
  -> canonical SHA-256 receipt fingerprint
          |
          v
v2 public release-candidate evidence asset
```

`scripts/lib/aiProviderFaultComposeReceipt.mjs` owns receipt validation and
canonical fingerprint creation. `scripts/lib/releaseCandidateEvidence.mjs`
owns the v1/v2 compatibility boundary and a strict allow-list for every public
evidence object. The release workflow contract verifier rejects a publication
path that omits the exact receipt download or assembler input.

The fingerprint is semantic rather than a transport-byte checksum: validation
normalizes the six allowed receipt fields in fixed order before hashing. Thus a
trusted artifact transport cannot change the binding merely by reformatting
JSON, while any field change produces a different fingerprint.

## Research, Options, and Decision

GitHub documents that workflow artifact uploads expose SHA-256 digests, and
that artifacts can be used to pass data between jobs
[Store and share data with workflow artifacts](https://docs.github.com/actions/configuring-and-managing-workflows/persisting-workflow-data-using-artifacts?azure-portal=true).
GitHub also supports attestations for build artifacts and independent
verification through its artifact-attestation guidance
[Using artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations).
SHA-256 is specified by NIST's [Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final).

### Keep the receipt only as a 14-day workflow artifact

Pros:

- smallest implementation;
- no public change to release evidence.

Cons:

- evidence of the gate expires before an immutable release's normal lifetime;
- later reviewers cannot bind the public release record to the exact receipt.

Decision: rejected.

### Attach the full receipt to every GitHub release

Pros:

- receipt remains available with the release asset;
- easy to inspect manually.

Cons:

- duplicates operational CI evidence permanently;
- makes future receipt-field changes public release-asset compatibility work;
- unnecessarily widens the permanent evidence surface.

Decision: rejected.

### Selected: v2 bounded summary with canonical SHA-256 fingerprint

Pros:

- permanently binds the passing gate to the tag, source revision, and public
  evidence fingerprint;
- validates the source receipt twice without copying operational data;
- v1 release assets remain readable while v2 fails closed on unknown fields;
- uses a small pure ESM module rather than adding a release singleton.

Cons:

- the short-lived source artifact is still needed to reproduce a fingerprint
  during its retention window;
- a SHA-256 fingerprint is an integrity binding, not a signed provenance
  attestation by itself.

Decision: selected.

## Final Recommendation Stack

1. Run deterministic offline fault scenarios before any Docker work.
2. Run the disposable local provider-fault Compose test for recovery changes.
3. Require the clean-host receipt gate before publishing candidate images.
4. Bind the passed receipt's canonical fingerprint into v2 public release
   evidence, alongside CI acceptance and published-digest smoke evidence.
5. Keep real model-quality sweeps local and excluded from release assets.

## Next Recommended Item

Add a GitHub artifact attestation for the generated release-candidate evidence
JSON and verify that attestation before `gh release create`. This would add
signed, independently verifiable provenance for the public evidence asset;
keep the bounded receipt fingerprint unchanged and do not attest raw CI logs or
the temporary receipt artifact.
