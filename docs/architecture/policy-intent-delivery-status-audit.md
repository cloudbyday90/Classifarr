# Policy Intent Delivery Status Audit

Status: Current repository audit recorded 2026-08-02.

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
| 4R | Active | Automation-first authoring experience in the running product | Complete 4R.1 through 4R.9 in dependency order |
| 5R | Not closed | Required authority for server read/write, questions, answers, and learning | Close 5R.1 and 5R.2 before 4R.2/4R.3; complete 5R.3 through 5R.9 before material exceptions and final cutover |
| 6R | Contract-complete foundation | Evidence, intent, learning, readiness, workflow, and migration boundaries | Consume through 4R; reopen only for a bounded contract gap |
| 7R | Contract-complete foundation | Runtime decision, question, rebuild, verifier, rollback, and trace boundaries | Preserve through 5R and 8R authority/storage work |
| 8R | Active parallel lanes | Native lifecycle, installation evidence, CI-only retirement, and closure evidence | Collect current installation evidence and complete 8R.37 isolation without blocking 4R |
| 9R | Ongoing enforcement | Zero-debt durable naming and product-language gates | Preserve the baseline in every product change |

## Required Delivery Order

1. **4R.1 Live Entry-Path And Action Inventory** is next. It must observe
   actual routes, modal or page entry, hash/deep-link behavior, new/sparse/
   unmapped/recovering/persisted states, every visible control, and each action
   result. It produces the exact component cutline, not another UI card.
2. **5R.1 Server Intent Contract Authority** follows. It reconciles the server
   read contract with the native authority and bounded workflow projection.
3. **5R.2 Write Preflight And Persistence Boundary** follows. It establishes
   the admitted, idempotent create/update result the browser may invoke.
4. **4R.2 and 4R.3** then build the one validated presentation adapter and bind
   every interactive action to a truthful outcome.
5. **4R.4 and 4R.5** deliver the destination proposal and optional adjustment
   disclosure. They must reduce operator decisions rather than expose engine
   diagnostics.
6. **5R.3 through 5R.9** close model authority, normalization, answer,
   learning, stale-question, verifier, and server-test boundaries.
7. **4R.6 through 4R.9** expose material exceptions only when needed, then
   deliver persisted-policy maintenance, legacy UI cutover, and browser-level
   accessibility/responsive/end-to-end evidence.

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

The remaining Phase 8R product-adjacent task is 8R.37.1: inventory normal
runtime reachability into source-mutation contracts and remove that reachability
from the running application. It is parallel work and has no authoring UI.

## Consistency Decisions

- Phase 4R is an active live UI convergence phase, not a folded checkpoint.
- Completed contract audits do not count as proof of a complete browser flow.
- Existing 6R and 7R completion gates establish reusable foundations, not a
  reason to restart those phases or expose their diagnostics.
- Existing Phase 5R services are not a phase-level completion claim. The
  server authority work needs a defined closure, beginning with its read/write
  tranche.
- Historical task labels and implementation records remain searchable, but the
  current execution sequence is the dependency-gated order in this audit and
  the roadmap's `Recommended Next Work` section.
