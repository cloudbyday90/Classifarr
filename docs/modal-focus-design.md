# Modal focus: design

Date: 2026-10-03. Scope: the shared Vue Modal and its focus helper, not a
repository-wide dialog replacement or release.

## Findings and decision

The current candidate selector checks only the control's own attributes. Hidden
ancestors, inherited disabled fieldsets, inert sections and negative tabindex
values can therefore become trap boundaries. Focus return checks connectivity
alone; asynchronous open/close work has no invalidation or unmount cleanup.
Deleting a custom preset also removes the button that opened its confirmation.

Keep the current controlled model, Teleport, slots, animation and route-specific
`restoreFocus=false` contract. Extract DOM candidate checks into a small ESM
utility, keep lifecycle work instance-owned, and enroll Modal in strict Vue
component/event checking. Add a caller-provided fallback resolver for workflows
where the opener disappears; never guess a destination from arbitrary buttons.

## Behavior

- Exclude hidden/inert/aria-hidden subtrees, CSS-hidden content, disabled native
  controls (including fieldset inheritance), closed details content and negative
  tabindex values from sequential candidates. Respect positive tabindex order
  and the checked radio in a group. Recompute on each Tab, without polling.
- Keep initial heading focus for long structured content. Verify focus actually
  moved before accepting a target. Use the dialog as the last local fallback.
- Preserve native navigation between interior controls; intercept the boundaries
  and entry from the heading. Respect child-handled keys and composition.
- Invalidate pending focus work on state changes/unmount. Make leaving content
  inert immediately. Restore only when focus is still owned by the closing
  dialog or has fallen to the document body, not after a route or another dialog
  has already claimed it.
- Restore to a usable opener first, then the optional `fallbackFocusTarget`
  callback. A callback returns an element, not a selector or HTML. Preset deletion
  uses the existing search field as a stable continuation point.
- Preserve `restoreFocus=false` for caller-owned navigation. Respect reduced
  motion without changing ordinary timing. Emit only a boolean close request;
  the parent remains authoritative.

## Alternatives and tradeoffs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Keep attribute-only checks | Smallest patch | Leaves demonstrated focus failures; rejected |
| Scoped ESM focus/lifecycle repair | Preserves current callers and route handoffs; no dependency | Custom DOM focus rules need tests; selected for this round |
| Native `dialog.showModal()` | Browser-owned background inertness and modal stacking | Changes top-layer behavior, transitions and automatic return semantics; next architectural review |
| Add a general focus-trap dependency | Wider edge-case support | New dependency and lifecycle integration; unnecessary for the scoped repair |

This repair does not claim full modal isolation. The existing custom overlay
still lacks browser-owned background inertness. Native dialog evaluation must
cover teleported child overlays, sibling transitions, nested dialogs, return
opt-out and route navigation before switching all callers. Shadow-root and
cross-document focus traversal are outside this utility's contract.

## Official sources

URLs discovered with web search and opened during this review, rather than
constructed. Guidance reviewed as of October 2026:

- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):
  keyboard containment, an orienting initial target and a logical return target
  when the invoking control disappears.
- [W3C H102 native dialog technique](https://www.w3.org/WAI/WCAG22/Techniques/html/H102):
  browser-managed modal behavior is a strong future direction, not a claim that
  an ARIA role alone makes the background inert.
- [WHATWG interactive elements](https://html.spec.whatwg.org/multipage/interactive-elements.html):
  native dialog lifecycle and automatic focus return differ from the current
  component contract. Avoid mechanically swapping tags.
- [WHATWG focus model](https://html.spec.whatwg.org/multipage/interaction.html):
  distinguish programmatic focus from sequential keyboard focus.
- [Vue watchers](https://vuejs.org/guide/essentials/watchers): cancel stale work
  around asynchronous updates; a synchronous watcher is suitable for a boolean
  lifecycle signal, not large mutable data.

## Validation plan

Use unit tests for the candidate boundary, parent-controlled behavior, lifecycle
races and the real Presets Manager caller. Keep real compiler negatives for the
model and callback types. Use Chromium for actual CSS/native focus behavior,
Tab/Shift+Tab, transitions, route handoff, changing targets and mobile layout.
Run the full client suite, lint, typecheck, build and repository static/doc
checks. No backend, live preset mutation, dependency update or image change is
needed. Record measured results and remaining limits separately in the outcome.
