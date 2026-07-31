# Policy Builder Keyboard Recovery Flow

Status: implemented as Phase 3R.8.4 keyboard recovery-flow behavior.

## Scope

Policy authoring has one bounded navigation action for opening the library
mapping destination. Missing or stale observed evidence is read-only guidance
and server-owned lifecycle state, not a browser recovery action. Navigation
can replace the initiating control, so a keyboard user must never lose their
place in the application.

This design covers modal semantics, keyboard containment, recovery-action
completion, and the successful mapping-route handoff. It does not change
policy intent, policy persistence, routing execution, media-server writes,
provider activity, quota use, database schema, or runtime learning.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WAI-ARIA Authoring Practices Guide, [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  - A modal dialog contains its tab sequence, moves focus inside when opened,
    supports Escape, and normally returns focus to its invoker on close. A
    subsequent workflow step may instead receive focus when that is more
    logical.
- W3C WCAG 2.2, [Understanding Focus Order (2.4.3)](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  - Sequential focus order must preserve meaning and operation, and dynamic
    updates must not create an illogical or unpredictable focus jump.
- W3C WAI-ARIA Authoring Practices Guide, [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
  - The active element must remain visible and logical after an event removes
    it. Native disabled controls can leave the tab sequence when nearby context
    makes their state clear.
- Vue Router, [Waiting for the Result of a Navigation](https://router.vuejs.org/guide/advanced/navigation-failures.html)
  - A prevented navigation resolves to a navigation-failure result rather than
    necessarily throwing, so dependent UI state must change only after a
    confirmed route transition.

## Recommendations

1. Use the shared modal as a true modal dialog:
   - `role="dialog"` and `aria-modal="true"`,
   - visible-title association,
   - a programmatically focusable title for large, structured content,
   - contained Tab and Shift+Tab navigation, and
   - Escape plus a visible close button.
2. Capture the invoking element only when a modal opens and restore it on an
   ordinary close. Support an explicit no-return path for a completed action
   that has moved the operator to a new workflow.
3. Preserve mapping-navigation focus without creating focus churn:
   - if the initiating action still exists and is enabled after completion,
     return focus to it;
   - if it was removed by the rerender, focus the current workflow result;
   - if the operator moved focus while work was in flight, do nothing.
4. Treat the mapping page as the logical next step after a successful mapping
   action. Hand focus to its mapping section, with the library title as a
   fallback, and never serialize that short-lived handoff into a URL or stored
   configuration. Keep the modal open and clear the handoff when navigation is
   cancelled or blocked.
5. Keep ordinary status changes as live announcements only. Do not focus every
   warning or successful result.

## Pros And Cons

### Pros

- Gives keyboard and assistive-technology users an operable, contained modal
  with a predictable close path.
- Prevents focus from falling to the document body when recovery replaces the
  action that triggered it.
- Sends a completed mapping workflow to the relevant destination instead of
  returning focus to a stale action on the previous page.
- Uses native buttons and a bounded in-memory route handoff, so it adds no
  persistence, external call, policy authority, or sensitive data exposure.

### Cons

- The shared modal change applies to all current modal users, so its regression
  tests cover generic dialog behavior in addition to policy authoring.
- A recovery result is focused only after focus has genuinely been lost; this
  is intentionally less chatty than focusing every state change.
- The mapping handoff exists only in the current browser runtime. Direct loads
  of a library page retain normal browser focus behavior.

## Final Recommendation Stack

- Generic modal focus management:
  `client/src/composables/useModalFocusManagement.js`
  and `client/src/components/common/Modal.vue`
- Recovery completion focus guard:
  `client/src/composables/usePolicyRecoveryFocus.js`
- Workflow-status fallback target:
  `client/src/components/policies/PolicyBuilderWorkflowStatusNotice.vue`
  and `client/src/components/policies/PolicyBuilderWorkflowShell.vue`
- Policy-builder recovery and mapping orchestration:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Transient route handoff and library mapping focus target:
  `client/src/utils/routeFocusHandoff.js`
  and `client/src/views/LibraryDetail.vue`
- Regression coverage:
  `client/src/__tests__/components/common/Modal.test.js`,
  `client/src/__tests__/composables/usePolicyRecoveryFocus.test.js`, and
  `client/src/__tests__/utils/routeFocusHandoff.test.js`

## Implemented Outcome

The policy builder now opens in a labelled modal dialog with focus on its
orienting title, keeps keyboard navigation inside the dialog, closes with
Escape, and restores focus to the opener for normal close paths. Declared-
intent guidance does not start browser work or move focus; mapping navigation
preserves focus when possible and moves it to the current workflow result only
when its initiating control disappears.

When an empty-state mapping action succeeds, the modal suppresses its normal
focus restoration and sends focus to the library mapping section. The handoff
is one in-memory record consumed by the destination route; it is not stored,
included in a query string, or available to runtime policy logic.
