# Policy Authoring User Mental Model

Status: implemented policy-authoring source-of-truth contract with an auditable
setup-copy boundary.

## Scope

The policy authoring user mental model translates the policy authority
vocabulary into the default operator-facing setup model.

This slice does not change UI rendering, classification scoring, routing,
database schema, saved policy payloads, or runtime learning. It creates a
server-owned ESM contract for the setup questions, approved policy labels,
helper-copy authority rules, and validation helpers that later UI and
policy-engine work should consume.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Policy controls need clear labels and instructions before users are asked to
    make decisions.
- W3C WCAG 2.2, Headings and Labels:
  <https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html>
  - Setup sections need descriptive headings so operators understand the
    relationship between each question and action.
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
- U.S. Web Design System, Validation:
  <https://designsystem.digital.gov/components/validation/>
  - Setup readiness should explain what is complete and what remains rather than
    expose raw diagnostic state.
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
   - labels must match the approved policy authoring term,
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
9. Treat each setup section as a small card contract:
   - one plain question,
   - one primary action,
   - one empty-state explanation,
   - one completion signal,
   - no provider, replay, scoring, or broad-genre-authority language.
10. Treat each setup section as an allowed surface role:
    - observed suggestion review,
    - declared intent edit,
    - review behavior edit,
    - readiness status.
    A setup surface may guide or edit draft intent where explicitly allowed,
    but it must not persist policy intent directly or execute routing.
11. Treat the first-run setup journey as a separate contract from the final
    component layout:
    - every stage has one operator goal,
    - every stage has one primary action,
    - every stage defines what complete means,
    - every stage states the system boundary and the failure mode it prevents.
    This keeps later UI work from reintroducing dense expert panels while still
    leaving room for the UI to render cards, sections, or a wizard.
12. Treat setup field groups as the bridge between the mental model and future
    controls:
    - `Belongs Here` can accept one or more observed suggestions, but only as
      explicit operator-declared intent,
    - `Helpful Matches`, `Hard Limits`, `Avoid`, and `Ask When Unsure` are
      editable declared-intent controls,
    - `Routing Target` and `Readiness` are status or next-action controls, not
      hidden policy editors,
    - no setup field group may persist policy intent directly.
13. Treat setup answer shapes as the guardrail between UI questions and runtime
    side effects:
    - observed suggestions can become draft intent only through explicit
      operator acceptance,
    - declared rules and review triggers can shape draft intent but cannot save
      policy by themselves,
    - readiness answers are status review only,
    - no setup answer may create learning or execute routing directly.

## Pros And Cons

### Pros

- Gives future UI work a stable product language before components are rebuilt.
- Keeps the setup model simple enough for normal operators.
- Connects every label back to policy authority vocabulary boundaries.
- Prevents broad genre evidence from being presented as destination identity.
- Gives tests a direct way to detect internal diagnostic language in normal
  setup copy.
- Lets later UI work audit product copy before adding or changing controls.
- Captures the intended interaction pattern before later UI work turns labels into
  concrete controls.

### Cons

- The server contract is not wired into existing Vue components yet.
- Some existing UI labels still come from older client-side utilities until
  later UI work rebuilds the component system.
- The contract does not define final runtime question schemas; runtime
  clarification and decision work own that work.
- The model intentionally keeps helper text conservative until policy engine defines
  evidence/readiness semantics.
- The copy audit is phrase-based, so it is intentionally conservative and should
  be treated as a guardrail rather than a natural-language classifier.
- Interaction patterns are product contracts, not final component
  implementations; later UI work still owns the concrete UI components.
- Setup steps are product-order contracts, not navigation requirements; later UI work
  can render them as a wizard, cards, or progressive sections as long as the
  mental model and authority order are preserved.
- Setup cards intentionally duplicate a little visible copy from the step model
  so later UI work can consume a simple display contract without exposing the full
  authority or validation internals.
- Setup surfaces add another small contract layer, but they keep later UI work from
  turning status summaries, suggestions, and edits into one ambiguous control.
- Setup journey stages add one more product contract, but they prevent later UI
  work from combining all decisions into one modal section or letting helper
  panels persist policy directly.
- Setup field groups add one more small contract, but they make the intended
  control behavior explicit before later UI work builds or removes UI controls.
- Setup answer shapes add one more contract, but they stop future question UI
  from treating an answer as persistence, learning, or routing execution.

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
  `docs/architecture/policy-authoring-user-mental-model.md`

## Implemented Outcome

The policy authoring user mental model defines the normal setup model:

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

The policy authoring user mental model includes an executable setup-copy audit.
The contract validates:

| Check | Purpose |
| --- | --- |
| Known UX term | Blocks copy from introducing old preset-first or diagnostic-first terms. |
| Visible label | Keeps UI labels aligned to the approved policy authoring vocabulary. |
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
- `listDefaultPolicySetupCards()`
- `getPolicySetupCard(stepId)`
- `validatePolicySetupCardContract(card)`
- `buildPolicySetupCardAudit(cards)`
- `listPolicySetupSurfaceContracts()`
- `getPolicySetupSurfaceContract(stepId)`
- `validatePolicySetupSurfaceContract(surface)`
- `buildPolicySetupSurfaceAudit(surfaces)`
- `listDefaultPolicySetupJourneyStages()`
- `getPolicySetupJourneyStage(stepId)`
- `validatePolicySetupJourneyStageContract(stage)`
- `buildPolicySetupJourneyAudit(stages)`
- `listDefaultPolicySetupFieldGroups()`
- `getPolicySetupFieldGroup(groupId)`
- `validatePolicySetupFieldGroupContract(group)`
- `buildPolicySetupFieldGroupAudit(groups)`
- `listDefaultPolicySetupAnswerShapes()`
- `getPolicySetupAnswerShape(stepId)`
- `validatePolicySetupAnswerShapeContract(shape)`
- `buildPolicySetupAnswerShapeAudit(shapes)`
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
genre authority wording, or internal diagnostic language. This keeps later UI work
focused on a simple setup path instead of exposing all transitional diagnostics
as product controls.

## Setup Card Contract

The policy authoring user mental model exposes a default setup-card contract
for later UI work. The card contract is intentionally smaller than the full
authority model:

| Card Question | Primary Action | Empty-State Meaning |
| --- | --- | --- |
| What already belongs here? | Review suggestions | Observed examples are unavailable or insufficient; the operator can still declare intent. |
| What should always or never belong here? | Set destination rules | No explicit rules exist yet; observed evidence can help, but clear rules improve automation. |
| When should Classifarr ask? | Set review triggers | No review triggers are configured; readiness can still force review when unsafe. |
| Can this destination route? | Check routing readiness | No routing target is ready; classification can still review matches before routing is enabled. |

Each card must include:

- a plain heading that matches the setup question,
- helper text that explains the operator decision,
- one primary action label,
- one empty-state message,
- one completion signal,
- approved policy authoring terms only.

The card audit rejects:

- unknown setup steps,
- unknown terms,
- missing labels or action copy,
- internal diagnostic language,
- broad genre authority language.

This gives later UI work a simple component target: render setup cards from the
contract, then add controls behind each card without making replay, provider, or
scoring diagnostics part of the normal setup experience.

## Setup Surface Contract

The policy authoring user mental model also exposes a setup-surface contract.
The surface contract answers a narrower question than the setup-card contract:

```text
What is this section allowed to do?
```

| Step | Surface Role | Action Kind | May Edit Draft Intent | May Persist Policy |
| --- | --- | --- | --- | --- |
| What already belongs here? | Observed suggestion review | Review suggestions | Yes, by explicit acceptance | No |
| What should always or never belong here? | Declared intent edit | Edit destination rules | Yes | No |
| When should Classifarr ask? | Review behavior edit | Configure review triggers | Yes | No |
| Can this destination route? | Readiness status | Check routing readiness | No | No |

The distinction matters because later UI work must not make every setup card an
editor. Observed evidence can be accepted into declared intent, but it is not a
rule by itself. Readiness can explain the next action, but it must not silently
change policy intent or execute Arr writes. Persistence remains a separate save
path after validation.

The setup-surface audit rejects:

- unknown setup steps,
- unknown surface roles,
- unknown action kinds,
- missing operator decision or system responsibility text,
- direct policy persistence,
- observed suggestion surfaces without media-server evidence and
  operator-declared intent sources,
- declared-intent surfaces that cannot edit or lack operator authority,
- readiness surfaces that edit declared intent,
- internal diagnostic language,
- broad genre authority language.

Future UI work should use this contract before introducing or changing setup
copy. Future server work should keep runtime question schemas separate; this
contract owns the normal setup language, not final learning authority.

## Setup Journey Contract

The policy authoring user mental model exposes a first-run setup journey
contract. This is deliberately not a UI implementation. It is the product path
later components must preserve.

| Stage | Operator Goal | Primary Action | Completion Signal |
| --- | --- | --- | --- |
| What already belongs here? | Understand what the current library already appears to contain. | Review suggestions | The operator accepted, edited, or skipped observed suggestions without treating them as hidden rules. |
| What should always or never belong here? | State the destination rules that should guide future decisions. | Set destination rules | Declared belongs-here, helpful, hard-limit, or avoid choices are ready for explicit save. |
| When should Classifarr ask? | Choose when automation should stop and ask. | Set review triggers | Review triggers are configured or the default readiness guard remains responsible for unsafe cases. |
| Can this destination route? | Confirm whether accepted matches can be routed safely. | Check routing readiness | Routing is ready, or the next setup action is visible without blocking declared intent review. |

Each journey stage includes a system boundary:

- observed suggestions are evidence only until accepted,
- destination rules are draft intent until the operator saves,
- review behavior is separate from final outcomes and durable learning,
- routing readiness reports state without executing Arr writes.

The journey audit rejects:

- unknown setup steps,
- order drift from the approved policy authoring sequence,
- missing operator goals, primary actions, completion signals, system
  boundaries, or failure modes,
- more than one primary action in a stage,
- direct policy persistence,
- internal diagnostic language,
- broad genre authority language.

This contract is the policy authoring user mental model guardrail for the next UI work: simplify the
journey before adding controls.

## Setup Field Group Contract

The policy authoring user mental model exposes setup field groups for future UI
controls. This contract answers a smaller question than the card and journey
contracts:

```text
What kind of control is this allowed to be?
```

| Field Group | Control Kind | May Accept Observed Suggestions | May Edit Draft Intent | May Persist Policy |
| --- | --- | --- | --- | --- |
| Belongs Here | Observed multi-select | Yes, by explicit acceptance | Yes | No |
| Helpful Matches | Declared multi-select | No | Yes | No |
| Hard Limits | Declared multi-select | No | Yes | No |
| Avoid | Declared multi-select | No | Yes | No |
| Ask When Unsure | Declared checklist | No | Yes | No |
| Routing Target | Status summary | No | No | No |
| Readiness | Next-action status | No | No | No |

This matters for the re-imagined policy builder because the future UI should be
simple without becoming ambiguous. Multi-select boxes are appropriate when the
operator is choosing multiple values. Status boxes are appropriate when
Classifarr is explaining route readiness or the next action. Neither kind of
box is allowed to save policy intent directly; persistence remains the explicit
validated save path.

The setup-field-group audit rejects:

- unknown field groups,
- unknown setup steps or UX terms,
- labels that drift from approved policy authoring terms,
- missing instructions,
- unsupported control kinds,
- direct policy persistence,
- observed suggestion controls without media-server evidence and
  operator-declared intent sources,
- observed suggestion controls that cannot explicitly accept suggestions,
- declared controls that cannot edit or lack operator authority,
- status controls that edit declared intent,
- internal diagnostic language,
- broad genre authority language.

## Setup Answer Shape Contract

The policy authoring user mental model exposes setup answer shapes for the four
default setup questions. This contract answers the question:

```text
What is the operator answer allowed to mean?
```

| Setup Question | Answer Kind | May Shape Draft Intent | May Persist Policy | May Create Learning | May Execute Routing |
| --- | --- | --- | --- | --- | --- |
| What already belongs here? | Accept observed suggestions | Yes, only by explicit acceptance | No | No | No |
| What should always or never belong here? | Declare destination rules | Yes | No | No | No |
| When should Classifarr ask? | Configure review triggers | Yes | No | No | No |
| Can this destination route? | Review readiness status | No | No | No | No |

This matters because a simple setup question should not hide a side effect.
Accepting observed suggestions may create draft intent, but only because the
operator explicitly accepts them. Declaring rules and review triggers may shape
the draft, but persistence still belongs to the explicit save path. Readiness
answers are status review only.

The setup-answer-shape audit rejects:

- unknown setup steps,
- unknown answer kinds,
- missing operator-response meaning,
- missing authority sources,
- direct policy persistence,
- direct learning,
- direct routing execution,
- observed-suggestion answers that lack media-server evidence, operator intent,
  or explicit acceptance,
- readiness answers that edit draft intent,
- internal diagnostic language,
- broad genre authority language.

## Next Component

Cut over the phase-coded policy setup checklist service. It now points at this
durable design record but still names its runtime inventory after the historical
setup phase.
