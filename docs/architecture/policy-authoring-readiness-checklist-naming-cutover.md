# Policy Authoring Readiness Checklist Naming Cutover

## Status

Implemented as the first isolated production-name deconstruction batch.

## Problem

The policy-authoring checklist was implemented under a roadmap-specific module
name and exposed roadmap-specific constants, helpers, component identifiers,
and documentation paths. It had no runtime consumers, public API, persisted
payload, or schema contract that required a compatibility layer. Keeping the
old name would turn temporary planning terminology into permanent architecture.

## Official Guidance Reviewed

- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports maintainable, traceable, verified changes throughout software
  development.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  recommends reviewing architecture, data flow, trust boundaries, and modified
  controls to prevent regression during refactoring.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  supports preserving server-owned workflow controls while changing
  implementation structure.

## Recommendation

Rename the isolated contract outright:

- module: `policyAuthoringReadinessChecklist.mjs`;
- focused test: `policyAuthoringReadinessChecklist.test.mjs`;
- exports and helpers: `POLICY_AUTHORING_*` and
  `*PolicyAuthoring*`;
- component records: durable `componentId` values instead of roadmap task IDs;
- referenced architecture records: durable policy-authoring paths.

Do not publish a compatibility export. There are no production callers,
persisted values, public payloads, or storage records that need one.

## Pros And Cons

Pros:

- Removes temporary roadmap vocabulary from a live server contract.
- Preserves the same fail-closed checklist and immutable records.
- Avoids a needless compatibility alias that would keep old terminology alive.
- Gives future policy-engine work a durable authoring readiness contract.

Cons:

- Internal test imports and architecture links must move together.
- Historical roadmap text continues to mention the original planning task,
  which is intentional historical evidence.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyAuthoringReadinessChecklist.mjs`
- Focused test:
  `server/src/__tests__/services/policyAuthoringReadinessChecklist.test.mjs`
- Naming-deconstruction design:
  `docs/architecture/policy-builder-production-naming-cutover.md`
- Inventory and regression audit:
  `scripts/lib/policyProductionNamingInventory.mjs` and
  `server/src/services/policyProductionNamingRegressionAudit.mjs`

## Outcome

The policy-authoring readiness checklist now describes a lasting product
responsibility. Its unchanged validation continues to fail closed when required
authoring evidence is missing, while roadmap phase vocabulary remains only in
historical planning material.
