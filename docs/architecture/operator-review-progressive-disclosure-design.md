# Operator Review Progressive-Disclosure Design

**Status:** Revised 2026-09-02

**Scope:** Pending-classification review and AI Settings capability telemetry
**Authority:** Presentation only. This design has no AI, policy, RAG,
classification, retry, or routing authority.

## Problem

The pending-review screen previously exposed several independent technical
evidence cards at once. An operator could see a sentence such as “contextual
rather than semantic proof” without learning the practical meaning: items
already in a library make a destination plausible, but they cannot establish
that the specific item belongs there. The telemetry panel had a similar
problem: three separate diagnostic aggregates competed with the one
operational handoff, opening protected Error Logs.

The first progressive-disclosure pass grouped all of the technical material
under one disclosure. That preserved the data boundary but still produced an
overwhelming wall of evidence, a comparison table, score math, safeguards, and
AI state as soon as the operator asked the simple question “why?”.

Both arrangements were accurate but placed provenance terminology ahead of the
operator's decision. They made the page appear to ask for multiple actions
when only one action was available: confirm the destination or choose another
one.

## Goals

1. Show the decision and its short, plain-language reason before supporting
   evidence.
2. Preserve source-level, bounded evidence for an operator who wants to audit
   the suggestion.
3. Make details user-controlled, keyboard-operable, and quiet for assistive
   technology.
4. Preserve the existing fail-closed data boundaries and all routing
   safeguards.
5. Keep telemetry aggregates separate from protected Error Logs and avoid
   exposing provider, model, media, SQLSTATE, endpoint, raw diagnostic, or
   stack data.

## Research basis

- The W3C disclosure pattern defines a control that reveals or hides a
  content section and documents keyboard interaction with Enter and Space.
  Native `details`/`summary` supplies this simple interaction without a custom
  widget implementation. [W3C ARIA APG disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- WCAG 2.2 explains that disclosure state changes are already exposed through
  the control; it also cautions that excessive live regions can make an
  application too chatty. [W3C Understanding SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- OpenTelemetry describes pre-aggregated metric time series and supports
  temporal and spatial reaggregation, including reducing attributes. This
  supports fixed-window, low-cardinality telemetry context rather than raw-log
  display. [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
- OWASP advises separating logs collected for different purposes and choosing
  the amount of information from its purpose, rather than logging too much or
  too little. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Decision

Use three calm layers of native disclosures. The visible card answers the
decision. The first disclosure answers why. Distinct, optional controls hold
source-level and technical evidence.

### Pending review

`CandidateReviewEvidenceSummary.vue` is the operator-facing boundary for the
candidate-evidence card, exact current-inventory cross-check, and bounded AI
candidate comparison. `LibraryEvidenceProfile.vue` is the separate,
read-only comparison of the current policy-eligible libraries.

Default content is limited to:

1. **What the system found** — a fixed, plain-language state such as “This
   destination is plausible, but not proven.”
2. A short explanation of what that state means for the current choice.
3. The existing explicit confirmation or alternative-destination action.

The top-level **Why Classifarr recommends this** disclosure contains the
plain-language finding, then two collapsed, independent questions:

- **Review evidence details** contains source checks, the exact-item
  cross-library check, and advisory candidate comparison.
- **Compare N library choices** contains the read-only current-library table.

**Policy score and technical safeguards** is a third collapsed disclosure for
the deterministic explanation, score calculation, safety gates, and
candidate-bound verification. It is deliberately not the first thing shown
when someone asks why a library was recommended.

The source copy changes from the internal distinction “contextual rather than
semantic proof” to: “This library’s existing items make it a reasonable
option, but they cannot prove where this new item belongs.” This explains both
the useful signal and its limit without asking the operator to understand the
model of evidence provenance.

### Capability telemetry

`AiProviderCapabilityMetricsTelemetryDetails.vue` groups failure breakdown,
completed-window category coverage, and recency under `Review safe telemetry
warning details`. The health state, aggregate counts, and the protected Error
Logs handoff remain visible. The details are automatically refreshed with the
parent aggregate health view but remain collapsed until the operator opens
them.

The health component retains one screen-reader-only `role="status"` for a
meaningful health-state transition. The two new user-controlled disclosures do
not add live regions: their native expanded/collapsed state is sufficient.

## Security and data boundaries

- The candidate summary only consumes the existing normalized,
  allow-listed candidate-evidence, contrastive-evidence, and adjudication
  presentations. It never receives raw metadata, titles from retrieval,
  identifiers, policy terms, model reasoning, provider responses, or raw
  server prose.
- The compact summary maps fixed state IDs to local copy. The source details
  retain the existing local presentation strings rather than rendering
  arbitrary server text.
- Telemetry stays count-only and fixed-window. Raw Error Logs remain behind
  the existing authenticated, user-initiated handoff.
- No disclosure changes a policy score, calls AI, starts a retry, creates a
  learning record, or routes media.

## Alternatives considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep every evidence and telemetry card expanded | Immediate audit visibility | Repeats information, obscures the operator action, and increases screen-reader noise | Rejected |
| Hide all evidence | Minimal page | Removes the rationale needed to check a non-automatic suggestion | Rejected |
| One disclosure containing every technical section | Keeps one visible control | Expanding it creates another dense wall of content | Rejected |
| Layered native disclosures by question | Keeps the decision first; reveals plain-language evidence, current-library comparison, and technical mechanics only when needed | An audit requires more than one optional expand action | Selected |
| Use custom accordion buttons with live regions | Complete visual control | More state and announcement code for no user benefit | Rejected |

## Validation

Unit coverage verifies that:

- fixed evidence identifiers map to plain-language summary text;
- no untrusted metadata or model rationale can enter the presentation;
- the first review disclosure leads with a plain-language finding while source
  checks, library comparison, and technical mechanics remain independently
  collapsed;
- telemetry detail aggregates are grouped under one collapsed disclosure; and
- a meaningful automatic telemetry health change is announced without reading
  timestamp refresh noise.

## Follow-up

Use existing correction analytics and confirmed operator outcomes to identify
whether broad compatibility policies are repeatedly proposing specialized
libraries (for example, a generic movie being suggested for a comedy-focused
library). That is the next high-value work because it improves the underlying
candidate ranking rather than adding more UI explanation.
