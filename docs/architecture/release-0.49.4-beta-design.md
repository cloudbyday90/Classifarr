# v0.49.4-beta release qualification design

Date: 2026-11-02. Requested public tag: v0.49.4-beta.
Development base: 46ba1290dfb644293b657f77021c7716b3a89dc1 on main.
Previous published release: v0.49.3-beta / 2fcf07bdc35e93bbe2f480b3268b15466f16e012.
Authority: the maintainer explicitly requested this release following the
[runbook](../../.agent/workflows/release.md). Live deployment is separate.

## Preparation and source boundary

The live release list and remote refs establish that v0.49.4-beta is unused.
Stay on main; do not retarget or reuse any existing tag. The documentation review
was committed first as bfc4a67c4: historical entries survive in new archives and
the root summary covers every changed system in standard category order. See
the [separate consolidation review](release-0.49.4-beta-changelog-review.md).

Align package/lock metadata, UI label, README source marker, first release-note
section and dated changelog with the approved version. Retain a fresh Unreleased
section. Review lock changes to establish that version metadata did not resolve
new dependencies. Reinstall all three committed locks under pinned Node/npm and
strict installer policy; never use an unpinned preparation tool.

The live Docker Hub endpoint identified cloudbyday90/classifarr and pull_count
21,997 at 2026-11-02T21:04:30.4829176Z. README/notes must label this Docker Hub
image pulls, exclude GHCR and avoid a user/installation or growth-rate claim.

## Security hold that preparation cannot waive

npm 12.2.1 actually resolves bundled ip-address 10.7.2; the application copy is
separately patched. The official registry still returns E404 for npm 12.2.2,
while its upstream release PR remains unmerged. A proposed fix is not a published
artifact and a workspace override cannot repair npm's packaged bundle.

The prior v0.49.3-only acceptance does not authorize this release. The current
runbook blocks later publication until remediation. The maintainer's tentative
suggestion to defer is not silently converted into a new accepted exception.
Prepare fresh source/image risk evidence and the concrete release result first;
then resolve this decision before any tag/publication. Keep scanners, high/critical
gates, strict installation and all other release checks unchanged. A downstream
npm distribution is a separate reviewed strategy, not an incidental override.

Official sources read through MCP on November 2:

- [Parser advisory](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-rxp7-6hxx-x8q5):
  moderate, affected through 10.7.3, patched in 10.7.4.
- [Unpublished npm release proposal](https://github.com/npm/cli/pull/10156) and
  [proposed bundled fix](https://github.com/npm/cli/commit/b34bba52a4cf068ef695eef2d698e8e01b08b841).

## Fresh qualification

Run full lint, test:ci and all three audits after version alignment. Both coverage
reports must be newly produced; earlier development coverage reuse is not release
evidence. Inspect unique advisory chains and exposure rather than only counts.
Complete the repository security checklist and record actual checks/limits.

Build a uniquely tagged local production verification image from committed source.
Use its exact identity for schema dump/check and pg_stat_statements/extension/
supported PostgreSQL-upgrade smoke. Never generate a release schema from Unraid
or attach live appdata to a rehearsal. Commit any necessary fixes/snapshot before
the frozen phase and qualify the changed candidate again.

Read and use the existing installation/routing and frozen runners. Their upgrade
baseline is the separately attested v0.48.4-beta digest, not the current NAS image.
Record that scope explicitly. The frozen no-cache candidate must pass the same-
image thirty-minute workload/settled-idle soak and standard/Unraid/custom saved
deployment profiles, with source unchanged and owned-resource cleanup verified.
The local platform does not replace native published AMD64/ARM64 evidence.

Run the production-policy browser and synthetic provider-fault checks where
applicable. No paid/live-provider evaluation or live service replacement is part
of release creation. Preserve earlier receipts before fixed output paths are
reused. Perform scoped artifact maintenance without retiring recovery assets or
shared build caches.

## Repository controls and publication

Fresh live inspection shows immutable releases enabled. release-publication and
release-acceptance environments admit only v* tags and disallow administrator
bypass. Only the owner/admin collaborator is available, so independent reviewer
separation cannot be claimed. Registry secret names exist; values and token
capabilities are not exposed or inferred from names alone.

Push reviewed main and inspect exact-SHA CI, OSV, CodeQL, secret/image checks,
including genuinely skipped jobs. Once every pre-tag gate and the security hold
are resolved, tag that exact reviewed commit and push only refs/tags/v0.49.4-beta.
Do not manually create a release, rebuild a published artifact or bypass evidence.

The tag workflow owns same-run installation/provider-fault receipts, signed index
publication, both native digest-only routing consumers, v3 evidence assembly,
attested immutable GitHub publication and promotion of the original digest.
Verify downloaded evidence independently with the exact signer/source/tag/run
constraints and public trusted roots. Registry promotion is not atomic; inspect
each result and do not claim success after partial publication or promotion.

On failure, retain the tag and public artifacts, diagnose the actual failed gate
and rerun unchanged transient failures with fresh same-attempt evidence. A source
fix requires a new approved version after public artifacts exist. NAS deployment
and registry retention cleanup remain separately authorized operations.
