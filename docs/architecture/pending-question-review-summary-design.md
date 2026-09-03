# Pending Question Review Summary Design

## Problem

The pending-review card exposed the recommendation, routing safeguard, score
calculation, evidence sources, inventory comparison, and AI verification at
the same visual level. Operators could see correct information without being
able to quickly answer the decision they were being asked to make.

The resulting cognitive load was especially risky for policy reviews: a
contextual existing-library signal could look like semantic proof, even though
it is deliberately not authoritative.

## Design

The card now has three progressive layers.

1. A visible decision summary uses a semantic definition list with three
   descriptive fields:
   - Recommended destination
   - Why this needs your review
   - What to do
2. One closed, user-controlled **Why Classifarr recommends this** disclosure
   contains a compact plain-language finding.
3. Inside that review layer, independent closed disclosures answer distinct
   follow-up questions: source checks and advisory AI comparison, a
   current-library comparison, and the policy score plus technical safeguards.

The confirm action remains visible after the summary. Alternative-destination
selection remains a separate, explicit control because it is an action, not
supporting evidence.

`PendingQuestionReviewSummary.vue` is a small display component. Its input is
created by the pure ESM
`pendingQuestionReviewSummaryPresentation.js` utility, which accepts only a
normalized destination name and action availability. It cannot interpret
server prose, policy terms, retrieval text, provider output, or model output.

The pre-existing evidence modules use their native disclosure mode in the
pending review. This preserves a compact first layer rather than turning a
single expand action into a dense technical panel.

## Accessibility and interaction research

The design follows W3C guidance current through August 2026:

- [WCAG 2.2: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
  supports short, descriptive headings that make each section’s purpose clear.
- [WAI-ARIA Authoring Practices: Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  defines an operable show/hide control with an exposed expanded state. Native
  `details`/`summary` provides the browser’s keyboard-operable disclosure
  behaviour without custom ARIA state management.
- [WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  cautions that live-region use can make an application too chatty. Static,
  already-rendered verification text is therefore ordinary labelled content,
  not a `role="status"` announcement.

## Security and authority boundaries

- This is presentation-only. It does not change candidate ranking, policy
  thresholds, RAG retrieval, AI admission, persistence, learning, or routing.
- The new summary revalidates and bounds the destination name before display.
- Existing allow-listed evidence presentation remains the only path for
  evidence details. Raw titles, provider diagnostics, policy payloads, and
  model reasoning remain excluded.
- The user must still invoke an existing, contract-validated confirmation or
  destination-selection action. There is no automatic route or newly added
  endpoint.

## Alternatives considered

| Option | Advantages | Costs |
| --- | --- | --- |
| Keep every section expanded | Maximum immediate detail | Repetitive, difficult to scan, and makes safeguards look like multiple independent decisions. |
| Hide all evidence | Fastest operator view | Removes the review trail needed for accountable confirmation. |
| One disclosure containing all technical detail | Keeps a small control count | Expanding the panel recreates the busy layout. |
| Decision summary plus question-based disclosures | Clear action path; evidence depth is chosen by the operator | Detailed review can require more than one intentional expand action. |

## Recommendation stack

Use the decision-summary and question-based disclosure design. Retain
deterministic evidence as the route authority, preserve AI as advisory evidence
only, and keep the confirmation action explicit. Evaluate comprehension with
representative ambiguous media examples before changing policy thresholds or
routing behaviour.
