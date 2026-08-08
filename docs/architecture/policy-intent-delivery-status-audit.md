# Policy Intent Delivery Status Audit

Status: Current repository audit updated 2026-08-08.

## Purpose

This audit turns the policy-intent roadmap into an executable delivery plan. It
separates a checked-in contract from a rendered product outcome, and it
separates platform behavior from evidence that must be collected for each
installation.

The audit does not authorize a policy write, runtime action, native conversion,
or compatibility removal. It records which work may be trusted as a foundation,
which work remains, and which dependency must be completed next.

## Target Outcome

The completed product has one normal authoring path:

```text
select connected library
  -> read a server-derived destination proposal and automation state
  -> create or save through one admitted server action
  -> adjust only the part that is materially wrong or incomplete
  -> let Classifarr recover evidence and ask only when automation is unsafe
```

For a library with adequate observed evidence, the operator does not recreate
the library's genre, template, provider, score, replay, or routing diagnostics.
The page explains what the library appears to mean, what Classifarr will do,
and whether a change is necessary. Optional controls are hidden until the
operator chooses to adjust the policy or the server identifies a material
exception.

A successful implementation also requires the following technical outcomes:

- The server is the authority for proposal validity, persistence, questions,
  answers, learning, routing eligibility, and automatic recovery.
- The browser renders bounded projections and forwards named, allow-listed
  commands. It does not infer readiness, authorization, evidence meaning, or
  a successful operation.
- Runtime classification distinguishes routed, classified-but-not-routed,
  blocked, and question-required outcomes. Learning is a separate guarded
  side effect.
- Native intent storage is the durable policy model. Automatic conversion is
  installation-agnostic, idempotent, and safe without a maintainer dialog.
- Compatibility retirement is release maintenance in CI, never a route,
  scheduler, browser action, or source-writing runtime capability.
- Production code, diagnostics, telemetry, and current payloads use durable
  product names instead of roadmap labels.

## Audit Method

The roadmap was reviewed from its goal through Phase 9R, including every phase
component map, current-starting-point statement, work sequence, implementation
record, and completion gate. The following focused repository suites passed:

- `policyAuthoringWorkflowCompletionAudit.test.mjs`
- `policyAuthoringWorkflowClosureHandoff.test.mjs`
- `policyEngineCompletionAudit.test.mjs`
- `policyRuntimeCompletionAudit.test.mjs`
- `policyStorageClosureRequirementAudit.test.mjs`
- `policyProductionNamingRegressionAudit.test.mjs`

These suites establish current repository contract evidence. They do not
replace the live rendered-state and end-to-end evidence owned by Phase 4R, or
the per-installation cutover evidence owned by Phase 8R.

## Phase Status

| Workstream | Status | What It Establishes | Remaining Work |
| --- | --- | --- | --- |
| 0R | Complete foundation | Authority vocabulary and product language | Reopen only for a deliberate vocabulary or authority change |
| 1R | Complete foundation | Client orchestration, draft, reference-data, bridge, and test boundaries | Enforce as a guardrail in 4R |
| 2R | Complete foundation | Typed draft commands and isolated compatibility serialization | Preserve until native storage fully replaces the bridge |
| 3R | Complete contract cutline | Destination-first flow, component roles, accessibility rules, and normal-path exclusions | Live rendered-path proof moves to 4R |
| 4R | Complete | Live lifecycle entry, proposal, recovery, bounded adjustment, material exceptions, maintenance, cutover, and browser accessibility/workflow evidence | Preserve the single server-admitted authoring path |
| 5R | Complete | Server authority for reads/writes, provider capability, questions, answers, learning, verifier behavior, tests, and native changes | Preserve request-bound provider authority and fail-closed side effects |
| 6R | Contract-complete foundation | Evidence, intent, learning, readiness, workflow, and migration boundaries | Consume through 4R; reopen only for a bounded contract gap |
| 7R | Contract-complete foundation | Runtime decision, question, rebuild, verifier, rollback, and trace boundaries | Preserve through 5R and 8R authority/storage work |
| 8R | Active parallel lanes | Native lifecycle, installation evidence, CI-only retirement, and closure evidence | Decommission the named-scope server source-mutation path in 8R.37.2; retain automatic policy conversion |
| 9R | Ongoing enforcement | Zero-debt durable naming and product-language gates | Preserve the baseline in every product change |

## Required Delivery Order

1. **4R.1 Live Entry-Path And Action Inventory** is complete for source and
   controlled rendered-browser evidence. `/policies` is the normal
   lifecycle-first cutline; keyboard selection moves to the selected-library
   route, and only an eligible selected library renders the server-admitted
   create action. The retired advanced-settings hash is not an authoring
   target. See [Policy Authoring Live Entry-Path And Action
   Inventory](policy-authoring-live-entry-path-inventory.md).
2. **5R.1 Server Intent Contract Authority** is complete. It publishes the
   server-owned `policy_intent_authority` contract, keeps v1 intent projection
   read-only and compatibility-scoped, and bounds routing/evidence metadata.
   See [Policy Intent Contract Authority](policy-intent-contract-authority.md).
3. **5R.2 Write Preflight And Persistence Boundary** is complete. Native
   initial creation is admitted, idempotent, transactional, and followed by a
   fresh authority read; draft sidecars remain validation-only compatibility
   input. See [Policy Intent Write Admission](policy-intent-write-admission.md).
4. **4R.2 Server Workflow Presentation Adapter** is complete. It builds the
   one validated, immutable, display-only presentation model from authoritative
   server outcomes. See [Policy Authoring Workflow Presentation
   Adapter](policy-authoring-workflow-presentation-adapter.md).
5. **4R.3 Action Binding And Admission Feedback** is complete. Native create
   requires a confirmed server receipt, retries retain idempotency, and visible
   feedback is safe and action-local. See [Policy Authoring Action Binding And
   Feedback](policy-authoring-action-binding-and-feedback.md).
6. **5R.2a Proposal And Lifecycle Admission Contract** is complete. It
   supplies an authoritative library lifecycle, opaque proposal reference,
   fresh admission recheck, and bounded stale/concurrency recovery outcomes.
7. **4R.4a, 4R.4, 4R.4b, and 4R.5** are complete. They deliver the lifecycle
   entry, automated proposal default, proposal outcome recovery, and bounded
   optional adjustment disclosure without exposing engine diagnostics.
8. **5R.3 AI Provider Capability And Authority Modes** is complete. The
   authority profile is request-bound: disabled generation is denied, strict
   modes require a schema, repair output is normalized, and AI-derived routing
   fails closed when authority metadata is missing.
9. **5R.4 through 5R.10** are complete. They close normalization, answer,
   learning, stale-question, verifier, server-test, and native-change
   boundaries.
10. **4R.6 through 4R.9** are complete. They deliver material exceptions only
   when needed, revision-safe persisted-policy maintenance, legacy UI cutover,
   and browser-level accessibility/responsive/end-to-end evidence.
11. **8R.37.1 Runtime Capability Inventory And Isolation Decision** is
   complete. A root CI audit proves that no route, scheduler, client API,
   bootstrap path, configuration entry, or production service reaches either
   catalogued source-mutating module; it also records the only valid
   release-maintenance owner.
12. **8R.37.2 Runtime Reachability Removal** is next. It must decommission the
   named-scope source writer and its production-admission composer while
   preserving normal automatic conversion and policy automation.

## Phase 8R Boundaries

Phase 8R is intentionally not a linear prerequisite for the live UI:

- Native storage, automatic conversion, authority, rollback, backup/restore,
  and runtime reads are platform behavior and remain automated.
- Installation cutover evidence is current-state evidence for a specific
  deployment. It can report a blocked deployment without changing product code
  or holding up the authoring UI.
- Repository retirement is reviewed CI or release-maintenance work. It must
  never be made available to a running Classifarr service.
- Closure artifacts report repository `implementationReadiness` independently
  of installation `instanceCutover`. Neither result authorizes a source change.

The remaining Phase 8R product-adjacent task is 8R.37.2: decommission the
named-scope source-mutation contracts isolated by the completed inventory. It
is parallel work and has no authoring UI.

## Consistency Decisions

- Phase 4R is complete only because its live UI convergence work includes
  browser-level evidence; future work must preserve that proof.
- Completed contract audits do not substitute for browser evidence in future
  workflow changes.
- Existing 6R and 7R completion gates establish reusable foundations, not a
  reason to restart those phases or expose their diagnostics.
- Phase 5R closes with request-bound provider authority, deterministic runtime
  contracts, guarded learning, and revision-bound native changes; future work
  must preserve those server-owned boundaries.
- Historical task labels and implementation records remain searchable, but the
  current execution sequence is the dependency-gated order in this audit and
  the roadmap's `Recommended Next Work` section.
