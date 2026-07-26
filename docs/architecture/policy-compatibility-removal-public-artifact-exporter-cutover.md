# Compatibility-Removal Public Artifact Exporter Cutover

## Purpose

Public compatibility-removal commands must not turn stale, incomplete, or
cross-plan runtime evidence into a consumable authorization, completion, or
regeneration artifact. This document records the 8R.36.9 cutover to the
current `policy.post_removal_runtime_evidence_artifact.v2` contract.

The work is limited to artifact validation and diagnostic projection. It does
not authorize removal, execute commands beyond the invoked exporter, mutate
policy storage, inspect a media server, consume provider quota, use Docker,
or depend on a local policy or library name.

## Research

The design follows official guidance reviewed in June 2026:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  calls for server-side enforcement, protection of significant transaction
  data from modification, and a final execution check. The current
  execution-plan artifact digest is the significant removal data here.
- [SLSA Verification Summary Attestation](https://slsa.dev/spec/v1.2/verification_summary)
  requires a verifier to confirm that an attestation subject matches the
  artifact digest. Exporters use the same direct-digest comparison rather than
  inferring plan identity through a review artifact alone.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends secure development practices throughout the lifecycle. Versioned,
  deterministic contracts and focused negative tests make this boundary
  reviewable and repeatable.

## Options Considered

### Downstream-Only Validation

Let public commands write their usual artifacts and rely on the next consumer
to reject an invalid runtime-evidence artifact.

Pros:

- No exporter behavior change.

Cons:

- An operator can mistake a written artifact for valid authority.
- Invalid evidence is unnecessarily propagated through the public chain.

### Rewrite Or Upgrade Legacy Evidence

Have an exporter add the missing plan digest or relabel an older artifact as
version 2.

Pros:

- Fewer immediate blocked outputs.

Cons:

- Invents security-significant provenance.
- Defeats versioning and permits a cross-plan time-of-check/time-of-use path.

### Explicit Public Cutover With Bounded Diagnostics

Evaluate the current runtime-evidence contract before every public exporter
creates a downstream artifact. Strict mode writes nothing; explicit diagnostic
mode writes only a compact, non-authoritative explanation.

Pros:

- Prevents legacy, missing, malformed, and cross-plan evidence from becoming
  ready artifacts.
- Preserves deterministic, platform-agnostic behavior without a mutable
  registry or external service.
- Gives operators one safe next step without exposing artifact payloads.

Cons:

- Operators must regenerate evidence after a contract change.
- Diagnostic mode intentionally cannot preserve the detailed artifact payload.

## Recommendation Stack

1. Accept only the current v2 runtime-evidence artifact at public exporter
   boundaries.
2. Require its direct SHA-256 execution-plan artifact digest to match the
   current supplied plan wrapper where one is available.
3. Fail closed before writing a runtime-evidence, authorization, completion,
   regeneration, or final-removal-audit artifact.
4. Allow `--allow-blocked` to write only a versioned diagnostic containing
   fixed reason IDs, the required contract version, and one regeneration next
   step.
5. Continue to rely on existing deeper artifact-integrity checks. The public
   cutover is an early boundary, not a substitute for authorization or replay.

## Implemented Contract

`policyCompatibilityRemovalRuntimeEvidenceCutover.mjs` is the shared,
side-effect-free evaluator. It validates the existing runtime-evidence artifact
and reports only these fixed outcomes:

- `runtime_evidence_missing`
- `runtime_evidence_contract_unsupported`
- `execution_plan_fingerprint_missing`
- `execution_plan_fingerprint_invalid`
- `execution_plan_fingerprint_mismatch`
- `runtime_evidence_invalid`

The public post-removal verification, next-batch authorization, completion
audit, evidence-regeneration, and storage-closure final-removal-audit commands
call this evaluator before building their normal output. A ready command keeps
its normal artifact shape and direct digest chain. A blocked command writes no
normal output by default. With `--allow-blocked`, it writes a
`policy.compatibility_removal_exporter_diagnostic.v1` record only to the
ordinary output path; wrapper and downstream artifact paths remain unwritten.

The diagnostic is explicitly `authoritative: false`. It contains no local
paths, policy names, library names, raw evidence, secrets, recovery controls,
or nested artifact payload.

## Verification

Focused unit and public-command tests cover:

- a coherent current v2 artifact chain,
- a predecessor v1 runtime-evidence artifact,
- a missing direct execution-plan digest, and
- an artifact whose digest belongs to another plan.

Every negative case proves strict mode writes no artifact and diagnostic mode
writes only the compact diagnostic. The tests use temporary directories and
in-memory service construction; they make no provider, media-server, database,
Docker, filesystem-deletion, Git, or network call beyond their temporary test
fixtures.
