# Issue 262 Post-Release Research Backlog

Parent issue: `#262`  
Release context: `v0.42.0-alpha`  
Status: Planned (post-release, non-blocking)
Related:
- `docs/issue-262-best-practices.md`
- `docs/issue-262-implementation-plan.md`
- `docs/issue-262-task-list.md`
- `docs/issue-262-release-runbook.md`

## Purpose
Track the next research wave after Issue 262 implementation so future UX and reliability improvements are evidence-backed before coding.

This backlog is explicitly non-blocking for `v0.42.0-alpha`.

## Scope
Research-only deliverables for:
- R-022 optimistic UI conflict resolution
- R-023 websocket reconnect/backoff and event-loss recovery
- R-024 observability/SLO patterns for notifications/actions/queue freshness
- R-025 destructive-action safeguards (`undo` vs confirm)
- R-026 timezone and relative-time consistency

Out of scope:
- implementation code changes
- schema or API migrations
- release gating for `v0.42.0-alpha`

## Deliverable Format (Required Per Research Item)
For each `R-0xx`, capture:
1. at least two current sources (prefer official docs/specs)
2. key takeaway(s)
3. decision options (`recommended`, `acceptable alternative`, `reject`)
4. exact mapping to affected Classifarr surfaces/endpoints
5. proposed acceptance criteria for the later implementation issue

All findings are added to `docs/issue-262-best-practices.md` with new `BP-*` entries.

## Research Items

### R-022: Optimistic UI Conflict Resolution
Goal:
- Define safe optimistic update patterns for concurrent user actions and live background refresh.

Target questions:
- Which actions are safe for optimistic updates vs confirmation-only?
- How should rollback/reconciliation behave when server state differs?
- What is the user-visible conflict contract (message, retry, preserve user intent)?

Primary impact:
- Command Center actions: Confirm, Change, Retry, Dismiss, Quick Add, Mark Read.

### R-023: Reconnect/Backoff and Event-Loss Recovery
Goal:
- Define resilient realtime behavior for socket disconnects and missed events.

Target questions:
- What reconnect/backoff strategy should be used?
- How should missed-event replay or snapshot re-sync work?
- When should UI shift from realtime mode to periodic fallback refresh?

Primary impact:
- Processing phase updates, notifications badge/panel freshness, queue summary correctness.

### R-024: Observability/SLO Patterns
Goal:
- Define operational SLOs and alert thresholds for Command Center health.

Target questions:
- What SLI/SLOs should be tracked (notification latency, action success/failure, freshness lag)?
- What thresholds trigger operator alerts vs informational notifications?
- What minimum telemetry fields are required for incident triage?

Primary impact:
- Runbook stabilization gates, `Today` health signals, error/notification diagnostics.

### R-025: Destructive Action Safeguards
Goal:
- Define when `undo` is preferable to modal confirmation and where hard-confirm remains required.

Target questions:
- Which actions should be undoable vs irreversible?
- What undo window and UX pattern is best for operational flows?
- How should bulk-action partial failure be represented with undo semantics?

Primary impact:
- Errors and Needs Attention bulk actions, notification dismiss/clear actions.

### R-026: Timezone and Relative-Time Consistency
Goal:
- Standardize time rendering and timezone handling across all operational views.

Target questions:
- Which canonical timezone/storage/display rules should apply?
- How should relative and absolute timestamps be paired in UI?
- What formatting/localization defaults are required for consistency?

Primary impact:
- Notifications panel, Recently Completed, History, Today, logs-linked drilldowns.

## Recommended Follow-Up Issue Split
1. One umbrella issue: `Issue 262 Post-Release Research Completion (R-022..R-026)`.
2. Optional child issues per item (`R-022` through `R-026`) if parallel ownership is preferred.

Suggested labels:
- `research`
- `ux`
- `reliability`
- `post-v0.42.0-alpha`

## Completion Checklist
- [ ] Open umbrella follow-up issue and link this doc.
- [ ] Assign owner(s) and target milestone (`v0.42.x` or `v0.43.0`).
- [ ] Complete research for R-022.
- [ ] Complete research for R-023.
- [ ] Complete research for R-024.
- [ ] Complete research for R-025.
- [ ] Complete research for R-026.
- [ ] Add new `BP-*` entries and decision mappings in `docs/issue-262-best-practices.md`.
- [ ] Update `docs/issue-262-task-list.md` deferred section status.
- [ ] If implementation is approved, create implementation issue(s) with acceptance criteria copied from research outputs.

## Definition of Done
This backlog is complete when all five research items have documented recommendations, each recommendation is mapped to Classifarr surfaces, and a clear implementation-ready acceptance checklist exists for each item.
