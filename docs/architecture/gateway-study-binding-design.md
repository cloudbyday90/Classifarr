# Gateway study input binding

## Approved scope and purpose

Bind the five modes routed through `gatewayInferenceSoak.mjs`: regression and
extended inference, history profiling, restore memory and row-mode comparison.
Only row mode previously bound copied fixture bytes. This is local test tooling,
not new recovery authority, a service, an admin action or a release gate.

The smallest failure is a study using changed copied code while attributing its
result solely to an image revision. A second weakness is executable fixtures
sharing a writable volume with generated observations. Copy-time hashes alone
do not establish unchanged inputs throughout a run.

## Contract

- Require a clean, committed fixture checkout and immutable local image ID with
  its independently inspected source label. Record fixture and image revisions
  separately. The shared binding supports explicitly different revisions;
  row-mode application parity continues to require equal revisions. Existing
  upgrade/installation/routing callers and receipt schemas remain unchanged.
- Stage exact committed Git blob bytes, not later worktree reads. Reject missing,
  oversized, non-regular or unexpected inputs. Bind the complete fixed copied
  relative-import closure for each mode. Packaged application code remains in
  the pinned image; row mode additionally checks its two parity-sensitive files.
- Use a bounded, network-isolated staging container, then remove it before the
  database fixture starts. Seal executable files and their manifest read-only.
  Mount inputs read-only into the producer and every worker. Store generated
  observations in a different owned volume, never import code from that volume.
- Pass the expected manifest digest through the host's inspected Node command.
  A standard-library-only inline bootstrap verifies it before interpreting the
  manifest, checking all copied bytes, or importing any fixture executable.
  Validate output identity independently; a fixture's `passed` flag is not proof.
- Retain production entrypoints, all archive and catalog integrity checks,
  attempt limits, cooldowns, cancellation, clocks, resource limits and schedules.
  The bootstrap runs in the same process before measurement starts. No extra
  provider processes, shared Ollama calls, credentials or production data.
- One bounded rehearsal invocation owns exact labeled resources. No automatic
  retry of staging or study failure. A mismatch is permanent for that invocation;
  cancellation or crash yields incomplete evidence, never success. Rerunning
  creates fresh synthetic resources; it does not reset production retry state.
- Recheck the committed checkout before completion. Cleanup must succeed for a
  passed result; remove only exact resources with matching ownership labels.

## Research and tradeoffs

Official sources discovered and reviewed on 2026-10-18:

- [SLSA 1.2 build provenance](https://slsa.dev/spec/v1.2/build-provenance)
  separates output subjects from resolved input dependencies and their digests.
  Our application is separate image and fixture identities, not a SLSA claim.
- [SLSA verification](https://slsa.dev/spec/v1.2/verifying-artifacts)
  checks expected identities and parameters, not just self-reported assertions.
- [Git object access](https://git-scm.com/docs/git-cat-file) provides committed
  object contents. Fixed revisions and allowlisted paths avoid arbitrary refs.
- [Docker volumes](https://docs.docker.com/engine/storage/volumes/)
  documents read-only mounts and inspecting actual mount state. An RO verifier
  mount does not make a different producer's RW mount safe.
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
  distinguishes cryptographic build provenance from software security. These
  local checks are not signatures, published-image attestation or proof against
  a compromised checkout, Docker daemon, host or trusted image.

Leaving other modes unbound is simpler but permits mislabeled evidence. Binding
all repository rehearsals at once closes more gaps but combines several unrelated
copy, bind-mount and stdin mechanisms and risks breaking legitimate upgrades.
The approved common-runner-first approach gives one audited boundary at the cost
of a small staging operation, an extra results volume and maintained file lists.
Those lists need closure regression tests as fixtures evolve.

Final stack: committed blobs → separately pinned image/fixture identities →
sealed input volume → command-pinned pre-import checks → independently validated
results → unchanged native safety assertions → exact owned cleanup.

## Verification and completion

Add regression tests for mixed revisions, dirty source, wrong digest, missing or
changed transitive inputs, unexpected entry points and inputs, symlinks, command
drift, writable mounts and absent/mismatched output identity. Prove refusal before
fixture side effects, input-write denial and writable results with real isolated
containers. Run tooling/preflight and affected contracts, then all five unchanged
mode paths against the exact committed subject. The extended soak retains its
30-minute workload; no compressed time is reported as elapsed production time.
Rebuild Compose without cache, protect the prior image and backup, and check local
readiness without enabling optional gateway services. Record exact results and
limitations separately in the outcome document. Commit/push main; no release.

Next deferred item: adopt this contract in default archive/catalog/retention,
qualification/cleanup and scheduling/rotation rehearsals. They remain unbound
until separately implemented and verified; this work does not imply coverage.
