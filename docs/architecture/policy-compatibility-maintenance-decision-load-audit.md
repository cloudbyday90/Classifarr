# Policy Compatibility Maintenance Decision-Load Audit

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.8.5

**Decision date:** 2026-08-01

## Decision

Existing-policy maintenance remains a compatibility-only path. It does not
re-enter the native destination-first workflow, establish new policy authority,
or expose raw preset attachments. Its only job is to let an operator apply
existing typed draft commands to one selected attached policy.

The surface now follows this order:

```text
maintenance purpose
  -> non-blocking migration outcome, when present
  -> choose attached policy context
  -> review behavior
  -> destination identity, rules, and optional confidence support
```

The parent maintenance surface owns the sole purpose heading and instruction.
The nested editor no longer repeats a competing "Edit destination intent"
heading or panel. The context selector appears before every editable section,
with visible helper text explaining the scope of the pending changes. Migration
feedback is a polite status result, not a warning-like competing setup action.

## Research

Research was reviewed on 2026-08-01 against the requested current-through-June
2026 guidance.

- W3C's cognitive accessibility guidance recommends concise, clear,
  step-by-step instructions located before or next to the activity they govern.
  It supports choosing the attached policy before exposing editable controls.
  [Use Clear Step-by-step Instructions](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/)
- W3C recommends a clear page hierarchy and warns that visual clutter increases
  cognitive load. One parent heading and logical regions reduce repeated setup
  framing without hiding the existing controls. [Use a Clear and Understandable
  Page Structure](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o2p03-page-structure/)
- W3C's ARIA Authoring Practices requires clear accessible names for interactive
  elements and prefers visible labels over fallback naming. The retained native
  label and helper text provide the selector's name and description. [Providing
  Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)

## Audit Findings

| Finding | Risk | Resolution |
| --- | --- | --- |
| Review controls appeared before policy context. | An operator could act before understanding which attachment receives the change. | Move the visible policy-context selector before all editable groups. |
| Parent and child both described the same maintenance activity. | Repeated headings and nested panels add scanning work without adding a decision. | Keep one heading and instruction in the parent; make the child a structural editor region. |
| Migration result used warning styling and a dismissal action. | A completed result competed with the operator's actual maintenance work. | Present it as a polite status with an optional secondary hide action. |
| Existing commands use a typed draft boundary. | A simplification could accidentally introduce raw attachment mutation. | Preserve all draft event names and payloads; do not add attachment operations. |

## Options Considered

### Delete the compatibility surface now

**Pros:** Removes legacy UI immediately.

**Cons:** Breaks maintenance of unconverted policies before the seven
native-storage deletion gates pass. Reject.

### Hide the editor behind a new custom disclosure workflow

**Pros:** Initially shows fewer controls.

**Cons:** Adds a new interaction model, focus behavior, and another state to
test. It can also hide the current editing scope. Reject for this task.

### Context-first hierarchy with one purpose statement

**Pros:** Keeps the current typed controls and keyboard behavior, makes scope
clear before action, removes duplicate framing, and keeps migration feedback
secondary.

**Cons:** Compatibility maintenance still exposes more detail than native
authoring until native storage completes. Adopt.

## Final Recommendation Stack

1. Keep compatibility maintenance outside normal authoring.
2. Put selected-policy context before all editable controls.
3. Give the parent one visible purpose heading and concise instruction.
4. Treat completed migration outcomes as non-blocking status feedback.
5. Preserve the typed draft-command boundary and prohibit raw attachment edits.
6. Remove the entire surface only through the Phase 8R native-storage deletion
   gate, not through incremental UI shortcuts.

## Verification

Regression coverage verifies the visible context-first order, unique purpose
heading, selector name and description, non-blocking migration status, absence
of native-workflow claims, and unchanged typed draft command forwarding.
