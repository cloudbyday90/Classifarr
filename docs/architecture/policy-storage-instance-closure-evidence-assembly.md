# Policy Storage Instance Closure-Evidence Assembly

## Purpose

The storage-closure workflow already has separate producers for completion and
validation evidence. Operators should not have to hand-create the current
closure or requirement-audit JSON that consumes those artifacts. This 8R.36.10
component assembles both artifacts from one selected checkout and the existing
fingerprint-valid inputs.

Assembly is read-only. It does not generate removal proof, execute validation,
write files inside the service, mutate storage, run Git, use Docker, contact a
media server or provider, or depend on a policy or library name.

## Research

- [SLSA Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
  requires verification against expected values and a matching artifact digest.
  The assembler accepts established evidence contracts and leaves their
  fingerprint validation to the existing consumers.
- [SLSA Verification Summary Attestation](https://slsa.dev/spec/v1.2/verification_summary)
  requires an attestation subject to match the artifact digest. One assembly
  call feeds the exact same current-closure artifact into the requirement audit
  rather than reconstructing a detached summary.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports repeatable security practices. A small orchestration boundary makes
  the repeatable closure sequence observable without weakening its gates.

## Options

### Continue Manual Intermediate Assembly

Pros: no additional contract.

Cons: easily mixes a current checkout with stale intermediate JSON and makes a
repeatable evidence sequence needlessly operator-dependent.

### Re-run Validation And Reconstruct Missing Removal Evidence

Pros: fewer command-line inputs.

Cons: combines evidence production with evaluation and could manufacture a
false sense of complete closure. Rejected.

### Read-Only Artifact Assembly

Pros: one command generates coherent current-closure and requirement-audit
artifacts, retains existing fingerprint and replay verification, and remains
platform-agnostic.

Cons: valid completion and validation evidence are still required inputs.

## Recommendation Stack

1. Accept only existing completion-audit and validation evidence.
2. Build the current-closure audit once and pass that exact artifact to the
   requirement audit.
3. Fail closed without output by default when either audit is incomplete.
4. Permit output of blocked artifacts only through `--allow-blocked`.
5. Keep all evidence creation and command execution in their dedicated tools.

## Implementation Outcome

`policyStorageClosureInstanceEvidenceAssembly.mjs` is the modular service.
`assemble-policy-storage-closure-instance-evidence.mjs` reads the two explicit
input artifacts relative to its selected `--cwd`, invokes the service, and can
write the assembly, current-closure audit, and requirement audit together.

```bash
npm run policy:storage-closure-instance-evidence -- \
  --completion-audit-artifact .tmp/policy-storage/completion-audit-artifact.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/instance-evidence-assembly.json \
  --current-closure-output .tmp/policy-storage/current-closure-audit.json \
  --requirement-audit-output .tmp/policy-storage/requirement-audit.json \
  --require-complete
```

The command exits nonzero for incomplete evidence. It emits no output by
default in that state; `--allow-blocked` permits only the evaluated, blocked
artifact chain to be written for diagnosis.
