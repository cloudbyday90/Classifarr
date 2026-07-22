# Policy Authoring Destination Question Flow

Status: implemented for the native new-policy authoring path.

## Scope

This record defines how the native new-policy screen presents the server-owned
destination workflow. It turns the five destination questions into one ordered
operator flow while keeping observed library values as suggestions until an
operator explicitly accepts them.

This slice is intentionally not a five-form editor. The current native
creation boundary can establish declared purpose values from accepted observed
evidence. Later component work may add a control only when it has a bounded
server contract and an explicit operator decision.

## Official Guidance Reviewed

- [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
  recommends WCAG 2.2 for current accessibility work and includes requirements
  for meaningful sequence, labels, status messages, and focus appearance.
- [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  explains that sequential focus should preserve the meaning and operation
  conveyed by the interface and should reinforce the visual reading order.
- [WAI-ARIA Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  requires dialog keyboard interaction to remain inside the modal and advises
  a logical initial focus strategy for structured dialog content.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  supports deriving testable verification requirements from the security design.

## Recommendations

1. Render all five server-projected destination questions for native creation
   in one ordered, single-column list.
2. Place observed-value acceptance and profile recovery exclusively in
   `What belongs here?`, which is the only native-create interaction currently
   backed by a typed draft command and server acceptance contract.
3. Keep hard-limit, helpful-signal, review, and routing questions visible even
   when their controls are not yet part of the native-create boundary. Show
   their server-owned next action or bounded explanatory copy instead of a
   non-functional button.
4. Keep the existing observed-profile summary above the questions as context,
   not as an alternate edit surface.
5. Preserve a read-only client boundary: the workflow projection cannot
   authorize policy persistence, automation, learning, provider use, or media
   routing. The only draft mutation remains the existing explicit acceptance
   command.

## Options Considered

### Keep the abbreviated native workflow

Pros:

- Smallest code change.
- Keeps native creation visually short.

Cons:

- Hides four server-owned destination questions.
- Separates evidence selection from the destination question it answers.
- Makes the native and existing-policy paths communicate different policy
  mental models.

### Add all five editing controls immediately

Pros:

- Could eventually make each question actionable in one screen.

Cons:

- Would expose controls before their native commands, validation, and save
  contracts are implemented.
- Risks reintroducing the overloaded legacy builder under new labels.
- Encourages non-functional or misleading actions.

### Ordered questions with one bounded evidence interaction

Pros:

- Shows the complete destination model now.
- Keeps selection, visual order, and keyboard order aligned in the modal.
- Makes explicit acceptance the only native draft mutation.
- Leaves later controls to their dedicated component and server-contract work.

Cons:

- Some questions are informative until their bounded controls are introduced.
- Requires follow-up work to map every empty and routing state to a resolving
  product surface.

## Final Recommendation Stack

- `server/src/services/policyOperatorWorkflow.mjs`
  - owns the ordered question projection, section status, and server-owned
    readiness next actions.
- `client/src/components/policies/PolicyBuilderWorkflowShell.vue`
  - owns the workflow header and observed-profile context, then delegates the
    question sequence to a focused child component.
- `client/src/components/policies/PolicyBuilderDestinationQuestions.vue`
  - renders the ordered question list, scoped evidence recovery, explicit
    observed-value acceptance, and bounded guidance for non-interactive
    questions.
- `client/src/components/policies/PolicyObservedSuggestionSelector.vue`
  - continues to emit only typed add/remove command plans; it has no direct
    persistence or routing capability.
- `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`
  - verifies native creation renders every question, scopes acceptance to
    destination identity, and keeps routing as a next action instead of a
    direct operation.

## Outcome

Native policy creation now uses the same five destination questions as the
server projection. Observed library values and evidence recovery appear only
inside `What belongs here?`, and routing readiness appears within `Can this
route?`. The old native-only routing message is removed, so the modal no longer
shows an abbreviated workflow that hides the rest of the policy model.

## Follow-up

The destination-flow empty states are now implemented in
[Policy Authoring Empty-State Mapping](policy-authoring-empty-state-mapping.md).
The next task is Phase 3R.3 component replacement: extract the workflow
shell's generic library context, observed-profile display, and readiness notice
into the documented product-vocabulary components.
