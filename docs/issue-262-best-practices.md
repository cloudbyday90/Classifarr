# Issue 262 Best-Practices Research Log

Status: Complete for current Issue 262 scope (citations BP-001 through BP-021 mapped on 2026-02-12)  
Related:
- `docs/issue-262-implementation-plan.md`
- `docs/issue-262-interface-design.md`
- `docs/issue-262-task-list.md`

## Purpose
Capture online best-practice references that directly inform Issue 262 implementation decisions.

Use this document to:
- record citations,
- map research to concrete design/plan requirements,
- justify defaults and deviations.

## Citation Requirements (Locked)
Each citation entry must include:
- source URL
- source type (official docs, vendor guidance, design guideline, engineering article)
- published/updated date (if available)
- short takeaway (1-2 lines)
- decision mapping (what changed in plan/design because of it)

## Research Categories
1. Operational dashboard IA (action-first hierarchy, scannability, empty states)
2. Notification center UX (unread/read behavior, bulk actions, open-target routing)
3. Realtime SWR patterns (refresh cadence, mutate-on-action, visibility-aware revalidation)
4. Mobile operational UX (bottom sheets, touch targets, dense-action ergonomics)
5. Deprecation and migration UX (legacy route sunset patterns and compatibility windows)
6. Feature-flag and staged rollout patterns for UI migrations
7. Notification fatigue controls (dedupe, throttle, collapse, severity)
8. Idempotent API/action patterns for bulk operations and partial failures
9. Queue backpressure and worker-concurrency visibility patterns
10. Live-update accessibility (`aria-live` semantics and announcement throttling)
11. Long-running action UX (optimistic vs confirmed updates, retry/cancel)

## Citations Table

| ID | Category | Source | Date | Key takeaway | Decision mapping |
|---|---|---|---|---|---|
| BP-001 | Operational dashboard IA | Grafana docs: Dashboard best practices: https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/ | Accessed 2026-02-12 | Dashboards should tell a story and reduce cognitive load; use logical progression and focused content. | Keep action-first module order and concise module payloads; avoid duplicated/noisy summaries. Applies to design `Command Center Layout` and plan `Phase 2/3`. |
| BP-002 | Operational dashboard IA/performance | Google Cloud Monitoring: Dashboards overview: https://docs.cloud.google.com/monitoring/dashboards | Last updated 2026-02-12 UTC | Avoid performance-heavy dashboards by filtering, grouping, and limiting unnecessary series/widgets. | Keep compact card content, conditional Enrichment visibility, and controlled refresh cadence. Applies to design `Live Data Behavior` and plan `Phase 6`. |
| BP-003 | SWR/revalidation contract | SWR API docs: https://swr.vercel.app/docs/api | Accessed 2026-02-12 | `revalidateOnFocus`, `revalidateOnReconnect`, `refreshInterval`, `refreshWhenHidden`, and `dedupingInterval` are core controls for stale-while-revalidate behavior. | Use visibility-aware cadence and dedupe rather than ad-hoc polling loops. Applies to plan `SWR Refresh Strategy (Locked)` and task `Phase 5`. |
| BP-004 | SWR automatic refresh behavior | SWR Automatic Revalidation: https://swr.vercel.app/docs/revalidation | Accessed 2026-02-12 | SWR refreshes on focus/reconnect and interval polling only when on screen (with refresh hidden/offline controls). | Lock refresh behavior for active modules, avoid hidden-tab churn, and keep stale data visible during revalidate. Applies to design `Live Data Behavior` and plan `Phase 6`. |
| BP-005 | SWR mutate-on-action | SWR Mutation & Revalidation: https://swr.vercel.app/docs/mutation | Accessed 2026-02-12 | `mutate` is the recommended mechanism for cache updates and manual revalidation after user actions. | Trigger post-action mutate for Confirm/Retry/Dismiss/Add/Mark Read flows. Applies to plan `SWR Refresh Strategy (Locked)` and task `Phase 4/5`. |
| BP-006 | Visibility-aware refresh | MDN Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API | Last modified 2025-12-30 | `visibilitychange` + `document.hidden` enable reducing background work when page is not visible. | Tie SWR cadence to visibility and expose freshness signal instead of blind polling. Applies to design `Live Data Behavior` and plan `Phase 6`. |
| BP-007 | Notification-center triage UX | GitHub Docs (manage inbox): https://docs.github.com/en/enterprise-server%403.15/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox | Accessed 2026-02-12 | Unread/read filtering and bulk triage (including mark read/unread) improve inbox throughput. | Keep unread-first grouping, row triage actions, and bulk actions in bell panel/full notifications view. Applies to design `Notifications Panel` and plan `Phase 4`. |
| BP-008 | Notification grouping/filtering UX | GitHub Docs (configuring notifications): https://docs.github.com/en/enterprise-server%403.14/subscriptions-and-notifications/get-started/configuring-notifications | Accessed 2026-02-12 (Enterprise Server 3.14 docs) | Inbox workflows benefit from custom filters and grouping (for example by repository/date) to reduce context switching. | Keep `/notifications` full view with filters/grouping/pagination and actionable rows. Applies to design `Notifications View (All Notifications)` and plan `Phase 4`. |
| BP-009 | Mobile detail surface pattern | Material Design bottom sheets: https://m1.material.io/components/bottom-sheets.html | Accessed 2026-02-12 | Modal bottom sheets are primarily mobile and support focused action/detail without leaving context. | Preserve Processing detail as bottom sheet on mobile instead of route switch. Applies to design `Mobile View Spec` and plan `Phase 6`. |
| BP-010 | Dialog accessibility/focus management | WAI-ARIA APG Dialog (Modal) Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Accessed 2026-02-12 | Modal interactions require focus trapping and predictable keyboard handling (`Tab`, `Shift+Tab`, `Escape`). | Keep focus management rules for modal/panel interactions (notifications/detail/confirm patterns). Applies to design `Accessibility and Interaction Baseline` and plan `Phase 6`. |
| BP-011 | Touch target accessibility | W3C WAI WCAG 2.2 update notes: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ | WCAG 2.2 published 2023-10-05 | SC 2.5.8 requires minimum target size or spacing for pointer targets. | Preserve minimum touch-target requirement for mobile action rows and critical controls. Applies to design `Accessibility and Interaction Baseline` and task `Phase 5`. |
| BP-012 | Deprecation signaling semantics | RFC 9745 (Deprecation header): https://www.rfc-editor.org/rfc/rfc9745.html | Published 2025-03 | Deprecation signals lifecycle risk without changing resource behavior immediately. | Support compatibility window for legacy routes while warning/migrating users; avoid abrupt route removal. Applies to plan `Phase 5` and runbook `Sidebar and Deprecation Gate`. |
| BP-013 | Sunset/removal signaling semantics | RFC 8594 (Sunset header): https://www.rfc-editor.org/rfc/rfc8594 | Published 2019-05 | Sunset communicates expected future unavailability at a specific time and should be treated as hint for migration planning. | Use staged deprecation messaging and explicit cutoff timing for legacy surfaces. Applies to plan `Phase 5` and runbook cutover semantics. |
| BP-014 | Feature-flag rollout patterns | GitLab admin feature flags docs: https://docs.gitlab.com/administration/feature_flags/ | Accessed 2026-02-12 | Gradual rollout lifecycle is explicit: disabled by default -> enabled by default -> remove flag. | Keep staged Command Center cutover with legacy-compatible window and explicit removal gates. Applies to plan `Phase 5`, runbook `Cutover Semantics`. |
| BP-015 | Notification fatigue controls | PagerDuty noise reduction docs: https://support.pagerduty.com/main/docs/noise-reduction and reduce-noise guide: https://www.pagerduty.com/ops-guides/ops-practices/reduce-noise/ | Accessed 2026-02-12 | Deduplication, grouping, and auto-pause reduce alert fatigue and improve responder throughput. | Keep notification dedupe/grouping semantics and avoid noisy repeated alerts in bell/alerts flow. Applies to plan `Phase 4`, design `Notifications Panel`. |
| BP-016 | Idempotent bulk action APIs | AWS Builders Library (idempotent APIs): https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ and HTTP semantics RFC 9110 idempotency: https://datatracker.ietf.org/doc/rfc9110/ | Accessed 2026-02-12 | Safe retries require idempotent contracts and clear request identity to avoid duplicate side effects. | Define idempotent contracts for `Confirm All`, `Retry All`, `Dismiss All`; enforce repeat-safe behavior. Applies to plan `API and Data Contract Worklist`, task `Phase 4`. |
| BP-017 | Partial-failure UX for bulk actions | Microsoft Graph JSON batching docs: https://learn.microsoft.com/en-us/graph/json-batching | Accessed 2026-02-12 | Top-level batch success does not imply per-item success; each sub-response status must be surfaced. | Bulk actions must return and display per-item success/failure details (no single success toast masking partial failures). Applies to plan `Phase 2/4` action contracts and runbook API gate. |
| BP-018 | Queue backpressure/concurrency UX | AWS SQS metrics docs: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-available-cloudwatch-metrics.html and monitoring guidance: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/monitoring-using-cloudwatch.html | Accessed 2026-02-12 | Backlog and age metrics are primary signals for queue health; metric freshness/lag behavior must be understood. | Emphasize pending count + oldest-work age style indicators and clear freshness signaling in queue-derived cards. Applies to design `Processing/Today`, plan `Phase 2/3/6`. |
| BP-019 | Live-update accessibility (`aria-live`) | MDN `aria-live`: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live and WAI APG alert pattern: https://www.w3.org/WAI/ARIA/apg/patterns/alert/ | Accessed 2026-02-12 | Use polite vs assertive announcement levels intentionally; alerts should not steal keyboard focus; excessive interruption harms usability. | Keep focus-stable live updates and controlled announcement semantics for notifications/errors/status updates. Applies to design `Accessibility and Interaction Baseline`, plan `Phase 6`. |
| BP-020 | Long-running action UX | Google Drive LRO guidance: https://developers.google.com/workspace/drive/api/guides/long-running-operations and Material progress/activity: https://m1.material.io/components/progress-activity.html | Accessed 2026-02-12 | Long operations should be asynchronous with status polling; UI should distinguish determinate vs indeterminate progress and phase transitions. | Keep asynchronous action status handling, progress-phase detail, and explicit running/completed/error states. Applies to design `Processing`, plan `Phase 2/6`. |
| BP-021 | Mobile action density/thumb-reach ergonomics | Material accessibility touch targets: https://m1.material.io/usability/accessibility.html and WCAG 2.2 target size understanding: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum | Accessed 2026-02-12 | Mobile controls need sufficient target size/spacing for reliable touch activation. | Preserve locked mobile touch-target constraints and avoid over-dense action rows. Applies to design `Mobile View Spec`, plan `Phase 6`. |

## Decision Register

| Decision ID | Decision | Research IDs | Applied in plan/design sections |
|---|---|---|---|
| D-IA-001 | Command Center keeps action-first vertical hierarchy (`Alerts -> Processing -> Needs Attention -> Errors`) before informational blocks. | BP-001, BP-002 | Plan: `Phase 2/3`; Design: `Command Center Layout`, `Priority Design Block` |
| D-NOTIF-001 | Notifications use unread-first triage, row actions, and bulk read workflows. | BP-007, BP-008 | Plan: `Phase 4`; Design: `Notifications Panel`, `Notifications View (All Notifications)` |
| D-SWR-001 | Refresh behavior is SWR-first, visibility-aware, and cadence-controlled (no blind fixed polling loops). | BP-003, BP-004, BP-006 | Plan: `SWR Refresh Strategy (Locked)`, `Phase 6`; Design: `Live Data Behavior` |
| D-SWR-002 | Post-action refresh uses `mutate` semantics for deterministic UI updates. | BP-005 | Plan: `SWR Refresh Strategy (Locked)`; Task list: `Phase 4/5` |
| D-MOBILE-001 | Processing detail uses mobile bottom sheet, not route change. | BP-009 | Plan: `Phase 6`; Design: `Mobile View Spec (Locked)`, `Processing details (mobile bottom sheet)` |
| D-A11Y-001 | Modal/panel interactions must preserve focus trap and keyboard escape patterns. | BP-010 | Plan: `Phase 6`; Design: `Accessibility and Interaction Baseline` |
| D-A11Y-002 | Touch targets maintain WCAG 2.2 minimum-size/spacing intent for mobile actions. | BP-011 | Plan: `Phase 6`; Design: `Accessibility and Interaction Baseline`, mobile acceptance requirements |
| D-DEPREC-001 | Legacy route removal follows staged compatibility and explicit migration messaging (no hard instant removal). | BP-012, BP-013 | Plan: `Phase 5`, `Legacy Rules and Migration Deprecation (Locked)`; Runbook: `Cutover Semantics`, `Sidebar and Deprecation Gate` |
| D-ROLL-001 | Command Center cutover uses staged feature-flag/compatibility rollout and explicit sunset sequencing. | BP-014 | Plan: `Phase 5`; Runbook: `Cutover Semantics`, `Rollback Drill` |
| D-NOTIF-002 | Notification pipeline includes anti-fatigue controls (dedupe/grouping/suppression semantics). | BP-015 | Plan: `Phase 4`; Design: `Notifications Panel`, `Notification vs Alert Boundary` |
| D-ACTION-001 | Bulk actions are retry-safe and idempotent by contract. | BP-016 | Plan: `API and Data Contract Worklist`, `Phase 2/4`; Task list: `Phase 4` |
| D-ACTION-002 | Bulk-action responses surface per-item results to avoid hidden partial failures. | BP-017 | Plan: `Phase 2/4` action contract notes; Runbook: `API/Contract Gate` |
| D-QUEUE-001 | Queue health surfaces include workload-pressure context and freshness signaling, not count-only snapshots. | BP-018 | Plan: `Phase 2/3/6`; Design: `Processing`, `Today`, `Live Data Behavior` |
| D-A11Y-003 | Live updates use controlled announcement priority and avoid focus disruption. | BP-019 | Plan: `Phase 6`; Design: `Accessibility and Interaction Baseline`, `Live Data Behavior` |
| D-PROGRESS-001 | Long-running actions expose async status and determinate/indeterminate progress transitions. | BP-020 | Plan: `Phase 2/6`; Design: `Processing`, classifying phased detail behaviors |
| D-MOBILE-002 | Mobile action rows preserve touch accuracy via size/spacing constraints even in dense operational views. | BP-021 | Plan: `Phase 6`; Design: `Mobile View Spec (Locked)` |

## Defaults and Rejected Alternatives

### Selected Defaults
- Keep Command Center as default surface with strict action-first ordering.
- Keep notifications unread-first with read/unread/bulk triage and full-view filters.
- Keep SWR as canonical data model with visibility-aware refresh and mutate-on-action.
- Keep Processing mobile detail in bottom sheet.
- Keep a staged deprecation window for legacy routes and legacy workflow surfaces.
- Keep bulk actions idempotent with per-item outcome visibility.
- Keep notification anti-fatigue semantics (dedupe/grouping/suppression) in core contract.
- Keep async long-running actions explicit with phase/progress visibility.
- Keep mobile action-density constrained by touch target and spacing requirements.

### Rejected Alternatives
- Reject always-on fixed high-frequency polling regardless of tab visibility.
- Reject forcing a route change for Processing detail on mobile.
- Reject removing legacy routes immediately without a compatibility/deprecation window.
- Reject hidden-only decision actions that require context-switching to complete common triage tasks.
- Reject bulk-action APIs that return only aggregate success without per-item outcome detail.
- Reject UI patterns that interrupt keyboard focus for non-blocking live status updates.
- Reject dense mobile action layouts that violate minimum touch target/spacing requirements.

## Completion Checklist
- [x] At least one citation captured for each research category
- [x] Each citation mapped to at least one concrete requirement in plan/design docs
- [x] Defaults and rejected alternatives documented
- [x] Any unresolved research conflicts called out before implementation

## Research Conflicts / Open Notes
- No blocking research conflicts identified for current locked Issue 262 scope.
- Optional follow-up: replace BP-009 with a current Material 3 equivalent source if the project wants only latest-generation Material references.
- Optional follow-up: add one additional vendor-neutral source for notification fatigue controls beyond PagerDuty-specific guidance.

## Secondary Research Backlog (Completed)
The following items were approved for secondary research and are now covered by BP-014 through BP-021:
- feature-flag rollout patterns for UI migration and rapid rollback
- notification fatigue controls and alert-noise governance
- idempotent single/bulk action API contracts with partial-failure semantics
- queue backpressure and worker-concurrency visibility patterns
- live-update accessibility semantics (`aria-live`, announcement throttling)
- long-running action UX (optimistic vs confirmed state and retry/cancel behavior)
- mobile action-density and thumb-reach ergonomics for operations consoles

Backlog status:
- Completed citation pass for BP-014 through BP-021 on 2026-02-12.

## Additional Research Candidates (Optional, Post `v0.42.0-alpha`)
These are not blockers for Issue 262 implementation, but are good follow-up research candidates:
- R-022: optimistic UI conflict resolution patterns for concurrent user actions and live updates.
- R-023: websocket reconnect/backoff and event-loss recovery patterns for real-time dashboards.
- R-024: observability SLO patterns for notification latency, action success rate, and queue freshness.
- R-025: destructive-action safeguards (`undo` vs confirmation dialogs) for bulk operations.
- R-026: relative-time and timezone consistency patterns across notifications/history/today summaries.

Tracking artifact:
- `docs/issue-262-post-release-research-backlog.md`
