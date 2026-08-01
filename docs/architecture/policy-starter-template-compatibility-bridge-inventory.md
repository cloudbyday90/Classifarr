# Policy Starter-Template Compatibility Bridge Inventory

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.7.3

**Decision date:** 2026-08-01

## Decision

Starter templates are not policy authority. The remaining preset-attachment
paths exist only to maintain unconverted policies until native intent storage
has completed its verified cutover. They must remain isolated, guarded, and
explicitly temporary. They cannot return to the normal authoring workflow.

This task adds the executable inventory in
`server/src/services/policyStarterTemplateCompatibilityBridgeInventory.mjs`.
It composes the existing draft-bridge and component inventories with the
previously untracked server attachment routes. The audit fails if a retained
artifact lacks a source path, entry point, legacy artifact scope, native
successor, every required deletion gate, or compatibility-only UI boundary.

## Research

Research was reviewed on 2026-08-01 against the requested current-through-June
2026 guidance.

- OWASP recommends an explicit inventory, risk assessment, least privilege,
  and a granular migration plan for active legacy components. That supports a
  complete inventory and retaining only the server-guarded compatibility paths
  needed for unconverted policies. [OWASP Legacy Application Management Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Legacy_Application_Management_Cheat_Sheet.html)
- OWASP secure code review guidance calls for baseline boundary and data-flow
  analysis, then incremental review of changes. The inventory covers the
  attachment reader, route-level persistence, client round trip, and rendered
  compatibility surface instead of treating the serializer as the only
  boundary. [OWASP Secure Code Review Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
- NIST SSDF recommends integrating secure development practices into the SDLC
  and tracking security-relevant requirements and decisions. The immutable
  record and regression audit make the retirement decision reviewable and
  repeatable. [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final),
  [NIST SSDF project](https://csrc.nist.gov/Projects/ssdf)

## Inventory Outcome

| Scope | Count | Disposition |
| --- | ---: | --- |
| Server attachment readers | 2 | Delete after native storage cutover |
| Server attachment round-trip routes | 3 | Delete after native storage cutover |
| Client draft round-trip modules | 3 | Delete or replace after native storage cutover |
| Compatibility-only Vue components | 12 | Delete or replace after native storage cutover |
| Active bridge artifacts | 20 | Retained behind the native-storage gate |

The server inventory includes the shared attachment query helper, normal policy
read projection, normal legacy create/update persistence, direct preset
attachment routes, and migration-maintenance routes. The latter has no current
browser caller but remains a supported guarded compatibility API; absence of a
browser import is not evidence that it is safe to delete.

The client inventory includes the draft bridge, draft-command coordinator, save
payload coordinator, compatibility maintenance shell, legacy editor, all
compatibility controls, provenance chip, and migration notice. Each component
is explicitly marked outside normal authoring and has no raw legacy-payload
mutation authority.

`PolicyStarterTemplateMechanics.vue` is already absent from the tree and is
recorded as retired. No active artifact was deleted in this task because every
one has a current server route, import path, or compatibility responsibility.
Deleting a live path would break existing policies rather than remove debt.

## Native-Storage Deletion Gate

Every retained artifact has the same complete gate because partial removal
would split reader, writer, rollback, and browser behavior:

1. Native intent schema is the authoritative write target.
2. Conversion is lossless for supported legacy policy data.
3. Rollback snapshots exist and have a verified retention policy.
4. Native reads and writes have verified parity with the required policy
   behavior.
5. Legacy preset writes are shut down for converted policies and no eligible
   legacy policy still requires the artifact.
6. Backup and restore verification covers converted native intent.
7. Regression coverage proves the cutover and deletion path.

The route-level legacy write guard remains the enforcement boundary before this
gate completes. Client code continues to emit typed draft commands; only the
isolated bridge can serialize legacy payloads.

## Options Considered

### Delete all attachment mechanics now

**Pros:** Smallest immediate code surface; no ongoing bridge maintenance.

**Cons:** Breaks unconverted policy reads, guarded legacy saves, and migration
maintenance before the native model has proven parity and rollback. It is not
safe.

### Keep the current paths without a complete inventory

**Pros:** No immediate implementation work.

**Cons:** Server routes and nested compatibility components can silently drift,
the removal decision remains ambiguous, and an obsolete path can become normal
product behavior again.

### Maintain one executable inventory until native cutover

**Pros:** Provides one reviewable source of truth, preserves existing policies,
keeps raw mutation and server enforcement contained, and turns deletion into a
testable operation.

**Cons:** Adds a small maintenance manifest and tests until Phase 8R completes
native storage cutover.

## Final Recommendation Stack

1. Keep the 20 listed artifacts only as guarded compatibility infrastructure.
2. Keep the legacy write guard and client raw-payload isolation unchanged.
3. Do not expose a compatibility component in normal authoring.
4. Delete or replace each artifact only after all seven native-storage gates
   pass as one cutover.
5. Next, reduce decision load in the existing-policy maintenance surface
   without adding new intent authority or a second authoring workflow.

## Verification

`policyStarterTemplateCompatibilityBridgeInventory.test.mjs` verifies the
inventory, source presence, all seven deletion gates, compatibility-component
coverage, retired-mechanics exclusion, immutability, and failure modes for an
incomplete retained artifact.
