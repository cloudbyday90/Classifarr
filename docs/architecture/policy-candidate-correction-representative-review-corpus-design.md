# Policy Candidate Correction Historical Review-Corpus Preflight Design

## Status

Implemented on the unreleased branch as a read-only preflight. It deliberately
does **not** select, persist, export, or return historical records.

## Problem

A sustained 28-day correction signal can justify a human review, but current
Needs Attention records are not automatically a representative sample of the
historical decisions that formed the aggregate. Returning historical titles,
IDs, destinations, or metadata from the aggregate Statistics endpoint would
also bypass the analytics feature's established privacy boundary.

The first safe component must therefore make the missing requirements visible
and machine-checkable before a future record-level corpus exists.

## Selected Design

```text
two comparable 28-day aggregate periods
  -> sustained_review_signal
  -> server-derived corpus-preflight contract
       { no historical-record access,
         fixed prospective frame,
         four required safeguards }
  -> strict browser revalidation
  -> concise Statistics disclosure card
```

`policyCandidateCorrectionRepresentativeReviewCorpusReadiness.mjs` is a pure
ES module composed into the existing long-horizon report. It has two states:

| State | Meaning | Result |
| --- | --- | --- |
| `review_not_indicated` | The aggregate guard is not sustained and comparable. | No historical-review UI. |
| `historical_corpus_design_required` | A sustained aggregate signal exists. | Explain that historical records remain unavailable and enumerate required safeguards. |

The latter state is intentionally not a `ready` state. It returns only a
fixed prospective review frame—two completed 28-day periods, stratified by
score-margin band and operator-selection outcome—and the explicit safeguards:
authorization, redaction, retention, and operator audit. `historicalRecordAccess`
is always `false`.

The client independently rejects a mismatched version, trend relation,
status, frame, safeguard list, or record-access value. It retains only the two
status fields and owns all explanatory text. Unknown server fields, including
any future accidental history field, cannot render.

The UI is shown only for the sustained signal. It communicates the boundary in
one short card and puts the four detailed safeguards in a native HTML
`details` disclosure, keeping routine monitoring uncluttered.

## Security and Privacy Boundary

- No historical query, route, migration, cache, export, selection, or audit
  record is created in this component.
- The existing aggregate-only route still receives no title, media ID,
  library, policy, candidate, destination, actor, provider, model, prompt,
  response, RAG text, or configuration field.
- The contract is server-derived from the existing allow-listed trend status;
  the browser may not select a date, stratum, record, or safeguard.
- The UI does not include a button, form, deep link, background request, AI
  call, RAG call, retry, policy change, learning action, or routing action.
- A later record-level implementation must be administrator-authorized at the
  record boundary, return a dedicated allow-listed review projection, enforce
  redaction and retention server-side, and write an operator-owned audit event.

## Accessibility

- The status is explicit text; color is not its only representation.
- The explanatory state joins the existing polite `role="status"` region and
  does not move focus.
- Native `details` and `summary` provide a compact, keyboard-operable
  disclosure for safeguards rather than a custom show/hide control.
- The safeguard information is a definition list, not a visually implied grid.

## Options Considered

### Preflight contract and disclosure — selected

Pros:

- Makes the limitation and future conditions clear at the moment a sustained
  signal appears.
- Makes a future record-level implementation prove its safeguards explicitly.
- Preserves the existing aggregate-only API and authority boundary.
- Adds no storage, identity exposure, or operational side effect.

Cons:

- Does not yet accelerate historical case review.
- Requires a subsequent, separately authorized implementation to create a
  redacted, audited review corpus.

### Return historical records from correction analytics

Pros:

- Fastest apparent drill-down from the aggregate signal.

Cons:

- Would expose a new record-level API surface without record authorization,
  redaction, retention, or audit guarantees. Rejected.

### Client-only explanatory text

Pros:

- Smallest UI change.

Cons:

- Does not bind the notice to the server's strict aggregate status or create a
  reusable, testable contract for a future implementation. Rejected.

## Research Basis

- NIST AI RMF Measure calls for documented test sets, metrics, and evaluation
  methods; it also requires representative human-subject evaluation where
  relevant. This preflight records the proposed frame and explicitly records
  what is not measured or enabled:
  [NIST AI RMF Core — Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/).
- NIST Privacy Framework guidance calls for defined privacy requirements,
  lifecycle reassessment, and verification that required capabilities are in
  place before deployment:
  [Using Privacy Framework 1.1](https://www.nist.gov/privacy-framework/using-privacy-framework-11).
- W3C recommends semantic table/definition relationships rather than visual
  cues alone, programmatically determinable status messages, and a standard
  disclosure pattern for expandable supporting detail:
  [Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/),
  [WCAG 2.2 Status Messages](https://www.w3.org/TR/WCAG22/#status-messages),
  and [Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
- OWASP API3:2023 recommends cherry-picking only required response properties
  and enforcing a response schema. This response adds only a fixed, content-
  free contract and rejects record access:
  [Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/).

## Recommendation Stack

1. Keep deterministic policy evidence and aggregate correction measurement as
   the source of authority.
2. Keep AI and RAG advisory; neither selects historical records or changes a
   policy from this signal.
3. Use the preflight contract to distinguish a review-worthy aggregate from an
   enabled historical corpus.
4. Require explicit server-side authorization, a purpose-limited redacted
   projection, retention/deletion enforcement, and operator audit before any
   historical record is made available.
5. Evaluate the resulting corpus offline with a documented sampling manifest,
   uncertainty measures, and independent review before it can inform a
   recommendation; never let it auto-tune or route media.
