# Routing CI acceptance design

Date: 2026-10-03. Scope: CI evidence only; no release, deployment, live recovery or provider writes.

## Problem and decision

The routing upgrade/crash rehearsal runs locally, but CI installation acceptance does
not require it. The release readout trusts job success without reading its receipt.
Require both scenarios against one locally built, immutable candidate image and
validate the downloaded receipt before accepting the runtime component.

## Design

1. Verify published-baseline provenance before building anything. Build the candidate
   once with the checkout revision, using the existing frozen-candidate owner.
2. Run fresh/published-upgrade acceptance against that image ID. Separately archive
   the fixed pre-provider-guard commit and build its production image as the routing
   baseline; never seed an upgrade from the candidate schema or switch branches.
3. Run the existing eight-phase routing rehearsal on isolated, bounded resources.
   Require preserved attempts/history, persisted authentication pauses, successful
   credential repair, exact movie/TV request counts, no provider writes, and cleanup.
4. Emit a versioned, allowlisted receipt binding both results to the source revision,
   candidate ID, CI run ID and attempt. Export the candidate ID as a job output.
5. Download only this run's named receipt artifact. Independently reject missing,
   old-schema, stale, incomplete, wrong-run/source/image or failed-cleanup evidence.
   Existing job failures still block acceptance. No publishing permissions are added.

Receipts must finish within the preceding six hours, with at most five minutes of
future clock tolerance. Run and attempt matching prevent reuse from another run
even when its timestamp falls inside that window. Missing expected identity blocks
before Docker starts; missing downloaded identity blocks release acceptance.

Source cleanliness is checked before and after execution in CI. Local dirty runs
remain diagnostic, never release acceptance. Receipt JSON is evidence from the
trusted workflow, not a cryptographic attestation. Docker image IDs are local image
configuration identities, not registry manifest digests; published-image verification
remains a separate gate.

## Safety and bounds

Use shell-free bounded commands, random owned tags/directories, fixed baseline SHA,
and exact ownership checks. Retain no credentials, provider payloads or raw logs in
receipts. Existing rehearsal limits remain 2 CPUs, 2 GiB, 128 PIDs and no external
network. Cleanup failure blocks success. Retries rerun isolated tests; they never
resume a live library or adopt unknown ownership. No UI/API/database changes.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Keep a manual rehearsal | No extra CI time | Easy to omit or test a different image | Reject |
| Required same-image CI receipt | Repeatable proof with explicit failure boundaries | Additional baseline build and test time | Implement first |
| Published digest routing rehearsal | Tests precisely what users pull | Requires separate publication/promotion wiring | Next |

## Research

- [Docker build guidance](https://docs.docker.com/build/building/best-practices/)
  recommends testing built images in CI and pinning immutable dependencies.
- [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
  bind provenance to subjects and support verification; a plain test receipt must
  not be described as signed provenance.
- [OpenAI skill guidance](https://learn.chatgpt.com/docs/build-skills) recommends
  focused, reusable workflows with explicit inputs and outputs. Add a release-evidence
  skill distinct from the runtime recovery-change skill; reuse deterministic validators.

Sources were discovered and opened through web tools on 2026-10-03.

## Validation plan

Negative tests cover missing/duplicate phases, wrong identity, stale receipt, dirty
source, unexpected writes and cleanup failures. Workflow mutation tests protect
artifact selection, source binding and failure propagation. Execute an isolated real
image rehearsal locally, then inspect pushed CI status without creating a release.
