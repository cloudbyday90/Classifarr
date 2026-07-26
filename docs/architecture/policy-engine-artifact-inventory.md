# Policy Engine Artifact Inventory

## Purpose

The policy-engine replacement needs an explicit cutline for active artifacts
and separately retired diagnostic surfaces. This inventory records a stable
owner, decision, replacement purpose, test disposition, and source-layer type
for each active artifact. It prevents legacy replay, preview, provider, and
template surfaces from silently re-entering the normal operator workflow.

## Design

`policyEngineArtifactInventory.mjs` is a deterministic ES module. It groups
current artifacts by their product purpose and uses only four decisions:

- keep an engine primitive,
- rewrite it for the engine,
- replace it with an engine capability, or
- delete it after cutover.

Retired preview and provider categories are represented as a separate surface
ledger. They cannot also contain active artifacts. The audit rejects missing
owners, replacement descriptions, test dispositions, source paths, duplicate
paths, unknown source layers, missing required categories, and a legacy surface
that is still allowed in normal workflow.

The inventory performs only checked-in file-existence reads. It does not alter
source, policy storage, media-server state, providers, quota, or Git.

## Research

The cutline follows official guidance reviewed through June 2026:

- [NIST SP 800-53 Rev. 5.1, CM-8](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  requires an accurate component inventory and calls for inventory updates as
  components are installed or removed. Active paths are therefore verified,
  while retired categories stay in a separate deletion ledger.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends lifecycle-integrated secure development practices. Explicit
  cutline and test decisions make replacement and deletion reviewable before
  runtime work changes behavior.
- [CISA Cross-Sector Cybersecurity Performance Goals](https://www.cisa.gov/cybersecurity-performance-goals)
  favors measurable, actionable outcomes. The audit exposes bounded counts,
  fixed decisions, and one next step instead of relying on a narrative list.

## Options

### Reuse The Migration Ledger As The Inventory

Pros:

- Historical deletion decisions already exist.

Cons:

- It represents a later migration component, not the current checkout.
- Deleted paths can be mistaken for active surface coverage.
- Current scoring, summary, and template controls can be omitted.

### Discover Files At Runtime

Pros:

- New files could be detected automatically.

Cons:

- A path scan cannot assign product ownership or choose a replacement.
- It would make a repository-maintenance concern a runtime dependency.

### Checked-In Active Inventory With Retired Coverage

Pros:

- Each active artifact has an owner, decision, replacement purpose, and test
  treatment.
- The audit verifies active paths against the current checkout.
- Retired diagnostic categories remain visible without being counted as active
  artifacts.

Cons:

- New artifacts require an explicit inventory update.
- The inventory intentionally does not infer ownership from a file name.

## Final Recommendation Stack

1. Keep the active artifact inventory in a dedicated deterministic service.
2. Require one of keep, rewrite, replace, or delete for every active group.
3. Require owner, replacement or retained purpose, test disposition, and a
   valid current path for each group.
4. Retain already-removed impact, replay, TMDB-preview, and provider-readiness
   coverage through the later migration/deletion ledger only.
5. Keep this audit read-only and platform-agnostic; it must not use policy data,
   a database, providers, media servers, Docker, Git, or the network.
6. Make the policy-engine completion audit depend on this inventory, not the
   later migration/deletion component.

## Outcome

`policyEngineCompletionAudit.mjs` now consumes the inventory through its own
small service instead of maintaining a second, incomplete artifact list. The
completion audit therefore checks the current scoring, summary, template, and
retired diagnostic cutline from one maintained source.

The implementation lives in
`server/src/services/policyEngineArtifactInventory.mjs`; focused coverage lives
in `server/src/__tests__/services/policyEngineArtifactInventory.test.mjs`.

## Verification

Focused tests prove that the inventory:

- covers all requested categories and source layers;
- distinguishes active checkout artifacts from retired diagnostic categories;
- records decisions for advanced scoring and starter-template compatibility;
- rejects missing ownership, invalid decisions, duplicate paths, unknown source
  layers, unresolved paths, and legacy controls in the normal workflow; and
- blocks the completion audit when an active category loses all artifact groups.
