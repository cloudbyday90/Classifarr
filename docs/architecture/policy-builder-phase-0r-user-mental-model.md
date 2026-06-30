# Policy Builder Phase 0R User Mental Model

Status: implemented as the second Phase 0R source-of-truth contract and
hardened as an auditable setup-copy contract.

## Scope

Phase 0R.2 translates the authority vocabulary from Phase 0R.1 into the default
operator-facing setup model.

This slice does not change UI rendering, classification scoring, routing,
database schema, saved policy payloads, or runtime learning. It creates a
server-owned ESM contract for the setup questions, approved policy labels,
helper-copy authority rules, and validation helpers that later UI and engine
phases should consume.

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
6. Treat setup copy as testable product behavior:
   - labels must match the approved Phase 0R term,
   - helper text must explain the operator decision,
   - observed-evidence terms must say when library contents are suggestions,
   - declared-intent terms must say when operator intent is required,
   - broad genres must not be presented as the authority that decides a
     destination.
7. Treat interaction shape as part of the mental model:
   - evidence and constraint controls may be multi-select when the label says
     what is being selected,
   - readiness and routing controls remain status or next-action surfaces
     instead of disguised policy editors,
   - every default setup copy block should be auditable before UI work consumes
     it.
8. Treat the setup sequence as a product contract:
   - start from observed application,
   - capture declared destination rules,
   - define review behavior,
   - confirm routing and readiness.

## Pros And Cons

### Pros

- Gives future UI work a stable product language before components are rebuilt.
- Keeps the setup model simple enough for normal operators.
- Connects every label back to Phase 0R.1 authority boundaries.
- Prevents broad genre evidence from being presented as destination identity.
- Gives tests a direct way to detect internal diagnostic language in normal
  setup copy.
- Lets later UI phases audit product copy before adding or changing controls.
- Captures the intended interaction pattern before Phase 3R turns labels into
  concrete controls.

### Cons

- The server contract is not wired into existing Vue components yet.
- Some existing UI labels still come from older client-side utilities until
  Phase 3R rebuilds the component system.
- The contract does not define final runtime question schemas; Phase 0R.4 and
  Phase 5R own that work.
- The model intentionally keeps helper text conservative until Phase 6R defines
  evidence/readiness semantics.
- The copy audit is phrase-based, so it is intentionally conservative and should
  be treated as a guardrail rather than a natural-language classifier.
- Interaction patterns are product contracts, not final component
  implementations; Phase 3R still owns the concrete UI components.
- Setup steps are product-order contracts, not navigation requirements; Phase 3R
  can render them as a wizard, cards, or progressive sections as long as the
  mental model and authority order are preserved.

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

## Hardening Outcome

Phase 0R.2 now includes an executable setup-copy audit. The contract validates:

| Check | Purpose |
| --- | --- |
| Known UX term | Blocks copy from introducing old preset-first or diagnostic-first terms. |
| Visible label | Keeps UI labels aligned to the approved Phase 0R vocabulary. |
| Helper text | Requires a plain explanation before the operator has to decide. |
| Observed evidence context | Makes media-server contents read as suggestions, not hidden rules. |
| Declared intent context | Makes durable operator authority explicit. |
| No internal language | Keeps scoring, provider, parity, raw preset, and diagnostic terms out of normal setup. |
| No broad-genre authority | Prevents "genre priority" wording from replacing destination-fit questions. |
| Known interaction pattern | Ensures every approved term maps to a bounded control shape before UI work starts. |

The validation helpers are intentionally small and deterministic:

- `listDefaultPolicySetupCopy()`
- `validatePolicySetupCopy(candidate)`
- `buildPolicySetupCopyAudit(candidates)`
- `listPolicySetupSteps()`
- `getPolicySetupStep(id)`
- `validatePolicySetupStepContract(step)`
- `buildPolicySetupStepAudit(steps)`
- `validatePolicyUxTermContract(term)`
- `buildPolicyUserMentalModelAudit()`
- `includesInternalPolicyLanguage(text)`
- `listInternalPolicyLanguageFlags()`

The approved interaction patterns are:

| Pattern | Used For | Product Meaning |
| --- | --- | --- |
| Observed suggestion multi-select | Belongs Here | The operator can accept more than one observed suggestion as declared destination meaning. |
| Declared signal multi-select | Helpful Matches | Multiple soft evidence values can support a match without deciding alone. |
| Declared constraint multi-select | Hard Limits, Avoid | Multiple explicit operator-declared constraints or negative hints can apply. |
| Review trigger checklist | Ask When Unsure | Multiple conditions can make Classifarr ask instead of automate. |
| Routing readiness summary | Routing Target | Routing is a readiness state, not a confidence score. |
| Next-action status | Readiness | The surface should tell the operator the next action, not expose diagnostics. |

The approved setup-step sequence is:

| Step | Setup Question | Allowed Terms | Operator Action |
| --- | --- | --- | --- |
| Start with what exists | What already belongs here? | Belongs Here | Review observed examples and accept only the values that should define this destination. |
| State what should happen | What should always or never belong here? | Helpful Matches, Hard Limits, Avoid | Add explicit operator intent for soft matches, blocking rules, and poor-fit warnings. |
| Choose when Classifarr should ask | When should Classifarr ask? | Ask When Unsure, Readiness | Set review triggers and show the next action when evidence, intent, or freshness is not safe enough to automate. |
| Confirm routing readiness | Can this destination route? | Routing Target, Readiness | Confirm where approved matches can be sent and explain any remaining setup action. |

The setup-step audit fails when a step references unknown terms, unsupported
interaction patterns, missing observed/declarative authority sources, broad
genre authority wording, or internal diagnostic language. This keeps Phase 3R
focused on a simple setup path instead of exposing all transitional diagnostics
as product controls.

Future UI work should use this contract before introducing or changing setup
copy. Future server work should keep runtime question schemas separate; Phase
0R.2 owns the normal setup language, not final learning authority.

## Follow-Up

The next Phase 0R task is **0R.3 Legacy Compatibility Vocabulary**. That task
should define how legacy presets, starter templates, bridge payloads, and
rollback snapshots are described without making the old model permanent.
