# Policy Builder Phase 3R UI Component System And Interaction Reset

Status: implemented as the third Phase 3R operator-workflow contract.

## Scope

Phase 3R.3 defines the target policy-builder component vocabulary before the
Vue screens are rebuilt. This prevents more one-off cards, dropdowns, warnings,
preview boxes, and action buttons from accumulating around the old modal shape.

This checkpoint does not replace the current Vue files yet. It defines the
component system, source semantics, interaction rules, and accessibility
requirements that later UI work must implement.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- Vue Test Utils Guide: https://test-utils.vuejs.org/
- Vitest Guide: https://vitest.dev/guide/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

The applied guidance:

- Custom controls must be keyboard operable, labeled, stateful, and testable.
- Multi-select controls need explicit selected/disabled state and clear
  grouping.
- Component tests should verify emitted behavior and accessibility-relevant
  state rather than transitional layout.
- UI components should emit typed commands and never mutate raw bridge payloads
  or infer durable policy authority from observed evidence.

## Recommendation Stack

1. Standardize on ten target components:
   - `DestinationContextCard`,
   - `ObservedProfileSummary`,
   - `IntentSignalPicker`,
   - `IntentSignalChipList`,
   - `HardLimitControl`,
   - `AvoidControl`,
   - `ReviewTriggerControl`,
   - `ReadinessNextActionCard`,
   - `StarterTemplateSuggestion`,
   - `MigrationVerifierPanel`.
2. Use multi-select and chip-based editing by default for simple belongs-here,
   helpful-match, avoid, and review-trigger values.
3. Split option sources into explicit visible groups:
   - observed in library,
   - suggested from observed profile,
   - suggested from starter template,
   - common static option,
   - operator-added custom value,
   - already declared,
   - unavailable because of conflicting intent.
4. Observed library values can prefill suggestions, but they never become
   declared intent without explicit acceptance.
5. Components that add or remove values must emit typed draft commands.
6. Disabled choices must explain why they are unavailable.
7. Readiness cards must link to the exact component that resolves the issue.

## Pros And Cons

### Small Target Component Vocabulary

Pros:

- Reduces the number of concepts operators need to understand.
- Gives future Vue work a concrete target instead of extending the old modal.
- Separates normal authoring from starter-template and migration verifier flows.

Cons:

- Existing components need later rewrite work to match the target names and
  roles.

### Multi-Select And Chip-Based Editing

Pros:

- Matches the common operator task: adding several simple signals at once.
- Makes declared values visible and removable.
- Supports clear grouping by evidence/source.

Cons:

- Requires careful keyboard and screen-reader behavior.
- Requires explicit disabled-state reasons to avoid confusing unavailable
  choices with missing data.

### Observed Evidence As Suggestions

Pros:

- Uses the media-server library as source-of-truth context without silently
  creating rules.
- Keeps operator-declared intent distinct from observed application.

Cons:

- Requires UI copy to clearly separate "already in the library" from "declared
  policy intent".

## Final Recommendation

Build the Phase 3R UI around this normal component set:

```text
DestinationContextCard
  -> ObservedProfileSummary
  -> IntentSignalPicker + IntentSignalChipList
  -> HardLimitControl / AvoidControl / ReviewTriggerControl
  -> ReadinessNextActionCard
```

Keep `StarterTemplateSuggestion` behind destination context and keep
`MigrationVerifierPanel` outside the normal policy-authoring path.

## Implementation

The Phase 3R.3 implementation now provides:

- `server/src/services/policyBuilderPhase3ComponentSystem.mjs`
  - defines the target component vocabulary,
  - maps current primitive categories to keep/rewrite/replace/delete decisions,
  - defines option source semantics,
  - defines typed-command and explicit-acceptance interaction rules,
  - defines component-level accessibility requirements,
  - validates component IDs, option sources, interaction coverage, and
    accessibility coverage.
- `server/src/__tests__/services/policyBuilderPhase3ComponentSystem.test.mjs`
  - pins target component names and roles,
  - verifies primitive decisions,
  - proves observed evidence cannot auto-declare intent,
  - checks typed-command and disabled-state interaction rules,
  - checks keyboard, label, focus, target-size, and programmatic reason
    accessibility rules.

## Phase 3R.3 Checklist Result

| Check | Result |
| --- | --- |
| Small component vocabulary defined | Yes; ten target components are pinned. |
| Multi-select default for grouped signals | Yes; signal picker, chip list, avoid, and review trigger components default to multi-select behavior. |
| Option sources separated | Yes; seven source groups are defined and cannot auto-declare intent. |
| Observed evidence requires acceptance | Yes; observed values remain suggestions until accepted through typed commands. |
| Interaction rules defined | Yes; add/remove, disabled reason, destructive confirmation, readiness linking, and explicit acceptance are pinned. |
| Accessibility specified at component level | Yes; keyboard, labels, state announcement, focus, target size, and programmatic reason rules are pinned. |

## Next Step

Continue with **Phase 3R.4 Evidence-Backed Option Selection**. That task should
turn the option-source model into the specific behavior contract for observed
library evidence, static options, starter-template suggestions, custom values,
already-declared values, and conflicting choices.
