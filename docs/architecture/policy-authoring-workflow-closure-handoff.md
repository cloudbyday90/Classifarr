# Policy Authoring Workflow Closure And Phase 4R Handoff

Status: Complete

## Decision

Phase 3R is closed as a **workflow-contract** workstream. It defines the
destination-first authoring model, server-owned option and constraint
boundaries, readiness vocabulary, accessibility requirements, and regression
evidence. It does not claim that the browser now renders the intended product
flow end to end.

Native-storage cutover, compatibility retirement, rollback, and controlled
removal records are Phase 8R work. They remain valid historical and operational
evidence, but they are not prerequisites for Phase 3R closure and do not appear
in its server-contract ledger.

The selected implementation is the small, server-only
`policyAuthoringWorkflowClosureHandoff` audit. It composes the existing
completion ledger instead of extending it into another large service. The audit
requires repository evidence for linked design, service, and test artifacts;
assigns every active Phase 3R server or client contract exactly one truthful
status and a Phase 4R owner; rejects a claim that a Phase 3R contract proves a
live interaction; and makes only `4R.1` eligible next.

This is a maintainer-facing deterministic audit. It has no HTTP route, database
write, provider call, scheduler action, browser state, policy mutation, or
compatibility-removal authority.

## Research Basis

- NIST's Secure Software Development Framework calls for secure practices to
  be integrated throughout the software-development life cycle. A closure gate
  should therefore require design, implementation, and regression evidence,
  rather than treating a planning record as proof of delivery. [NIST SP
  800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- W3C's conformance-evaluation methodology scopes the target, explores it,
  samples representative states, evaluates, and reports results. That supports
  keeping the repository-level contract audit separate from Phase 4R's live
  entry-path and state inventory. [W3C Conformance Evaluation
  Methodology](https://www.w3.org/WAI/test-evaluate/conformance/)
- W3C advises combining automated and human evaluation. The closure audit is
  automated evidence; Phase 4R.1 and 4R.9 remain responsible for the rendered
  and end-to-end interaction evidence that automation alone cannot establish.
  [WCAG 2.2 Conformance](https://www.w3.org/WAI/WCAG22/Understanding/conformance.html)

## Options Considered

### Documentation-Only Closure

Pros: No code change.

Cons: Cannot detect removed source, test, or document artifacts; permits a
historical component record to be mistaken for a live UI result.

Decision: Rejected.

### Extend The Existing Completion Ledger With Phase 4R Logic

Pros: One audit module.

Cons: Mixes completed workflow evidence with planned live UI ownership and
grows an already broad static ledger into a larger singleton.

Decision: Rejected.

### Separate Closure And Handoff Audit

Pros: Preserves the existing completion ledger's narrow purpose; fails closed
on missing evidence, duplicate component ownership, and premature live UI
claims; makes the Phase 4R sequence explicit; keeps removal work in Phase 8R.

Cons: Adds a small service and regression test that must be maintained when
Phase 3R or Phase 4R contract records change.

Decision: Selected.

## Handoff Contract

Every active Phase 3R contract is marked `complete` only after the existing
completion audit and repository-artifact resolver pass. Its `liveUiOutcome` is
always `not_claimed`; the audit fails if a contract is marked as proof of a
live browser result.

Phase 4R handoffs include, for each task, the required rendered entry path,
server projection, action contract, and removal criterion. `4R.1 Live
Entry-Path And Action Inventory` is the only handoff with availability `next`.
Tasks `4R.2` through `4R.9` are `blocked_by_sequence` until their preceding
work has live evidence.

## Outcome

- Phase 3R now contains thirteen workflow server contracts, not the ten
  reclassified Phase 8R retirement contracts.
- Twenty-four active server/client Phase 3R contract records have exactly one
  status and a Phase 4R owner. Server and client records use typed artifact
  keys so identical local IDs cannot collide.
- The closure audit is read-only and fails closed on missing repository
  artifacts, incomplete contract evidence, invalid ownership, duplicate
  handoffs, incomplete Phase 4R handoffs, or premature sequence advancement.
- The Phase 3R handoff target is **4R.1 Live Entry-Path And Action Inventory**.
  The global roadmap currently prioritizes **8R.37.1 Runtime Capability
  Inventory And Isolation Decision** before live UI work resumes.
