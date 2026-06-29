# Policy Builder Phase 0R User Mental Model

Status: implemented as the second Phase 0R source-of-truth contract.

## Scope

Phase 0R.2 translates the authority vocabulary from Phase 0R.1 into the default
operator-facing setup model.

This slice does not change UI rendering, classification scoring, routing,
database schema, saved policy payloads, or runtime learning. It creates a
server-owned ESM contract for the setup questions, approved policy labels, and
helper-copy authority rules that later UI and engine phases should consume.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Policy controls need clear labels and instructions before users are asked to
    make decisions.
- W3C WCAG 2.2, Error Identification:
  <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
  - Readiness and disabled states should explain what is wrong and what the
    operator can do next.
- GOV.UK Design System, Content Design:
  <https://design-system.service.gov.uk/styles/content/>
  - Product language should be plain, direct, and task oriented.
- GOV.UK Design System, Checkboxes:
  <https://design-system.service.gov.uk/components/checkboxes/>
  - Multi-select controls should make it clear when operators can select more
    than one value.
- U.S. Web Design System, Form Controls:
  <https://designsystem.digital.gov/components/form-controls/>
  - Form controls should provide accessible labels, helper text, validation
    state, and predictable interaction patterns.
- NIST AI Risk Management Framework:
  <https://www.nist.gov/itl/ai-risk-management-framework>
  - User-facing AI-assisted workflows should make system behavior understandable
    and should not hide authority or validation boundaries.

## Recommendations

1. Center the setup flow on four questions:
   - What already belongs here?
   - What should always or never belong here?
   - When should Classifarr ask?
   - Can this destination route?
2. Keep the approved policy labels short:
   - `Belongs Here`
   - `Helpful Matches`
   - `Hard Limits`
   - `Avoid`
   - `Ask When Unsure`
   - `Routing Target`
   - `Readiness`
3. Make helper text carry the authority nuance:
   - observed library contents can suggest,
   - operator-declared intent can define,
   - hard limits require explicit intent,
   - readiness explains the next action.
4. Keep broad genres out of authority language:
   - broad genres can be evidence,
   - broad genres do not define specialized destinations by default,
   - questions should ask about destination fit rather than genre priority.
5. Reject product copy that asks operators to reason about scoring weights,
   provider gates, replay parity, TMDB coverage, raw presets, or `customSignals`
   during normal setup.

## Pros And Cons

### Pros

- Gives future UI work a stable product language before components are rebuilt.
- Keeps the setup model simple enough for normal operators.
- Connects every label back to Phase 0R.1 authority boundaries.
- Prevents broad genre evidence from being presented as destination identity.
- Gives tests a direct way to detect internal diagnostic language in normal
  setup copy.

### Cons

- The server contract is not wired into existing Vue components yet.
- Some existing UI labels still come from older client-side utilities until
  Phase 3R rebuilds the component system.
- The contract does not define final runtime question schemas; Phase 0R.4 and
  Phase 5R own that work.
- The model intentionally keeps helper text conservative until Phase 6R defines
  evidence/readiness semantics.

## Final Stack

- Authority vocabulary dependency:
  `server/src/services/policyAuthorityVocabulary.mjs`
- User mental model contract:
  `server/src/services/policyUserMentalModel.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyUserMentalModel.test.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-0r-user-mental-model.md`

## Implemented Outcome

Phase 0R.2 now defines the normal setup model:

| Question | Purpose |
| --- | --- |
| What already belongs here? | Show observed application as suggestions. |
| What should always or never belong here? | Capture declared destination intent and constraints. |
| When should Classifarr ask? | Define review behavior without automatic learning. |
| Can this destination route? | Separate routing readiness from classification confidence. |

It also defines approved policy UX terms and how each maps to authority sources:

| Term | Authority Shape |
| --- | --- |
| Belongs Here | Observed evidence plus accepted declared intent |
| Helpful Matches | Supportive evidence that should not decide alone |
| Hard Limits | Declared intent only |
| Avoid | Declared warning/negative evidence |
| Ask When Unsure | Declared review behavior |
| Routing Target | Declared routing readiness |
| Readiness | Combined next-action state from evidence, intent, provider freshness, and routing |

## Follow-Up

The next Phase 0R task is **0R.3 Legacy Compatibility Vocabulary**. That task
should define how legacy presets, starter templates, bridge payloads, and
rollback snapshots are described without making the old model permanent.
