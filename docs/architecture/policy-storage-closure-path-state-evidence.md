# Policy Storage Closure Path-State Evidence

## Intent

The storage-closure final-removal audit must prove the checkout state of the
exact paths approved by a compatibility deletion execution plan. It must not
derive that state through an unrecorded live filesystem callback while it
decides whether storage closure is complete.

This component separates the bounded, read-only checkout observation from the
final audit:

1. `policyStorageClosurePathStateCollector.mjs` reads the current checkout for
   only the canonical manifest paths exposed by a ready, fingerprint-valid
   execution-plan artifact.
2. `policyStorageClosurePathStateEvidence.mjs` records every observation,
   derives existing and removed path sets, and binds them to that artifact's
   fingerprint.
3. `policyStorageClosurePathStateEvidenceFingerprint.mjs` hashes the bounded
   evidence projection with SHA-256.
4. `policyStorageClosurePathStateEvidenceIntegrity.mjs` rebuilds the evidence
   from retained inputs before the final-removal audit consumes its replayed
   path-state snapshot.

The result is a point-in-time observation, not an authorization to mutate the
checkout. It must be regenerated whenever the checkout or approved
execution-plan artifact changes.

## Official-Source Research

- [SLSA artifact verification](https://slsa.dev/spec/v1.2/verifying-artifacts)
  recommends that consumers verify provenance and reject unexpected external
  parameters. The final audit accepts one retained evidence artifact whose
  manifest source and observations replay exactly.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  recommends security-focused configuration management that monitors actual
  system configuration. The collector records observed checkout state rather
  than trusting an intended removal.
- [Node.js file system documentation](https://nodejs.org/api/fs.html) warns
  against treating existence checks as a precondition for later filesystem
  operations because state can change between steps. This component uses the
  check only as a read-only observation and never follows it with a mutation.
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) provides
  SHA-256 hashing primitives used to detect accidental or unauthorized changes
  to the bounded local artifact.

## Options

### Read The Checkout Inside The Final Audit

Pros:

- fewer artifacts and commands,
- straightforward for a single local run.

Cons:

- the path state is not independently replayable,
- a later consumer cannot distinguish the observed state from a newly read
  checkout,
- the final audit mixes collection with judgment.

### Accept A Caller-Supplied Path List

Pros:

- avoids any filesystem read in project code,
- easy to serialize.

Cons:

- callers can omit, duplicate, or extend approved manifest paths,
- no trustworthy relationship to the approved execution-plan artifact,
- no deterministic proof that derived counts reflect retained observations.

### Capture, Fingerprint, And Replay A Bound Snapshot

Pros:

- records one observation for every and only approved manifest path,
- detects altered, stale-source, incomplete, duplicate, and re-fingerprinted
  derived state,
- keeps collection separate from final audit judgment,
- remains side-effect-free except for the requested JSON output file.

Cons:

- requires one extra local or CI command,
- a snapshot must be regenerated after checkout changes,
- local SHA-256 integrity does not establish independent cross-host identity.

## Final Recommendation Stack

1. Resolve only the ready, fingerprint-valid execution-plan artifact as the
   manifest authority.
2. Collect one boolean existence observation for each canonical manifest path.
3. Record the retained execution-plan artifact, observations, derived path
   state, and read-only side-effect declaration in a versioned evidence
   artifact.
4. Verify its SHA-256 fingerprint and deterministically replay the artifact
   before use.
5. Require the replayed artifact fingerprint and manifest paths to match the
   final audit's execution-plan source exactly.
6. For cross-host or release authenticity, add configured trusted-CI signing
   and provenance verification. Do not treat this local content hash as a
   substitute for that trust boundary.

## Implementation Outcome

Implemented:

- Added a narrow path-state collector that performs no mutation and skips all
  checkout reads when the execution-plan source is invalid.
- Added versioned evidence, fingerprint, and integrity contracts. They reject
  noncanonical, unknown, duplicate, incomplete, nonboolean, or derived-state
  inconsistent observations.
- Added `npm run policy:storage-closure-path-state-evidence` to generate the
  snapshot JSON.
- Updated the final-removal audit to v3. It no longer accepts a `fileExists`
  callback; it consumes only the verified replayed snapshot bound to its
  approved execution-plan artifact.
- Added focused collector, evidence, fingerprint, integrity, and final-audit
  tests. The storage-closure validation and requirement-audit catalogs now
  require this component's contracts, tests, and documentation.

Generate a fresh snapshot before the final-removal audit:

```bash
npm run --silent policy:storage-closure-path-state-evidence -- \
  --execution-plan-artifact .tmp/policy-storage/execution-plan-artifact.json \
  --output .tmp/policy-storage/path-state-evidence.json
```

## Outcome

**8R.25.3 Next-Batch Authorization Snapshot Binding** now consumes this
verified snapshot. It rejects raw plans, altered snapshots, cross-artifact
snapshots, and any runtime applied-path set that differs from the snapshot's
removed paths before it authorizes another batch.
