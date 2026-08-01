# Policy Authoring Readiness Action Surface Audit

Status: implemented as Phase 3R.6.2.

## Scope

Audit the normal policy-authoring readiness surface after the destination-first
workflow moved recovery actions into their owning question. The audit covers
only presentation ownership and action reachability. It does not change policy
intent, automation authority, profile regeneration, routing execution,
provider access, quota use, persistence, or the database schema.

## Findings

`ReadinessNextActionCard.vue` was an unreachable duplicate. The only caller,
`PolicyBuilderWorkflowShell.vue`, rendered it only when `selectionEnabled` was
false. Native policy creation is the sole caller of that shell and always sets
`selectionEnabled` to true.

The active normal path already uses `PolicyDestinationEmptyStateNotice.vue`:

- a profile-less or sparse library presents declared-intent guidance in the
  belongs-here question;
- an unmapped library presents the bounded `Open library mapping` action in the
  routing question; and
- automatic profile recovery remains a server lifecycle concern rather than a
  browser action.

A generic focus button was rejected. In a profile-less library, no
declared-intent picker is necessarily available, so a button would merely move
focus to its own advisory card and imply a resolver that does not exist.

## Official Guidance Reviewed

Official sources reviewed on 2026-07-31 against guidance current through June
2026:

- [Vue component props](https://vuejs.org/guide/components/props) requires
  one-way data flow; the presentation layer must not mutate the server-owned
  readiness result.
- [Vue component events](https://vuejs.org/guide/components/events) supports
  explicit child-to-parent events for bounded operator actions instead of
  hidden component side effects.
- [WAI-ARIA Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  requires a button to perform the action its accessible name promises.
- [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  requires status information to be programmatically determinable without
  forcing unnecessary focus changes.

## Options Considered

### Keep The Generic Readiness Card

Pros:

- No component deletion.

Cons:

- It is unreachable in the only production flow.
- It duplicates question-owned status and creates a misleading second
  readiness surface.

### Add A Generic Focus Action

Pros:

- Appears to connect guidance to a destination.

Cons:

- A profile-less destination can have no editable resolver to focus.
- The control would promise an action it cannot complete.

### Keep Bounded Actions In The Owning Question

Pros:

- One condition, one location, and at most one primary action.
- Mapping navigation remains explicit, accessible, and server-projected.
- Guidance remains honest when Classifarr must recover evidence automatically
  or no editable control is yet available.

Cons:

- The readiness summary is distributed by question instead of appearing in a
  separate global card.

## Final Recommendation Stack

1. Retire the unreachable generic readiness card and its test.
2. Treat `PolicyDestinationEmptyStateNotice.vue` as the normal
   readiness-action component.
3. Keep server-projected empty-state actions bounded to guidance or the
   existing library-mapping handoff.
4. Keep readiness issue records mapped to their resolving component; a ready
   save action has no false presentation-component target.
5. Do not add focus, browser refresh, provider, replay, quota, scoring, or
   routing authority to the client.

## Implemented Outcome

- Deleted `ReadinessNextActionCard.vue` and its focused test.
- Replaced its component-system, accessibility, inventory, workflow, and
  boundary records with `PolicyDestinationEmptyStateNotice`.
- Mapped the routing-unavailable readiness issue to the actual bounded action
  component.
- Removed the fabricated ready-state component target while retaining the
  explicit save-or-defer action.

## Follow-On Audit

Phase 3R.6.3 is complete. The live read now maps every engine readiness state
to an existing owner action or non-interactive automatic guidance. See [Policy
Operator Workflow Live Readiness Presentation Audit](policy-operator-workflow-live-readiness-presentation-audit.md).

The next Phase 3R task is 3R.7, Starter Template Role Reset.
