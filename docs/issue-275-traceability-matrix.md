# Issue 275 Traceability Matrix

Purpose: provide strict traceability from `docs/issue-275-task-list.md` phases to authoritative requirements in `docs/issue-275-implementation-plan.md`.

## Coverage Legend
- `Task Anchor`: phase header in `docs/issue-275-task-list.md`.
- `Plan Anchors`: governing sections in `docs/issue-275-implementation-plan.md`.
- `Traceability Status`: `Complete` means the phase has at least one direct, normative source section and no unscoped tasks.

## Phase-To-Plan Mapping

### Phase 0: Prep and Alignment
- Task Anchor: `docs/issue-275-task-list.md:5`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:1042` (`Dependencies and Prerequisites`)
  - `docs/issue-275-implementation-plan.md:1045` (`Runtime and Platform Dependencies`)
  - `docs/issue-275-implementation-plan.md:1080` (`External Dependency Contracts`)
  - `docs/issue-275-implementation-plan.md:1100` (`Operational Dependencies and Rollout Blockers`)
  - `docs/issue-275-implementation-plan.md:1112` (`Pre-Flight Execution Checklist`)
- Coverage:
  - prerequisite/runtime validation
  - external dependency fail-open contracts
  - rollout-gate telemetry readiness before implementation freeze
- Traceability Status: Complete

### Phase 1: Migrations and Schema Safety
- Task Anchor: `docs/issue-275-task-list.md:28`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:834` (`Timestamp Migration Package`)
  - `docs/issue-275-implementation-plan.md:843` (`V1 Required Migrations`)
  - `docs/issue-275-implementation-plan.md:949` (`V1 Implemented Optional Migration`)
  - `docs/issue-275-implementation-plan.md:971` (`Migration Quality Gates`)
  - `docs/issue-275-implementation-plan.md:1011` (`Pre-flight data integrity audit queries`)
  - `docs/issue-275-implementation-plan.md:1112` (`Pre-Flight Execution Checklist`, steps 1-2)
- Coverage:
  - migration conformance to required columns/defaults/constraints/comments
  - idempotency/re-run safety and transaction-safe SQL expectations
  - staging pre/post data-integrity validation and schema snapshot workflow
- Traceability Status: Complete

### Phase 2: Config/API Contract Updates
- Task Anchor: `docs/issue-275-task-list.md:65`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:748` (`Configuration Additions (V1)`)
  - `docs/issue-275-implementation-plan.md:1112` (`Pre-Flight Execution Checklist`, step 3)
  - `docs/issue-275-implementation-plan.md:1158` (`Implementation Steps (Backend)`, config normalization/resolver)
  - `docs/issue-275-implementation-plan.md:1410` (`Acceptance Criteria`, config determinism/safety)
- Coverage:
  - full key contract for `GET/PUT /api/settings/ai`
  - strict allowlisting and V1 scope boundaries
  - deterministic normalization/clamping with partial-update safety
- Traceability Status: Complete

### Phase 3: Core Retrieval Loop Implementation
- Task Anchor: `docs/issue-275-task-list.md:100`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:239` (`Uncertainty Triggers`)
  - `docs/issue-275-implementation-plan.md:251` (`Enforcement Order`)
  - `docs/issue-275-implementation-plan.md:264` (`AI Re-Run Policy`)
  - `docs/issue-275-implementation-plan.md:291` (`Contradiction/Conflict Detection`)
  - `docs/issue-275-implementation-plan.md:318` (`Conflict Resolution Rules`)
  - `docs/issue-275-implementation-plan.md:343` (`Expanded Retrieval Query / Query Rewriting`)
  - `docs/issue-275-implementation-plan.md:372` (`Targeted Identification Pass`)
  - `docs/issue-275-implementation-plan.md:406` (`Metadata Completeness Gate`)
  - `docs/issue-275-implementation-plan.md:436` (`Retrieval Pass 2 Strategy`)
  - `docs/issue-275-implementation-plan.md:461` (`Loop Limits / Safety`)
  - `docs/issue-275-implementation-plan.md:1158` (`Implementation Steps (Backend)`)
- Coverage:
  - bounded second-pass lifecycle
  - trigger precedence and targeted policy re-check flow
  - comparator/resolver/strategy selection and rollout decision gate
- Traceability Status: Complete

### Phase 4: Mapping Guards, Violations, and Fallbacks
- Task Anchor: `docs/issue-275-task-list.md:133`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:473` (`Resilience and Auto-Cooldown`)
  - `docs/issue-275-implementation-plan.md:985` (`Database Violations, Conflicts, and Missing Mapping Controls`)
  - `docs/issue-275-implementation-plan.md:988` (`Potential violation/conflict classes`)
  - `docs/issue-275-implementation-plan.md:1036` (`Runtime mapping safeguards`)
  - `docs/issue-275-implementation-plan.md:1376` (`Risks and Mitigations`)
  - `docs/issue-275-implementation-plan.md:1410` (`Acceptance Criteria`, mapping-gap/fail-open determinism)
- Coverage:
  - deterministic mapping eligibility + skip/fallback reason codes
  - SQLSTATE class handling and bounded retry rules
  - dependency-scoped resilience breakers with fail-open baseline protection
- Traceability Status: Complete

### Phase 5: Error Logging and Observability Expansion
- Task Anchor: `docs/issue-275-task-list.md:155`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:540` (`Logging and Observability`)
  - `docs/issue-275-implementation-plan.md:583` (`Decision Trace and Auditability`)
  - `docs/issue-275-implementation-plan.md:735` (`Data Model Changes`, trace storage constraints)
  - `docs/issue-275-implementation-plan.md:1263` (`Tests and Validation`, trace/log expectations)
  - `docs/issue-275-implementation-plan.md:1410` (`Acceptance Criteria`, observability completeness/non-invasiveness)
- Coverage:
  - structured stage log contract and reason taxonomy
  - trace redaction/versioning/bounded truncation
  - dedupe/fingerprint + fail-open logging persistence behavior
- Traceability Status: Complete

### Phase 6: UI (Recommended V1 Scope)
- Task Anchor: `docs/issue-275-task-list.md:177`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:1088` (`Frontend Dependencies`)
  - `docs/issue-275-implementation-plan.md:1233` (`Implementation Steps (Client/UI Recommended)`)
  - `docs/issue-275-implementation-plan.md:1245` (`Client/UI Scope`)
  - `docs/issue-275-implementation-plan.md:1410` (`Acceptance Criteria`, minimal operator UI requirement)
- Coverage:
  - advanced settings controls + rollout guardrails
  - history trace summary + low-confidence diagnostic line
  - backward-compatible UI behavior for legacy rows
- Traceability Status: Complete

### Phase 7: Tests and Validation
- Task Anchor: `docs/issue-275-task-list.md:193`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:1095` (`Testing and Validation Dependencies`)
  - `docs/issue-275-implementation-plan.md:1263` (`Tests and Validation`)
  - `docs/issue-275-implementation-plan.md:1410` (`Acceptance Criteria`)
- Coverage:
  - unit/integration coverage for loop logic, config contract, fallbacks, observability
  - load/perf sanity validation for bounded call/latency impact
  - rollout-semantic parity checks (`shadow` vs `apply`)
- Traceability Status: Complete

### Phase 8: Rollout and Documentation
- Task Anchor: `docs/issue-275-task-list.md:228`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:1100` (`Operational Dependencies and Rollout Blockers`)
  - `docs/issue-275-implementation-plan.md:1112` (`Pre-Flight Execution Checklist`)
  - `docs/issue-275-implementation-plan.md:1362` (`Rollout Steps`)
  - `docs/issue-275-implementation-plan.md:1370` (`Rollout Clarification`)
  - `docs/issue-275-implementation-plan.md:1498` (`Optional Feature Release Checklist`, milestone governance)
- Coverage:
  - ordered go/no-go checklist from pre-flight to apply promotion
  - shadow observation window and promotion gate validation
  - rollback drill + release-note/changelog governance + post-promotion stabilization
- Traceability Status: Complete

### Deferred (V1.1+)
- Task Anchor: `docs/issue-275-task-list.md:256`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:960` (`V1.1 Deferred Migration`)
  - `docs/issue-275-implementation-plan.md:1437` (`Optional Feature Coverage Audit`)
  - `docs/issue-275-implementation-plan.md:1498` (`Optional Feature Release Checklist`)
  - `docs/issue-275-implementation-plan.md:1551` (`Resolved Decisions`, V1 vs V1.1 control scope)
- Coverage:
  - deferred per-policy overrides and advanced diagnostics scope control
  - milestone reclassification governance to prevent unplanned scope creep
- Traceability Status: Complete

## Dependency Chain Traceability
- Task Anchor: `docs/issue-275-task-list.md:263`
- Plan Anchors:
  - `docs/issue-275-implementation-plan.md:1112` (`Pre-Flight Execution Checklist`)
  - `docs/issue-275-implementation-plan.md:1158` (`Implementation Steps (Backend)`)
  - `docs/issue-275-implementation-plan.md:1233` (`Implementation Steps (Client/UI Recommended)`)
  - `docs/issue-275-implementation-plan.md:1263` (`Tests and Validation`)
  - `docs/issue-275-implementation-plan.md:1362` (`Rollout Steps`)
- Coverage:
  - sequencing from prerequisites -> schema -> contract -> core behavior -> guards/observability -> UI -> validation -> rollout
- Traceability Status: Complete
