# Policy Compatibility Deletion Preflight Evidence Collection

## Intent

The compatibility deletion execution gate needs current facts about the reviewed
source tree, the exact approved execution-plan artifact, the approved manifest
paths, and the runtime evidence reference retained by that artifact. Those
facts are safe to collect automatically. Backup/restore proof, final support
and rollback decisions, and operator approval are not.

This component provides a separately invoked, non-destructive collection
boundary. It does not make a deletion decision and does not turn observed
machine evidence into human approval.

## Official-Source Research

- Git documents porcelain v1 as stable across Git versions and independent of
  user configuration. The collector uses `git status --porcelain=v1` to make
  the clean-checkout observation script-safe.
- SLSA v1.2 verification guidance recommends checking an artifact against
  defined expectations instead of trusting its asserted provenance. The
  collector independently validates the execution-plan artifact, its
  fingerprint, and its approval summary before recording an observation.
- NIST SP 800-204D covers software-supply-chain controls in CI/CD, including
  artifact and provenance concerns. The collector records the reviewed source
  revision alongside the exact artifact fingerprint rather than accepting a
  caller-provided readiness flag.
- Docker documents that `--cap-drop` can remove capabilities and that
  privilege should be minimized. This collection path does not need runtime
  observation, so it deliberately starts no helper container, contacts no
  database, and mounts nothing. The existing 8R.15a.2 read-only helper model
  remains the required approach if a later preflight check genuinely needs
  embedded-runtime observation.

Sources:

- Git, [git-status](https://git-scm.com/docs/git-status)
- SLSA, [Build: Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
- NIST, [SP 800-204D](https://csrc.nist.gov/pubs/sp/800/204/d/final)
- Docker, [Running Containers](https://docs.docker.com/engine/containers/run/)

## Options Considered

### Continue With Manual Preflight Booleans

Pros:

- no new command or artifact.
- a human can record every decision in one object.

Cons:

- machine-verifiable facts can be accidentally copied, stale, or detached from
  the reviewed checkout.
- it makes the execution gate trust assertions that it could verify itself.

### Probe The Running Application For Every Fact

Pros:

- can observe live embedded runtime state.

Cons:

- needs container or database connectivity for facts that exist only in the
  reviewed checkout.
- expands privileges and failure modes without improving checkout or manifest
  continuity.

### Recommended: Bounded Checkout Collector

Pros:

- independently verifies the execution-plan artifact fingerprint and approval
  summary.
- checks that every approved manifest path is repo-relative, regular, present,
  and present at `HEAD`.
- writes a compact, versioned, fingerprint-bound observation artifact under
  ignored `.tmp`.
- fails closed for dirty worktrees, unsafe paths, symlinks, missing inputs,
  stale runtime evidence references, malformed artifacts, and output escapes.
- has no Docker, database, application endpoint, storage, or deletion side
  effects.

Cons:

- it intentionally cannot establish recovery proof or operator approval.
- it must be run again whenever the artifact ages out or the checkout changes.

## Final Recommendation Stack

1. Generate a current fingerprint-valid execution-plan artifact through the
   existing evidence and plan workflow.
2. Run the preflight collector from the reviewed checkout.
3. Retain its `.tmp` observation artifact with the human-provided recovery,
   stance, and approval records required by the existing execution gate.
4. In the next task, make the gate consume the collector artifact only as a
   bound source for worktree and manifest facts; never as an authority for
   recovery or human approval.
5. Keep controlled deletion in its separate reviewed apply boundary.

## Contract

The public command is:

```text
npm run policy:compatibility-deletion-preflight-evidence -- \
  --execution-plan-artifact <artifact.json> \
  --output .tmp/preflight-evidence.json
```

Both paths must remain inside the reviewed checkout; the output must be a new
JSON file below `.tmp`. The command rejects unsupported arguments, including a
caller-controlled collection timestamp.

The collector records only these fact classes:

- the full `HEAD` revision and whether `git status --porcelain=v1` is clean;
- the artifact path, deterministic fingerprint, timestamp, and recorded
  manifest approval summary;
- each manifest path's current safe regular-file and `HEAD` continuity state;
- the retained execution-plan evidence-bundle reference and its freshness.

The output carries its own deterministic SHA-256 fingerprint. A later consumer
must recompute that fingerprint and compare its retained
execution-plan-artifact fingerprint to the separately supplied plan artifact;
the preflight record is never sufficient by itself.

Artifact statuses are `observed`, `missing`, `stale`, or `invalid`. A nonzero
command result writes a bounded diagnostic artifact when the checkout can be
identified; malformed command arguments and unsafe output paths fail without
writing one.

An `observed` artifact is not an execution-gate allow state. It contains no
backup/restore claim, operator approval, approval actor, rollback decision, or
support decision. It also does not contain a deletion request, an application
request, database read, Docker invocation, or application-managed storage
mutation. Writing the requested local observation JSON below `.tmp` is its
only deliberate filesystem effect.

## Implementation Outcome

Implemented:

- `policyCompatibilityDeletionPreflightEvidenceArtifact.mjs` provides the
  versioned, deterministic evidence contract.
- `collect-policy-compatibility-deletion-preflight-evidence.mjs` and its
  modular collector gather checkout and source-path observations without
  starting a container or contacting the application.
- The artifact validates the execution-plan artifact's fingerprint and approval
  summary, carries its own deterministic fingerprint, and distinguishes
  observed, missing, stale, and invalid evidence.
- Manifest observation rejects path traversal, absolute paths, control
  characters, symlinks, directories, paths outside the checkout, files missing
  from `HEAD`, and unbounded manifest input.
- Focused tests cover current observation, missing artifact, stale evidence,
  dirty checkout, unsafe or missing manifest paths, output escapes, and
  unsupported caller-controlled time.

Not implemented here:

- no execution-gate interface change;
- no conversion of collected evidence into recovery, final stance, or operator
  approval records;
- no embedded database or runtime probe;
- no deletion, Git mutation, route removal, test removal, or storage change.

## Next Step

Proceed with **8R.16.3 Collector-To-Gate Attestation Integration**. It should
make a gate consumer revalidate the collected artifact against the supplied
execution-plan artifact and derive only the worktree and manifest records from
it. It must reject stale, cross-artifact, altered, or post-observation checkout
evidence while preserving separately supplied human recovery, stance, and
approval records.
