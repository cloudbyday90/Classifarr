# Next-Batch Authorization Path-State Binding

## Intent

Each compatibility-removal authorization must describe one verified checkout
state, not a caller-selected mix of a raw plan, a runtime result, and a
different snapshot. This design binds the next-batch authorization to the same
ready execution-plan artifact and replay-verified path-state evidence used to
define its approved scope.

The boundary is read-only. It does not delete, archive, scan, write storage,
write manifests, run commands, or execute Git operations.

## Official-Source Research

- [SLSA Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
  recommends comparing provenance with known expectations and rejecting
  unrecognized parameters. The authorization therefore checks the exact plan
  artifact fingerprint and the snapshot's retained artifact fingerprint rather
  than accepting a plan-shaped input or an asserted snapshot result.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final) frames
  secure configuration management around controlled changes and current-state
  monitoring. The snapshot is the bounded current-state observation used to
  calculate the next action.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) recommends
  protecting software and its supporting evidence from tampering. Retaining
  both bound artifacts in the authorization wrapper gives later consumers a
  deterministic replay surface.

## Options Considered

### Continue Accepting A Raw Execution Plan

Pros:

- small caller payload,
- no additional retained artifact.

Cons:

- permits a caller to substitute plan scope after approval,
- cannot prove that a path-state snapshot belongs to the plan being used,
- makes later completion audit binding ambiguous.

### Trust Runtime Applied Paths As Checkout State

Pros:

- avoids carrying a path-state snapshot into the authorization.

Cons:

- runtime evidence proves prior application, not the current checkout state,
- cannot detect reappeared, omitted, or differently scoped paths,
- allows remaining inventory to be derived from a different source than the
  final audit uses.

### Bind Plan Artifact, Snapshot, And Runtime Evidence

Pros:

- provides one approved scope and one replayable checkout state,
- blocks raw, altered, cross-artifact, and manifest-divergent inputs,
- derives removed and remaining paths deterministically from the snapshot,
- makes final audit verification able to require the exact same plan source.

Cons:

- callers must retain a current plan artifact and path-state evidence artifact,
- snapshot evidence must be regenerated after checkout state changes.

## Final Recommendation Stack

1. Accept only a ready, fingerprint-valid execution-plan artifact as manifest
   authority.
2. Replay and validate the retained path-state evidence before authorization.
3. Require the snapshot's artifact fingerprint and manifest paths to exactly
   match the approved plan artifact.
4. Derive removed and remaining paths from the verified snapshot only.
5. Require runtime evidence's applied paths to exactly match the snapshot's
   removed paths.
6. Retain both artifacts in the authorization wrapper and fingerprint the
   wrapper payload.
7. Require a final-removal audit to supply the same expected plan artifact
   fingerprint; the generic completion audit also rejects a divergent manifest.
8. Keep all authorization and replay code side-effect-free.

## Implementation Outcome

Implemented:

- Added `policyNextCompatibilityRemovalBatchAuthorizationPathStateSource.mjs`
  to resolve one ready plan artifact and one replay-verified snapshot without
  exposing an unsafe source as authorization state.
- Updated next-batch authorization to v3 and its wrapper artifact to v4.
- Removed raw execution-plan input from the exporter and require
  `--execution-plan-artifact` plus `--path-state-evidence`.
- Added path-state artifact, manifest, and runtime-applied-set risk handling.
- Bound final-removal audits to the expected plan artifact fingerprint and made
  generic completion audits reject a manifest that diverges from the retained
  authorization source.
- Added focused contract coverage for raw-plan rejection, cross-artifact
  snapshots, divergent manifests, runtime/snapshot disagreement, and final
  audit binding.

## Next Step

Proceed with the next uncompleted bounded Phase 8R task after the storage
closure requirement audit confirms this new source, artifact, test, and design
document are part of the required evidence catalog.
