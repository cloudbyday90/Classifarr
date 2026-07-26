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

## Outcome

`policyEngineCompletionAudit.mjs` now consumes the inventory through its own
small service instead of maintaining a second, incomplete artifact list. The
completion audit therefore checks the current scoring, summary, template, and
retired diagnostic cutline from one maintained source.
