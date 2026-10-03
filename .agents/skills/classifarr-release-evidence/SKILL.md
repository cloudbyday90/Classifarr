---
name: classifarr-release-evidence
description: "Verify Classifarr CI receipts, image rehearsals and release-readiness claims against the exact source and artifact. Use for release evidence or acceptance-gate changes, not ordinary runtime debugging or permission to publish."
---

# Classifarr release evidence

Answer whether the evidence proves the requested claim, and identify the smallest
missing check. Assessment is read-only unless the user also requests implementation
or an isolated rehearsal. A green receipt never authorizes a release or deployment.

## Identify the subject

Record checkout revision and cleanliness, workflow run and attempt, and the exact
image identity before interpreting results. Distinguish a local Docker image ID
from a registry manifest digest. An OCI revision label alone is not signed provenance.
Do not substitute an earlier successful run or a newly rebuilt image for the target.

Trace the receipt's producer, artifact transfer, validator and downstream gate.
Check that expected identity comes from trusted workflow context, not from the
receipt being validated. Job success and a JSON `passed` field are insufficient.

## Use existing contracts

- CI installation/routing: `scripts/run-runtime-installation-acceptance.mjs`,
  `scripts/lib/runtimeInstallationGate.mjs` and
  `scripts/verify-runtime-installation-receipt.mjs`.
- Saved-template and resource-soak evidence: `scripts/run-frozen-release-rehearsal.mjs`.
- Published digest and provenance: inspect `scripts/lib/releaseCandidateEvidence.mjs`
  and `.github/workflows/ci.yml`; do not equate local image testing with published
  multi-platform verification.

Read the applicable producer and validator before executing. For container failure
scenarios, also read the recovery skill's
[image rehearsal guidance](../classifarr-recovery-change/references/image-rehearsal.md).
Keep fixtures disposable and synthetic; never point a rehearsal at live appdata.

For registry images, native architecture matrices or alias-promotion claims,
read [published-digest guidance](references/published-digest.md). It covers
index/child/config identity, shared alias-promotion gates and partial-registry
failure handling. Use `.agent/workflows/release.md` for approved release
operations; the skill itself never grants that approval.

## Challenge the claim

For gate changes, test the real rejection path for missing evidence, old schemas,
wrong source/image/run/attempt, duplicate or missing checks, unexpected side effects,
and failed cleanup. Verify the CLI exits nonzero and the workflow cannot bypass it
with `continue-on-error`, skipped downloads or results from a different run.
Use existing workflow mutation tests rather than a second parallel validator.

Keep validation and receipt reconstruction deterministic ESM code. Only allowlisted
aggregate fields belong in artifacts. Do not include credentials, provider payloads
or raw logs. A self-reported receipt is not a signature; retain existing attestation
checks and read-only job permissions.

## Report limits plainly

Lead with passed, blocked or not yet verified, then the exact subject and next step.
Separate unit tests, actual image runs and remote CI; list skips and failures.
Keep design and outcome documents separate. Report no release when none was made.
Commit, push, rerun workflows or mutate external systems only within the user's request.
