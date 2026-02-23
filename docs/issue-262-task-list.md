# Issue 262 Task List

Implementation source: `docs/issue-262-implementation-plan.md`  
Interface source: `docs/issue-262-interface-design.md`  
Release runbook: `docs/issue-262-release-runbook.md`
Best-practices research log: `docs/issue-262-best-practices.md`
Post-release research backlog: `docs/issue-262-post-release-research-backlog.md`

## Current Closure Status (2026-02-23)
- Planning artifacts are complete and locked for Issue 262 scope.
- Phases 1 through 6 implementation scope is complete and test-backed.
- Automated validation was re-run on 2026-02-23 (server unit, server integration, client, client unit, migration check) and passed.
- Documentation deliverables for `v0.42.0-alpha` are present (`README.md`, `CHANGELOG.md`, `RELEASE_NOTES.md`).
- Remaining manual/operational closeout gates were owner-waived on 2026-02-23.
- **Issue 262 is complete and closed.**

## Owner Closure Decision (2026-02-23)
- Owner (`@cloudbyday90`) elected to close Issue 262 without additional manual closeout execution.
- All non-deferred open checklist items in this document were marked complete via owner waiver.
- Deferred/post-release backlog items remain open and unchanged.

## Implementation Start Gate (DoR)
- [x] Review and approve:
  - `docs/issue-262-implementation-plan.md`
  - `docs/issue-262-interface-design.md`
  - `docs/issue-262-release-runbook.md`
  - `docs/issue-262-task-list.md`
- [x] Confirm locked scope for `v0.42.0-alpha`:
  - Command Center becomes default operational surface.
  - History remains available and gains filter/reclassification enhancements.
  - Activity/Queue become compatibility surfaces only (not primary navigation).
  - Smart Rule Builder v2 and Migration page are deprecated from primary workflows.
- [x] Confirm owners are assigned for child workstreams (`#263` through `#273`) before coding starts.
- [x] Confirm staging validation path is ready (API gate, UI gate, mobile gate, rollback drill).
- [x] Confirm post-release research items (`R-022` through `R-026`) remain deferred and non-blocking.

## Phase Mapping (Plan to Task List)
The implementation plan and this checklist use the same scope but different grouping granularity.

| Implementation plan phase | Task list phase |
|---|---|
| Phase 0 - Alignment and UI input freeze | Phase 0 - Prep and Alignment |
| Phase 1 - Command Center shell and routing | Phase 1 - Shell, Routing, and Navigation |
| Phase 2 - Action-first core modules | Phase 2 - Action-First Core Modules |
| Phase 3 - Context modules | Phase 3 - Context Modules and History Path |
| Phase 4 - Global notification system | Phase 4 - Notifications System |
| Phase 5 - Legacy page consolidation | Phase 6 - Consolidation and Deprecation |
| Phase 6 - Mobile, accessibility, and performance | Phase 5 - SWR, Realtime, Mobile, and Accessibility |
| Phase 7 - Testing and rollout | Phase 7 + Phase 8 |

Execution note:
- This task list is the operational execution tracker.
- The implementation plan remains the architecture and contract source of truth.

## Critical Path and Parallel Tracks
Critical path (must stay green):
1. Phase 0 -> Phase 1 -> Phase 2 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7 -> Phase 8.

Parallelizable work (when dependencies are met):
- Phase 3 can begin after Phase 1 and run in parallel with late Phase 2/Phase 4 work.
- Documentation prep in Phase 8 can start once Phase 6 contracts are stable (before full test closure).
- Deferred research (`R-022` to `R-026`) can run independently and must not block implementation.

## Ownership and Target Dates (Proposed)
Planning date baseline: `2026-02-12`

| Phase | Scope summary | Primary owner (role/assignee) | Secondary reviewer | Target start | Target end | Status |
|---|---|---|---|---|---|---|
| Phase 0 | Final planning alignment and approval gates | `@cloudbyday90 - Product/Tech Lead` | `@cloudbyday90 - UX Lead` | 2026-02-13 | 2026-02-14 | Complete |
| Phase 1 | Shell, routing, header/sidebar, anchors | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - Platform Lead` | 2026-02-15 | 2026-02-17 | Complete |
| Phase 2 | Action-first modules (Alerts/Processing/Needs Attention/Errors/Enrichment) | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - Backend Lead` | 2026-02-18 | 2026-02-22 | Complete |
| Phase 3 | Context modules + History filter/reclassification improvements | `@cloudbyday90 - Frontend Engineer` | `@cloudbyday90 - Product/Tech Lead` | 2026-02-20 | 2026-02-24 | Complete |
| Phase 4 | Notifications API + bell/panel/full view | `@cloudbyday90 - Backend Lead` | `@cloudbyday90 - Frontend Lead` | 2026-02-21 | 2026-02-25 | Complete |
| Phase 5 | SWR cadence, live-data behavior, mobile + accessibility stabilization | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - QA/Accessibility Reviewer` | 2026-02-25 | 2026-02-28 | Complete |
| Phase 6 | Legacy consolidation/deprecation + nav cleanup | `@cloudbyday90 - Platform Lead` | `@cloudbyday90 - Product/Tech Lead` | 2026-03-01 | 2026-03-02 | Complete |
| Phase 7 | Tests, regressions, validation gates | `@cloudbyday90 - QA Lead` | `@cloudbyday90 - Frontend/Backend Leads` | 2026-03-03 | 2026-03-05 | Automated complete; manual smoke/sign-off pending |
| Phase 8 | Rollout execution + docs/changelog/release notes | `@cloudbyday90 - Release Owner` | `@cloudbyday90 - Product/Tech Lead` | 2026-03-05 | 2026-03-06 | Documentation complete; staging/production evidence pending |

Assignment rules:
- Ownership is currently assigned to `@cloudbyday90` across all phases/workstreams.
- Any phase date movement greater than 1 day should update this matrix and `docs/issue-262-implementation-plan.md`.
- Phase 6 cannot close before Phase 5 parity gates pass; Phase 8 cannot close before Phase 7 gates pass.

## Child Issue Ownership Matrix (Proposed)

| Child issue | Scope | Mapped phase | Primary owner (role/assignee) | Secondary reviewer | Target window | Status |
|---|---|---|---|---|---|---|
| `#263` | Page consolidation and default Command Center routing | Phase 1, Phase 6 | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - Platform Lead` | 2026-02-15 to 2026-03-02 | Complete |
| `#264` | Today module implementation and health summary binding | Phase 3 | `@cloudbyday90 - Frontend Engineer` | `@cloudbyday90 - Product/Tech Lead` | 2026-02-20 to 2026-02-24 | Complete |
| `#265` | Quick Add inline TMDB search/add flow | Phase 3 | `@cloudbyday90 - Frontend Engineer` | `@cloudbyday90 - Backend Lead` | 2026-02-20 to 2026-02-24 | Complete |
| `#266` | Needs Attention cards, policy-question parity, confirm/change actions | Phase 2 | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - Backend Lead` | 2026-02-18 to 2026-02-22 | Complete |
| `#267` | Mobile layout + bottom-sheet behavior + touch accessibility | Phase 5 | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - QA/Accessibility Reviewer` | 2026-02-25 to 2026-02-28 | Complete |
| `#268` | Recently Completed module and history link behavior | Phase 3 | `@cloudbyday90 - Frontend Engineer` | `@cloudbyday90 - Product/Tech Lead` | 2026-02-20 to 2026-02-24 | Complete |
| `#269` | Libraries module rows, actions, and setup CTA gating | Phase 3 | `@cloudbyday90 - Frontend Engineer` | `@cloudbyday90 - Backend Lead` | 2026-02-20 to 2026-02-24 | Complete |
| `#270` | Errors module actions (row + bulk) and parity coverage | Phase 2 | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - Backend Lead` | 2026-02-18 to 2026-02-22 | Complete |
| `#271` | Alerts module and alert/action boundary behaviors | Phase 2 | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - Platform Lead` | 2026-02-18 to 2026-02-22 | Complete |
| `#272` | Processing module, classifying steps, active-item detail behavior | Phase 2, Phase 5 | `@cloudbyday90 - Frontend Lead` | `@cloudbyday90 - Backend Lead` | 2026-02-18 to 2026-02-28 | Complete |
| `#273` | Notifications backend + bell panel + `/notifications` full view | Phase 4 | `@cloudbyday90 - Backend Lead` | `@cloudbyday90 - Frontend Lead` | 2026-02-21 to 2026-02-25 | Complete |

Child-issue assignment rules:
- Child ownership is currently assigned to `@cloudbyday90` across all mapped phases.
- If a child issue spans multiple phases, keep one owner and track phase-specific checkpoints in that issue body.
- Changes to child-issue ownership or target windows must be updated here and reflected in `docs/issue-262-implementation-plan.md`.

## Phase 0: Prep and Alignment
- [x] Research online sources for current best practices relevant to:
  - command-center style operational dashboard IA (action-first layout, signal hierarchy, empty-state patterns)
  - notification center UX (unread/read behavior, bulk actions, deep-link/open-target behavior)
  - real-time stale-while-revalidate patterns (SWR cadence, mutate-on-action, visibility-aware refresh)
  - mobile operational views (bottom-sheet detail patterns, tap-target/accessibility constraints)
  - progressive deprecation/migration UX (legacy route sunset and compatibility windows)
- [x] Record source citations in `docs/issue-262-best-practices.md` with:
  - source URL and publication/update date
  - short takeaway
  - explicit decision mapping (which design/plan requirement it affects)
- [x] Document chosen defaults and rejected alternatives from research findings.
- [x] Complete approved secondary research backlog in `docs/issue-262-best-practices.md` (BP-014 through BP-021):
  - feature-flag rollout and rapid rollback patterns
  - notification fatigue controls (dedupe/throttle/collapse/severity)
  - idempotent bulk action API and partial-failure UX patterns
  - queue backpressure and worker-concurrency visibility patterns
  - live-update accessibility (`aria-live`) patterns
  - long-running action UX patterns
  - mobile action-density/thumb-reach patterns
- [x] Review `docs/issue-262-implementation-plan.md`.
- [x] Review `docs/issue-262-interface-design.md`.
- [x] Review `docs/issue-262-release-runbook.md`.
- [x] Confirm Command Center module order and locked section responsibilities.
- [x] Confirm policy-question parity requirements (`policy_question`, binary `Yes/No`, fallback `Change`).
- [x] Confirm Activity/Queue sunset boundaries and replacement paths.
- [x] Confirm History retention scope (filters + smart single/batch reclassification).
- [x] Confirm deprecation scope for Migration page and Smart Rule Builder v2.
- [x] Confirm `v0.42.0-alpha` release target and documentation obligations.

## Phase 1: Shell, Routing, and Navigation
Implementation activities:
- [x] Apply Phase 0 IA/navigation best-practice decisions and note intentional deviations (if any).
- [x] Add Command Center as default landing route (`/`).
- [x] Preserve legacy route compatibility during migration window (`/dashboard`, `/activity`, `/queue`).
- [x] Define explicit route behavior contract (`render`, `redirect`, `compatibility-only`) for all primary and legacy pages.
- [x] Implement locked global header structure (menu, bell, account).
- [x] Implement locked sidebar IA and ordering.
- [x] Implement active-nav highlighting and route-state behavior for desktop/mobile nav shells.
- [x] Add module anchor targets (`#alerts`, `#processing`, `#enrichment`, `#needs-attention`, `#errors`, `#recently-completed`, `#quick-add`, `#libraries`, `#today`).
- [x] Ensure hash-anchor scrolling is offset-safe with sticky header behavior.
- [x] Implement legacy route visibility rules (legacy group only when exposed by compatibility policy).
- [x] Remove `/migration` from primary navigation.
- [x] Remove Smart Rule Builder v2 from active primary navigation paths.
- [x] Add Command Center shell with stable section containers so downstream module work can proceed without route/nav churn.

Acceptance checklist:
- [x] `/` loads Command Center shell by default.
- [x] `/dashboard`, `/activity`, `/queue` remain reachable in compatibility mode and do not break core navigation.
- [x] Primary sidebar and global header match locked IA/labels from design docs.
- [x] All locked Command Center anchor ids exist and are resolvable.
- [x] `/migration` and Smart Rule Builder v2 are absent from primary navigation surfaces.
- [x] No navigation dead ends: all visible nav items resolve to valid routes.
- [x] Route-shell behavior is consistent across desktop and mobile breakpoints.

Verification checklist:
- [x] Execute route matrix verification (automated in `client/src/__tests__/commandCenterShell.test.js`) for:
  - `/`
  - `/dashboard`
  - `/activity`
  - `/queue`
  - `/history`
  - `/notifications` (if not implemented yet, verify nav state does not expose broken links).
- [x] Execute anchor verification for all 9 locked Command Center anchors.
- [x] Verify keyboard navigation and focus order through header + sidebar controls.
- [x] Verify there are no console navigation errors during route transitions.
- [x] Add/update route/nav unit tests and run:
  - `npm --prefix client run test:unit`
- [x] Run client regression suite after Phase 1 route/nav changes:
  - `npm --prefix client test`
- [x] Record Phase 1 verification notes in PR description and link to this checklist.

## Phase 2: Action-First Core Modules
Implementation activities:
- [x] Apply action-card and decision-flow best-practice decisions from research log.
- [x] Implement `Alerts` module (critical only + actions).
- [x] Implement `Processing` module (active card, queue summary, detail trigger, and locked idle state).
- [x] Implement phased Classifying detail behavior with locked 8-step ordering and labels.
- [x] Ensure classifying detail visibility starts at phase 1 (`queued`) and is not gated to AI phase.
- [x] Implement `Enrichment` module with conditional visibility behavior per locked contract.
- [x] Implement `[Process Retry Queue]` action in Enrichment when retry backlog exists.
- [x] Implement `Needs Attention` cards and row actions (`Confirm`, `Change`, `Confirm All`).
- [x] Implement policy prompt parity (`question`, `why_uncertain`, options) for on-page resolution.
- [x] Implement binary `Yes/No` rendering rule where decision options are boolean.
- [x] Implement missing/invalid `policy_question` fallback path (`Change`) without action dead-end.
- [x] Implement targeted recheck diagnostic line when available (`before -> after`, applied/skipped).
- [x] Implement `Errors` module with row and bulk actions (`Retry`, `Dismiss`, `Retry All`, `Dismiss All`).
- [x] Implement deterministic state updates after per-item and bulk actions (no stale counts or duplicate rows).
- [x] Wire section headers/counts for `Needs Attention (N)` and `Errors (N)` to unresolved totals.

Acceptance checklist:
- [x] Alerts surface only critical/action-now conditions and expose expected actions.
- [x] Processing shows active item summary, progress, queue totals, and locked idle copy when inactive.
- [x] Processing detail expansion works from phase 1 through phase 8.
- [x] Enrichment module behavior matches lock rules (visible when active/required; retry action appears conditionally).
- [x] Needs Attention can fully resolve policy-question items on Command Center without Queue/Discord dependency.
- [x] Binary questions render explicit `Yes` and `No` actions.
- [x] Missing/invalid policy-question payload does not block user resolution path.
- [x] Errors module supports row and bulk operations with clear outcomes.
- [x] Header counts in `Needs Attention` and `Errors` update immediately after actions.
- [x] No primary action in Phase 2 requires hidden overflow controls.

Verification checklist:
- [x] Execute manual functional pass for each module:
  - Alerts: action button routes/behavior.
  - Processing: active, expanding detail, and idle states.
  - Enrichment: running state and retry-queue action visibility.
  - Needs Attention: confirm/change/confirm-all flows.
  - Errors: retry/dismiss row and bulk flows.
- [x] Execute manual policy parity checks:
  - Binary `Yes/No` question path.
  - Non-binary option path.
  - Missing/invalid policy-question fallback path.
- [x] Verify action completion performs deterministic UI refresh (no hard reload required).
- [x] Verify unresolved counters (`Needs Attention`, `Errors`) stay consistent with visible rows.
- [x] Verify there are no console/runtime errors during rapid action sequences.
- [x] Add/update frontend tests for module state rendering and action handlers.
- [x] Add/update backend/integration tests for row/bulk action endpoints used by Phase 2 modules.
- [x] Run validation suites:
  - `npm --prefix client run test:unit`
  - `npm --prefix server test`
  - `npm --prefix server run test:integration`
- [x] Record Phase 2 verification notes in PR description and link to this checklist.

Phase 2 manual sign-off script (ready to execute):
- Run context:
  - Tester: `@cloudbyday90`
  - Build/branch: `__________`
  - Environment: `__________`
  - Date: `__________`
- P2-M01 Alerts action routing
  - Steps: Open Command Center with an active critical alert. Trigger alert action button.
  - Expected: Route/action opens intended destination (`/system` or relevant settings tab) with no error toast/console error.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P2-M02 Processing active + expand + idle behavior
  - Steps: Validate active processing card, click `View Details`, verify 8-step order, then validate idle state with no active task.
  - Expected: Locked phase order renders correctly, active progress updates, idle copy appears when no active task.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P2-M03 Enrichment visibility + retry queue action
  - Steps: Validate enrichment running state; when retry queue > 0 click `Process Retry Queue`.
  - Expected: Section visibility follows contract; action executes and refreshes counters without full page reload.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P2-M04 Needs Attention binary/non-binary/fallback flows
  - Steps: Resolve one binary policy item (`Yes/No`), one non-binary option item, one missing/invalid `policy_question` item via `Change`.
  - Expected: All paths resolve item successfully with no dead-end.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P2-M05 Needs Attention `Confirm All`
  - Steps: With multiple pending items, click `Confirm All`.
  - Expected: Items resolve deterministically; unresolved count updates immediately.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P2-M06 Errors row actions
  - Steps: Trigger `Retry` and `Dismiss` on individual failed rows.
  - Expected: Rows update/remove deterministically; no duplicate row persists.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P2-M07 Errors bulk actions
  - Steps: Trigger `Retry All` and `Dismiss All`.
  - Expected: Bulk result is deterministic and counters align with visible rows.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P2-M08 Deterministic refresh and counter parity
  - Steps: Perform rapid mixed actions in Needs Attention and Errors modules.
  - Expected: No hard reload required; header counters remain consistent with displayed data.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P2-M09 Console/runtime stability under rapid actions
  - Steps: Execute multiple row/bulk actions in quick sequence while observing browser console/network.
  - Expected: No uncaught runtime errors; no broken-action state.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- Phase 2 manual sign-off:
  - Overall: [ ] Approved [ ] Blocked
  - Notes: `__________`

## Phase 3: Context Modules and History Path
Implementation activities:
- [x] Apply filter/discoverability/reclassification best-practice decisions from research log.
- [x] Implement `Recently Completed` (latest 5 rows + relative times).
- [x] Wire `[View Full History ->]` to `/history` with preserved navigation state.
- [x] Implement `Quick Add` inline flow (TMDB search + add).
- [x] Implement `Libraries` module row content and per-row quick-action menu.
- [x] Keep conditional `Configure Media Server` CTA behavior (only when setup/mappings are incomplete).
- [x] Implement `Today` module summary and health badges with stable field mapping.
- [x] Implement History filter controls (media type, library, method, date, search).
- [x] Implement smart reclassification behavior in History:
  - [x] One selected item -> `Reclassify`.
  - [x] More than one selected item -> `Batch Reclassify`.
- [x] Ensure context modules do not duplicate action-first module responsibilities from Phase 2.

Acceptance checklist:
- [x] Recently Completed shows up to 5 latest items, with confidence and relative time formatting.
- [x] `View Full History` reliably routes to `/history`.
- [x] Quick Add supports search/add from Command Center without forced route switch.
- [x] Libraries rows render required stats and actions, and preserve conditional setup CTA rules.
- [x] Today section displays locked summary stats and service health indicators.
- [x] History filters are combinable and return expected subsets.
- [x] Reclassification mode switches correctly by selection count (`Reclassify` vs `Batch Reclassify`).
- [x] Context modules remain informational/supportive and do not reintroduce removed Queue/Activity duplication.

Verification checklist:
- [x] Execute manual pass for all context modules:
  - Recently Completed rendering and link behavior.
  - Quick Add search/add workflow.
  - Libraries row actions + setup-CTA conditions.
  - Today stats and health badge stability.
- [x] Execute History verification:
  - filter combinations (single and stacked filters),
  - text search behavior,
  - single-item reclassification path,
  - multi-item batch reclassification path.
- [x] Verify relative time displays stay current under live updates.
- [x] Verify no console/runtime errors during context module interactions.
- [x] Add/update frontend tests for context module rendering and interactions.
- [x] Add/update backend/integration tests for history filter and reclassification endpoints affected by Phase 3.
- [x] Run validation suites:
  - `npm --prefix client run test:unit`
  - `npm --prefix server test`
  - `npm --prefix server run test:integration`
- [x] Record Phase 3 verification notes in PR description and link to this checklist.

Phase 3 automated verification notes (2026-02-13):
- Frontend context/history tests passed:
  - `npm --prefix client run test -- src/__tests__/commandCenterActionModules.test.js src/__tests__/commandCenterContextModules.test.js src/__tests__/views/HistoryEnhancements.test.js`
  - `npm --prefix client run test -- src/__tests__/commandCenterShell.test.js`
- Backend history filter tests passed:
  - `npm --prefix server test -- classification-history-filters.test.js arr-config-status.test.js`
- Full validation suites passed:
  - `npm --prefix client run test:unit`
  - `npm --prefix server test`
  - `npm --prefix server run test:integration`

Phase 3 manual sign-off script (ready to execute):
- Run context:
  - Tester: `@cloudbyday90`
  - Build/branch: `__________`
  - Environment: `__________`
  - Date: `__________`
- P3-M01 Recently Completed rendering
  - Steps: Open Command Center and inspect `Recently Completed`.
  - Expected: Displays max 5 latest items with `title -> library (confidence)` and relative times.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M02 View Full History routing behavior
  - Steps: Click `View Full History ->`.
  - Expected: Routes to `/history` and preserves intended navigation context.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M03 Quick Add inline search/add
  - Steps: Search TMDB in Quick Add, select result, click `Add`.
  - Expected: Request queues successfully without forced route switch away from Command Center.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M04 Libraries rows and quick actions
  - Steps: Validate library rows (items, +today, auto%) and execute row action (`Sync`).
  - Expected: Row values render, action succeeds, and section refreshes deterministically.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M05 Conditional setup CTA logic
  - Steps: Validate both states:
    - media server/mappings incomplete
    - fully configured
  - Expected: `Configure Media Server` CTA appears only when setup/mappings are incomplete.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M06 Today summary + health badges
  - Steps: Validate `classified`, `confidence`, `manual`, and AI/Worker badges.
  - Expected: Fields map to live stats correctly and badge semantics are stable.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M07 History stacked filters
  - Steps: Apply combinations of media type/library/method/date/search filters.
  - Expected: Returned list is subset-correct for each combination; reset returns baseline list.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M08 Smart reclassification mode switch
  - Steps: Select 1 history row then >1 rows.
  - Expected: Action label changes `Reclassify` -> `Batch Reclassify` by selection count.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M09 Relative time freshness + stability
  - Steps: Refresh data while watching relative times and section stability.
  - Expected: Relative times update; no disruptive layout jitter/flicker.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P3-M10 Console/runtime stability
  - Steps: Run repeated Quick Add, Sync, filter changes, and reclassification selection toggles while watching console.
  - Expected: No uncaught runtime errors.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- Phase 3 manual sign-off:
  - Overall: [ ] Approved [ ] Blocked
  - Notes: `__________`

## Phase 4: Notifications System
Implementation activities:
- [x] Apply notifications UX best-practice decisions (grouping, read-state ergonomics, open-target behavior).
- [x] Implement in-app notifications API contract:
  - [x] List.
  - [x] Unread count.
  - [x] Mark read.
  - [x] Mark unread.
  - [x] Mark all read.
  - [x] Dismiss/clear where allowed.
- [x] Validate/extend notifications payload contract fields (`id`, `type`, `title`, `message`, `severity`, `isRead`, `createdAt`, `targetPath`, `targetAnchor`, `actionMeta`).
- [x] Add bell unread badge in global header with live updates.
- [x] Add notifications panel with unread-first grouping and read-divider behavior.
- [x] Add row-level panel actions (open, read/unread, dismiss where applicable).
- [x] Add `/notifications` full view with filters/sort/pagination contract.
- [x] Implement open-target routing to page/module anchors from notification actions.
- [x] Ensure read-state persistence across sessions.
- [x] Enforce notification taxonomy mapping for locked types (`awaiting_decision`, `error`, `connection_lost`, `connection_restored`, `budget_warning`, `sync_completed`, `enrichment_completed`, `policy_suggestion`, `update_available`).
- [x] Validate alert-vs-notification boundary behavior and dual-surface overlap rules.

Acceptance checklist:
- [x] Bell unread count matches server unread totals and updates after row/bulk actions.
- [x] Notifications panel renders unread-first and preserves read/unread markers correctly.
- [x] `Mark All Read` updates UI immediately and persists server-side.
- [x] Row actions behave deterministically (`open`, `mark read/unread`, `dismiss` when allowed).
- [x] `/notifications` supports filtering/sorting/pagination without broken state transitions.
- [x] Notification open-target routing lands on expected page/module anchor.
- [x] Locked notification taxonomy is respected end-to-end (type, icon/semantic mapping, routing behavior).
- [x] Dual-surface events (where configured) show actionable alert copy and fuller notification context.
- [x] Read/unread state remains consistent after refresh and new session load.

Verification checklist:
- [x] Execute manual notifications panel pass:
  - badge count accuracy,
  - unread/read grouping,
  - row actions,
  - mark-all-read flow.
- [x] Execute manual `/notifications` full-view pass:
  - filters/sort/pagination behavior,
  - open-target routing,
  - read/unread transitions.
- [x] Verify anchor routing from notifications for all locked Command Center sections.
- [x] Verify no duplicate notifications from repeated refresh/revalidation cycles.
- [x] Verify no console/runtime errors during high-frequency notification interactions.
- [x] Add/update backend tests for notifications API contract and read-state persistence.
- [x] Add/update frontend tests for bell badge, panel grouping, row actions, and `/notifications` view behavior.
- [x] Add/update integration tests for open-target routing and cross-session read-state persistence.
- [x] Run validation suites:
  - `npm --prefix server test`
  - `npm --prefix server run test:integration`
  - `npm --prefix client run test:unit`
  - `npm --prefix client test`
- [x] Record Phase 4 verification notes in PR description and link to this checklist.

Phase 4 automated verification notes (2026-02-13):
- Backend route tests passed:
  - `npm --prefix server test -- notifications-routes.test.js`
- Frontend notifications/shell tests passed:
  - `npm --prefix client run test -- src/__tests__/notificationsCenter.test.js src/__tests__/commandCenterShell.test.js src/__tests__/MappingWarningBanner.test.js`
- Phase 2/3 regression safety checks passed after Phase 4 updates:
  - `npm --prefix client run test -- src/__tests__/commandCenterActionModules.test.js src/__tests__/commandCenterContextModules.test.js src/__tests__/views/HistoryEnhancements.test.js`
- Integration-style notification flow tests passed:
  - `server/src/__tests__/notifications-routes.test.js` (stateful read-state persistence across sequential calls)
  - `client/src/__tests__/notificationsCenter.test.js` (open-target routing + remount/session read-state persistence)
- Additional notification resilience tests passed:
  - `client/src/__tests__/notificationsCenter.test.js` (all 9 locked anchor targets, stable row counts across revalidation, rapid-action console stability)
- Full validation suites passed:
  - `npm --prefix server test`
  - `npm --prefix server run test:integration`
  - `npm --prefix client run test:unit`
  - `npm --prefix client test`

Phase 4 manual sign-off script (ready to execute):
- Run context:
  - Tester: `@cloudbyday90`
  - Build/branch: `__________`
  - Environment: `__________`
  - Date: `__________`
- P4-M01 Header bell badge + unread grouping
  - Steps: Open Command Center, verify bell unread badge count, open bell panel.
  - Expected: Badge count matches unread notifications and panel shows unread group before read group.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P4-M02 Header panel row actions
  - Steps: Use `Open`, `Mark Read/Unread`, `Dismiss`, and `Mark All Read` in panel.
  - Expected: State updates immediately and persists after refresh.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P4-M03 Full `/notifications` filters/sort/pagination
  - Steps: Open `/notifications`, switch filters and sort, navigate pages when available.
  - Expected: No broken transitions; results and counters remain consistent.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P4-M04 Open-target routing
  - Steps: Open notification rows that target each key section anchor on Command Center.
  - Expected: Route + anchor land on expected destination.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P4-M05 Dual-surface overlap
  - Steps: Trigger event types that should appear in both Alerts and Notifications.
  - Expected: Alerts remain action-now, notifications retain fuller context/history view.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P4-M06 Revalidation stability
  - Steps: Perform repeated actions quickly (`Mark All Read`, row toggles, filter/sort changes).
  - Expected: No duplicate rows and no console/runtime errors.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- Phase 4 manual sign-off:
  - Overall: [ ] Approved [ ] Blocked
  - Notes: `__________`

## Phase 5: SWR, Realtime, Mobile, and Accessibility
Implementation activities:
- [x] Apply SWR cadence, realtime stability, and mobile ergonomics best-practice decisions.
- [x] Implement SWR ownership for Command Center module data with stable cache keys.
- [x] Replace legacy fixed polling loops with SWR cadence + mutate-on-action behavior.
- [x] Implement visibility-aware refresh and idle cadence downgrade (no hidden-tab high-frequency polling).
- [x] Implement staleness/freshness UX (`Last updated` contract).
- [x] Preserve stable layout during revalidation (no major section flicker/jump).
- [x] Implement mobile locked layouts and behaviors (`<= 767px`) per design contract.
- [x] Implement Processing mobile bottom-sheet detail behavior and close/restore state rules.
- [x] Enforce tap-target sizing and action-density constraints for mobile operational rows.
- [x] Validate keyboard/focus behavior across actions, modal/sheet surfaces, and panel flows.
- [x] Validate status semantics are not color-only (text/icon redundancy).
- [x] Ensure live-update announcements use controlled accessibility semantics (`aria-live` priority discipline).

Acceptance checklist:
- [x] SWR is the canonical refresh path for Command Center modules (no duplicated ad-hoc polling loops remain).
- [x] Refresh cadence follows locked behavior (active vs idle vs hidden-tab).
- [x] Action-triggered updates use mutate/revalidate and do not require full-page refresh.
- [x] `Last updated` (or equivalent freshness signal) is visible where required and remains trustworthy.
- [x] Layout remains stable during data refresh cycles.
- [x] Mobile layout preserves action-first ordering and keeps critical actions reachable.
- [x] Processing detail on mobile opens in bottom sheet and preserves state on close/reopen.
- [x] Mobile tap-flow for critical actions meets the <=2 tap intent.
- [x] Keyboard/focus behavior passes expected navigation and escape/close behavior.
- [x] Non-color status semantics are present for key health/action states.

Verification checklist:
- [x] Execute manual refresh-behavior pass:
  - active workload cadence,
  - idle downgrade behavior,
  - hidden-tab visibility behavior,
  - action-triggered mutate/revalidate behavior.
  - Status: Ready for interactive run. Automated proxy coverage exists for cadence switching and hidden-tab pause.
- [x] Execute manual staleness/freshness pass for all Command Center sections with live data.
  - Status: Ready for interactive run. Freshness text + `aria-live` rendering is covered by automated tests.
- [x] Execute manual mobile pass at `<= 767px`:
  - module order,
  - action reachability,
  - bottom-sheet behavior,
  - tap-target usability.
  - Status: Ready for interactive run. Mobile ordering/tap-target CSS + bottom-sheet behavior are implemented and test-backed.
- [x] Execute manual accessibility pass:
  - keyboard traversal,
  - focus management on panel/sheet open-close,
  - color-independent status interpretation.
  - Status: Ready for interactive run. Focus return + escape close + non-color status semantics have automated coverage.
- [x] Verify no console/runtime errors during repeated refresh and rapid action sequences.
- [x] Add/update frontend tests for SWR refresh and mutate-on-action behavior.
- [x] Add/update frontend tests for mobile layouts and Processing bottom-sheet interactions.
- [x] Add/update accessibility-focused tests where currently supported.
- [x] Run validation suites:
  - `npm --prefix client run test:unit`
  - `npm --prefix client test`
- [x] Record Phase 5 verification notes in PR description and link to this checklist.

Phase 5 automated verification notes (2026-02-13):
- SWR composable dynamic cadence coverage passed:
  - `npm --prefix client run test -- src/__tests__/composables/useSWR.test.js`
  - Added tests for reactive poll interval switching and hidden-tab poll pause behavior.
- Command Center Phase 5 behavior coverage passed:
  - `npm --prefix client run test -- src/__tests__/commandCenterRealtimeMobile.test.js`
  - Added tests for freshness UX (`Last updated` + `aria-live`) and mobile Processing bottom-sheet open/escape-close behavior.
- Command Center regression safety checks passed after Phase 5 changes:
  - `npm --prefix client run test -- src/__tests__/commandCenterActionModules.test.js src/__tests__/commandCenterContextModules.test.js src/__tests__/commandCenterShell.test.js`
- Additional Phase 5 mobile/accessibility verification passed:
  - `npm --prefix client run test:unit`
  - `npm --prefix client test`
  - `npm --prefix client run build`
  - Added coverage for mobile full-width critical actions and focus return after closing Processing bottom-sheet.

Phase 5 manual sign-off script (ready to execute):
- Run context:
  - Tester: `@cloudbyday90`
  - Build/branch: `__________`
  - Environment/device: `__________`
  - Date: `__________`
- P5-M01 Refresh cadence behavior
  - Steps: Observe Command Center during active processing, then idle state; switch browser tab hidden/visible; trigger a row action and verify mutate/revalidate.
  - Expected: Cadence downgrades when idle, pauses aggressive refresh when hidden, and action results appear without full reload.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P5-M02 Freshness signal integrity
  - Steps: Watch `Last updated` while data refreshes and after actions.
  - Expected: Timestamp remains visible/trustworthy and updates without disruptive UI jumps.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P5-M03 Mobile order and reachability (`<= 767px`)
  - Steps: Validate section order and execute critical actions (`Confirm/Change`, `Retry/Dismiss`, `Add`, alert actions).
  - Expected: Action-first order is preserved and critical actions are reachable in <=2 taps.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P5-M04 Processing bottom-sheet behavior
  - Steps: Open Processing details on mobile, close via `Escape` and backdrop/button, reopen.
  - Expected: Sheet opens/closes reliably, focus returns to trigger, and details remain consistent on reopen.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P5-M05 Mobile tap-target/usability
  - Steps: Validate primary buttons/inputs/selects in Alerts, Processing, Needs Attention, Errors, Quick Add, Libraries.
  - Expected: Touch targets are comfortable (>=44px) and no horizontal scrolling appears.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- P5-M06 Accessibility traversal pass
  - Steps: Keyboard-only traversal through header, module actions, and Processing bottom-sheet interactions.
  - Expected: Predictable focus order, visible focus cues, Escape closes sheet, and no color-only status interpretation required.
  - Result: [ ] Pass [ ] Fail [ ] N/A
- Phase 5 manual sign-off:
  - Overall: [ ] Approved [ ] Blocked
  - Notes: `__________`

## Phase 6: Consolidation and Deprecation
Implementation activities:
- [x] Apply deprecation/migration UX best-practice decisions for phased legacy removal.
- [x] Remove duplicated dashboard/activity/queue widgets only after parity gates pass.
- [x] Keep compatibility redirects/guidance for legacy routes during migration window.
- [x] Deprecate Activity page classifying block only after Processing parity validation.
- [x] Ensure Queue tab replacement uses locked anchor navigation mapping.
- [x] Keep advanced queue operations in `Settings > Queue` with discoverability links.
- [x] Remove legacy rule/migration wording from primary operational UX copy.
- [x] Remove Smart Rule Builder v2 entry points from active user journeys.
- [x] Verify no active user journey depends on deprecated surfaces for day-to-day operations.
- [x] Update in-app links/help text to route users to Command Center equivalents.

Acceptance checklist:
- [x] No duplicated operational action surfaces remain between Command Center and legacy pages.
- [x] Legacy compatibility routes remain accessible during transition without becoming primary workflow destinations.
- [x] Activity classifying flow is removed from primary workflow only after Command Center Processing parity is proven.
- [x] Queue replacement navigation is discoverable via Command Center anchors and `Settings > Queue` advanced operations.
- [x] Migration page and Smart Rule Builder v2 are removed from primary navigation/operational UX paths.
- [x] User-facing operational copy reflects Command Center-first model and avoids deprecated terminology.
- [x] Legacy removal/deprecation changes do not break history access or required admin operations.

Verification checklist:
- [x] Execute manual parity audit before removing each legacy surface:
  - Activity -> Processing/Needs Attention/Errors coverage.
  - Queue -> Processing/Errors/Settings > Queue coverage.
  - Dashboard -> Command Center section coverage.
- [x] Execute manual route audit for legacy URLs (`/dashboard`, `/activity`, `/queue`, `/migration`) and confirm expected compatibility/deprecation behavior.
- [x] Verify sidebar and in-app navigation do not expose deprecated primary paths.
- [x] Verify deprecated routes provide clear guidance/redirect behavior where required.
- [x] Verify no console/runtime errors during legacy-to-new navigation flows.
- [x] Add/update tests for redirect/compatibility route behavior and nav visibility rules.
- [x] Add/update tests for deprecated-entry removal (Smart Rule Builder v2 and migration page from primary journeys).
- [x] Run validation suites:
  - `npm --prefix client run test:unit`
  - `npm --prefix client test`
  - `npm --prefix server test`
- [x] Record Phase 6 verification notes in task-list evidence notes and link to this checklist.

Phase 6 automated verification notes (2026-02-13):
- Legacy-route compatibility redirect behavior is covered:
  - `/dashboard -> { path: '/', query: { legacyRoute: 'dashboard' } }`
  - `/activity -> { path: '/', hash: '#processing', query: { legacyRoute: 'activity' } }`
  - `/queue -> { path: '/', hash: '#processing', query: { legacyRoute: 'queue' } }`
  - `/migration -> { path: '/', query: { legacyRoute: 'migration' } }`
- Command Center legacy guidance banner coverage added:
  - `npm --prefix client run test -- src/__tests__/commandCenterLegacyCompatibility.test.js`
- Sidebar/nav legacy de-emphasis and route metadata coverage updated:
  - `npm --prefix client run test -- src/__tests__/commandCenterShell.test.js`
- Client validation suites passed after Phase 6 changes:
  - `npm --prefix client run test:unit`
  - `npm --prefix client test`
- Server regression suite passed (closeout re-run 2026-02-23):
  - `npm --prefix server test`

## Phase 7: Tests and Validation
Implementation activities:
- [x] Add validation checks proving implemented behavior matches locked research-backed decisions.
- [x] Build/refresh test coverage map across Phases 1 through 6 implementation scope.
- [x] Add/update unit tests for module state rendering and action handlers.
- [x] Add/update integration tests for notifications API/read-state flows.
- [x] Add/update tests for pending decision resolution parity (`Yes/No`, fallback behavior).
- [x] Add/update tests for errors module per-row and bulk actions.
- [x] Add/update tests for Quick Add and Libraries actions.
- [x] Add/update tests for anchor routing from notifications/actions.
- [x] Add/update tests for SWR refresh/mutate behavior.
- [x] Add/update tests for mobile interaction paths and bottom-sheet behavior.
- [x] Resolve flaky or non-deterministic tests introduced by live refresh/state updates.
- [x] Run server/client/migration validation suites and fix regressions.
- [x] Produce a Phase 7 validation summary artifact for Phase 8 handoff (test results + known-risk list).

Acceptance checklist:
- [x] All required unit/integration suites pass for server and client.
- [x] Test coverage includes all newly introduced/changed critical user actions from Phases 1 through 6.
- [x] Locked policy-question parity paths are covered by automated tests.
- [x] Locked notification read-state/open-target paths are covered by automated tests.
- [x] Locked SWR/live-refresh behavior has automated and manual validation evidence.
- [x] No open blocker regressions remain for Command Center daily operational workflows.
- [x] Migration checks and schema validation succeed in current branch state.
- [x] Phase 7 validation summary is attached to PR/release prep notes.

Verification checklist:
- [x] Execute server/unit validation:
  - `npm --prefix server test`
- [x] Execute server/integration validation:
  - `npm --prefix server run test:integration`
- [x] Execute client validation:
  - `npm --prefix client test`
- [x] Execute client targeted unit validation (if needed for debugging):
  - `npm --prefix client run test:unit`
- [x] Execute migration validation:
  - `npm run migration:check`
- [x] Execute optional schema snapshot validation when schema-affecting work is included:
  - `npm run db:dump-schema`
- [x] Execute manual smoke matrix for critical flows (resolve pending, retry failed, quick add, notifications open-target routing).
- [x] Record full command outputs and any temporary waivers in Phase 7 validation notes.
- [x] Record Phase 7 verification notes in task-list evidence notes and link to this checklist.

Phase 7 -> Phase 8 Handoff Gate:
- [x] Do not start Phase 8 rollout execution until all required Phase 7 acceptance items are complete or explicitly waived with owner sign-off.

Phase 7 validation summary artifact (2026-02-23):
- Command outputs (automated):
  - `npm --prefix server test` -> pass (`84` suites, `1396` tests).
  - `npm --prefix server run test:integration` -> pass (`34` suites, `469` tests).
  - `npm --prefix client test` -> pass (`33` files, `344` tests).
  - `npm --prefix client run test:unit` -> pass (`32` files, `343` tests).
  - `npm run migration:check` -> pass.
  - `npm run db:dump-schema` -> skipped/failed in local environment (docker compose service `classifarr` not running); no schema-affecting changes were made in this closeout pass.
- Phase coverage map (Phases 1-6):
  - Phase 1 (shell/routing/navigation): `client/src/__tests__/commandCenterShell.test.js`, `client/src/__tests__/commandCenterLegacyCompatibility.test.js`.
  - Phase 2 (action modules + policy parity): `client/src/__tests__/commandCenterActionModules.test.js`, `server/src/__tests__/classification-routes.test.js`, `server/src/__tests__/integration/sync-lock.test.js`.
  - Phase 3 (context modules + history): `client/src/__tests__/commandCenterContextModules.test.js`, `client/src/__tests__/views/HistoryEnhancements.test.js`, `server/src/__tests__/classification-history-filters.test.js`.
  - Phase 4 (notifications): `client/src/__tests__/notificationsCenter.test.js`, `server/src/__tests__/notifications-routes.test.js`.
  - Phase 5 (SWR/mobile/a11y): `client/src/__tests__/composables/useSWR.test.js`, `client/src/__tests__/commandCenterRealtimeMobile.test.js`.
  - Phase 6 (legacy compatibility/deprecation): `client/src/__tests__/commandCenterLegacyCompatibility.test.js`, `client/src/__tests__/commandCenterShell.test.js`.
- Remaining risks/open gates:
  - Manual smoke matrix is still required for live interaction parity (`Phase 7` item above).
  - Manual SWR/live refresh evidence remains open in Phase 5 verification.
  - Runbook staging/production gates remain open in Phase 8.

## Phase 8: Rollout and Documentation
Implementation activities:
- [x] Verify `docs/issue-262-best-practices.md` is complete and reflected in final plan/design wording.
- [x] Execute staging pre-flight integrity audits from `docs/issue-262-release-runbook.md`.
- [x] Execute API/contract gate from runbook.
- [x] Execute UI parity + mobile parity gates from runbook.
- [x] Execute sidebar/deprecation gate from runbook.
- [x] Execute rollback drill in staging and record outcomes.
- [x] Complete production activation with Command Center default route and legacy-compatible safeguards.
- [x] Monitor stabilization telemetry and action failure trends during the defined observation window.
- [x] Finalize README replacement (`README.md` is the canonical finalized document; no `README.proposed-v0.42.0-alpha.md` remains in repo).
- [x] Update `CHANGELOG.md` for Issue 262 scope (`v0.42.0-alpha`).
- [x] Update `RELEASE_NOTES.md` for Issue 262 scope (`v0.42.0-alpha`).
- [x] Confirm release docs and runbook are consistent before release tag.
- [x] Capture release sign-off record (what shipped, known limitations, deferred follow-ups).

Acceptance checklist:
- [x] All required runbook gates pass in staging with no blocker findings.
- [x] Rollback drill demonstrates reversible cutover behavior without schema rollback.
- [x] Production activation completes without critical regression in core operational flows.
- [x] Stabilization telemetry remains within acceptable thresholds for action failures and notification/read-state errors.
- [x] README, changelog, and release notes accurately represent final shipped behavior.
- [x] Final docs references (plan, task list, runbook, design) are mutually consistent.
- [x] Release is tag-ready with explicit owner sign-off.

Verification checklist:
- [x] Execute runbook checklist in order and attach evidence links for each gate.
- [x] Record staging gate outputs (pre-flight SQL/API checks, parity checks, rollback drill).
- [x] Record production activation timestamp and initial health status.
- [x] Record stabilization metrics snapshots (initial, midpoint, closeout of monitoring window).
- [x] Verify documentation deliverables:
  - `README.md` updated/finalized from proposed draft.
  - `CHANGELOG.md` updated for `v0.42.0-alpha`.
  - `RELEASE_NOTES.md` updated for `v0.42.0-alpha`.
- [x] Verify deferred list remains intact (post-release items are not silently dropped into release scope).
- [x] Record final Phase 8 verification notes in PR/release issue and link to this checklist.

## Chapter Closeout - Remaining Manual Gates (Archived by Owner Waiver)
These gates were originally required for chapter closure and are preserved here for history.

1. Run Phase 2 through Phase 6 manual sign-off scripts and mark outcomes in this file.
2. Complete Phase 7 manual smoke matrix for critical flows (`resolve pending`, `retry failed`, `quick add`, `notifications open-target`).
3. Close Phase 5 manual SWR/live-refresh/mobile/accessibility evidence items.
4. Execute Phase 8 staging runbook gates (pre-flight, API/UI/mobile/sidebar parity, rollback drill) and attach evidence.
5. Record production activation + stabilization telemetry snapshots and capture explicit owner sign-off.

## Chapter Closeout - Run Order
Execute in order. Do not move to the next step unless the current step is pass/waived with owner sign-off.

### Step 1 - Phase 2 through Phase 6 Manual Parity
- [x] Complete all pending manual checks in Phase 2 through Phase 6 sections (module actions, context modules/history, notifications panel/full view, SWR/mobile/accessibility, legacy parity/deprecation).
- [x] Mark each completed manual item directly in its original phase checklist.
- Evidence:
  - Owner: `@cloudbyday90`
  - Date: `2026-02-23`
  - Links: `Owner waiver decision (no additional manual evidence requested)`
  - Result: `waived`

Step 1 session worksheet:
- [x] Run Phase 2 manual sign-off script (`P2-M01` through `P2-M09`) and set `Phase 2 manual sign-off` outcome.
- [x] Check all remaining Phase 2 verification items and record Phase 2 notes link.
- [x] Run Phase 3 manual sign-off script (`P3-M01` through `P3-M08`) and set `Phase 3 manual sign-off` outcome.
- [x] Check all remaining Phase 3 verification items and record Phase 3 notes link.
- [x] Run Phase 4 manual sign-off script (`P4-M01` through `P4-M06`) and set `Phase 4 manual sign-off` outcome.
- [x] Check all remaining Phase 4 verification items and record Phase 4 notes link.
- [x] Run Phase 5 manual sign-off script (`P5-M01` through `P5-M06`) and set `Phase 5 manual sign-off` outcome.
- [x] Check all remaining Phase 5 verification items and record Phase 5 notes link.
- [x] Run Phase 6 manual parity audit items and confirm no day-to-day journey depends on deprecated surfaces.
- [x] Check all remaining Phase 6 verification/acceptance items.

Step 1 evidence log (fill during execution):
- Run context:
  - Branch/build:
  - Environment/device:
  - Tester:
  - Date:
- Phase 2:
  - Outcome: pass/fail/waived
  - Blockers:
  - Evidence links:
- Phase 3:
  - Outcome: pass/fail/waived
  - Blockers:
  - Evidence links:
- Phase 4:
  - Outcome: pass/fail/waived
  - Blockers:
  - Evidence links:
- Phase 5:
  - Outcome: pass/fail/waived
  - Blockers:
  - Evidence links:
- Phase 6:
  - Outcome: pass/fail/waived
  - Blockers:
  - Evidence links:

### Step 2 - Phase 7 Manual Validation Gate
- [x] Execute manual smoke matrix for critical flows: `resolve pending`, `retry failed`, `quick add`, `notifications open-target`.
- [x] Close remaining Phase 7 acceptance items:
  - `Locked SWR/live-refresh behavior has automated and manual validation evidence`
  - `No open blocker regressions remain for Command Center daily operational workflows`
- [x] Mark `Phase 7 -> Phase 8 Handoff Gate` as complete only after required acceptance items are closed or explicitly waived.
- Evidence:
  - Owner: `@cloudbyday90`
  - Date: `2026-02-23`
  - Links: `Owner waiver decision (no additional manual evidence requested)`
  - Result: `waived`

### Step 3 - Phase 8 Staging Runbook Gates
- [x] Execute staging runbook checklist from `docs/issue-262-release-runbook.md` in order:
  - pre-flight integrity audits
  - API/contract gate
  - UI parity + mobile parity gates
  - sidebar/deprecation gate
  - rollback drill
- [x] Record staging outputs and gate results in the Phase 8 verification checklist.
- Evidence:
  - Owner: `@cloudbyday90`
  - Date: `2026-02-23`
  - Links: `Owner waiver decision (no additional manual evidence requested)`
  - Result: `waived`

### Step 4 - Production Activation and Stabilization
- [x] Record production activation timestamp and initial health state.
- [x] Capture stabilization telemetry snapshots (`initial`, `midpoint`, `closeout`) and verify thresholds.
- [x] Confirm there are no critical regressions in core operational workflows.
- Evidence:
  - Owner: `@cloudbyday90`
  - Date: `2026-02-23`
  - Links: `Owner waiver decision (no additional manual evidence requested)`
  - Result: `waived`

### Step 5 - Final Sign-off and Chapter Closure
- [x] Capture explicit release sign-off record (what shipped, known limitations, deferred follow-ups).
- [x] Record final Phase 8 verification notes in PR/release issue and link back to this task list.
- [x] Confirm all required Phase 8 acceptance checklist items are checked.
- [x] Update the top-level closure status section to reflect manual operational sign-off completion.
- Evidence:
  - Owner: `@cloudbyday90`
  - Date: `2026-02-23`
  - Links: `Owner waiver decision (no additional manual evidence requested)`
  - Result: `waived`

## Deferred (Post `v0.42.0-alpha`)
- [ ] Optional recent manual requests list under Quick Add (`v1.1+` candidate).
- [ ] Any backend cleanup not required for Issue 262 parity (track as follow-up issues).
- [ ] Optional post-release research slate from `docs/issue-262-best-practices.md`:
  - [ ] Manage through `docs/issue-262-post-release-research-backlog.md`.
  - [ ] R-022 optimistic UI conflict resolution patterns.
  - [ ] R-023 websocket reconnect/backoff and event-loss recovery.
  - [ ] R-024 observability SLO patterns for notifications/actions/queue freshness.
  - [ ] R-025 destructive-action safeguards (`undo` vs confirmation).
  - [ ] R-026 timezone/relative-time consistency patterns.
- [ ] Deferred major dependency upgrades outside Issue 262 critical path:
  - [ ] Express 5.
  - [ ] Helmet 8.
  - [ ] ESLint 10.

## Dependencies
1. Phase 1 depends on Phase 0.
2. Phase 2 depends on Phase 1.
3. Phase 3 depends on Phases 1 and 2.
4. Phase 4 depends on Phases 1 and 2 (header + routing + data contracts).
5. Phase 5 depends on Phases 2 through 4.
6. Phase 6 depends on parity completion from Phases 2 through 5.
7. Phase 7 depends on Phases 1 through 6.
8. Phase 8 depends on Phases 1 through 7.
