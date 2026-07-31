# Policy Compatibility Section Advisory Scope Audit

**Status:** Implemented  
**Phase:** 6R.5 Operator Workflow Rebuild  
**Research baseline:** June 2026 best practices, reviewed 2026-07-31

## Decision

Remove all client-derived advisory state from compatibility intent-section
cards. An unsaved compatibility draft is not authoritative evidence of
automation readiness, review behavior, confidence, routing, or enforcement.

The compatibility editor now retains only:

- section title and static descriptive help;
- direct action label and instruction beside the editable control;
- selected configured signals as labeled chips;
- duplicate-safe option state, disabled reasons, and typed draft commands.

Native policy workflow readiness remains the one server-owned projection. This
change adds no endpoint, browser write path, policy mutation behavior, or
runtime decision logic.

## Scope Classification

| Removed browser rule | Why it was out of scope |
| --- | --- |
| `missing_identity` | Predicts manual review and RAG-neighbor effects from an unsaved draft. |
| `compatibility_without_identity` | Interprets the relative authority of signals rather than describing a control. |
| `missing_hard_limit` | Predicts rating-boundary behavior and review. |
| `boosters_without_identity` | Interprets confidence behavior from cross-section draft state. |
| `missing_exclusions` | Predicts confidence and destination effects. |
| `missing_review_triggers` | Predicts when automation will ask. |
| Completion badges | Translate the same draft interpretation into `Configured`, `Needs identity`, `Advisory`, or `Optional` state. |
| Generated next actions | Duplicate the control's own action and can imply that the client knows the correct runtime correction. |

## Research And Recommendation

[OWASP's Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
requires server-side semantic validation because client JavaScript can be
bypassed. Classifarr therefore keeps policy authority and automation readiness
on the server rather than treating browser copy as a policy decision.

[W3C guidance on labeling controls](https://www.w3.org/WAI/tutorials/forms/labels/)
and [grouping related controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
support concise, descriptive labels and nearby instructions for each editable
group. The retained static section help and action help meet that need without
adding a second status system.

### Options

| Option | Pros | Cons |
| --- | --- | --- |
| Keep the section warnings, badges, and generated actions | Immediate visual prompts for every section | Misstates draft authority, duplicates controls, and becomes stale when engine semantics change. |
| Move the entire advisory model to a compatibility API | Could be authoritative for persisted state | Cannot truthfully evaluate unsaved edits; expands a maintenance-only surface and adds an unnecessary contract. |
| Remove dynamic advisory state and retain direct control guidance | Keeps the card concise, accessible, and honest; preserves native server readiness as the authority | Gives up redundant automated coaching in the legacy compatibility editor. |

## Final Recommendation Stack

1. Keep compatibility cards focused on direct typed maintenance edits.
2. Keep static labels and instructions associated with their controls.
3. Keep factual configured-signal display and duplicate prevention in the
   browser.
4. Keep semantic validation, authorization, readiness, and runtime behavior on
   the server.
5. Do not recreate a compatibility advisory API, aggregate readiness model, or
   dynamic section-status module.

## Implementation Outcome

- Deleted `client/src/utils/policyIntentSectionVisualState.js` and its focused
  test suite.
- Removed `warnings`, `completion`, and `nextAction` from the compatibility
  section projection and card rendering.
- Preserved section descriptions, labeled configured-signal chips, option
  diagnostics, disabled duplicate explanations, and typed draft commands.
- Updated policy authoring, engine-artifact, and client-engine boundary
  inventories to stop classifying deleted artifacts.

## Verification

- Focused client tests assert the card does not render browser-derived advisory
  state and section projections omit those fields.
- Server inventory tests ensure no deleted path remains in active inventory
  rules.
- Full client tests, build, static checks, coverage ratchet, and affected
  server checks remain release gates.

## Next Item

The group-instruction scope audit is implemented in [Policy Compatibility Group
Instruction Scope Audit](policy-compatibility-group-instruction-scope-audit.md).
The next task is a **compatibility editor framing-copy scope audit** for
`PolicyIntentEditor.vue`. It must retain direct editing context without adding
a compatibility API, browser-owned workflow interpretation, or broader writes.
