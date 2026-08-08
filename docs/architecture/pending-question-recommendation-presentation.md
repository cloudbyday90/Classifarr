# Pending Question Recommendation Presentation

Status: implemented with 10R.3.1 on 2026-08-08.

## Problem

The pending-classification answer contract offered every candidate destination as
an equally styled immediate confirmation. The runtime normalizer retained
ranked candidate scores, but the answer contract omitted them. An operator
could see a record-level confidence percentage without knowing which action it
described, while a first-ranked candidate and unrelated alternatives appeared
equally recommended.

This was inaccurate and unsafe for an intent-first system: an evidence score is
not a probability, an answer candidate is not an automation authorization, and
an operator should not have to infer which destination the runtime considers
leading.

## Research And Options

- The [W3C ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/)
  distinguishes immediate-action buttons from choice widgets. This UI uses
  buttons because confirmation acts immediately; it does not present a
  selection state requiring radio or listbox semantics.
- [WCAG 2.2 labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
  requires instructions that explain the required response. The presentation
  therefore names the leading destination, labels the numeric value as an
  evidence score, and states why automation stopped.
- [WCAG 2.2 input assistance](https://www.w3.org/WAI/WCAG22/Understanding/input-assistance)
  supports preventing and correcting consequential input mistakes. Alternatives
  are available, but placed behind an explicit review control instead of being
  visually equivalent to the leading action.
- The [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlist validation for fixed option sets. The client
  treats the presentation as display-only, while the existing server answer
  contract still validates the action, fingerprint, destination scope, and
  currentness before resolution.

### Considered Designs

1. Expose raw ranking diagnostics: offers maximum maintainer detail, but risks
   leaking policy, provider, or media-server data and turns a product question
   into a debugging surface.
2. Keep every destination as an equal confirmation: minimizes implementation
   work, but falsely signals equal evidence and lets bulk confirmation choose a
   destination simply because it is listed first.
3. Project a bounded leading recommendation: preserve only a server-owned
   candidate ID, canonical name, normalized 0-100 evidence score, and generic
   automation-stop reason. Render one primary confirmation and make other
   choices deliberate.

The third design is adopted.

## Design

`policyRuntimeQuestionRecommendationPresentation.mjs` derives a presentation
only for the normalized runtime-question contract. It accepts a candidate as a
leader only when its safe numeric score is uniquely highest among current,
server-known candidate destinations. A tie, missing score, out-of-range score,
or native persistence question produces no leader.

The projection contains only:

- a version and status identifier;
- the canonical leading destination ID and name, when available;
- an integer evidence score from 0 through 100;
- a bounded reason identifier and generic explanation for why automation did
  not proceed; and
- a count of other candidate destinations.

It never projects `policy_id`, `policy_name`, candidate diagnostics, provider
output, raw AI text, configuration, or media-server payloads. The answer
contract fingerprint includes this projection, so a displayed recommendation
cannot be separated from the server-owned question it describes.

`PendingQuestionRecommendationActions.vue` renders:

- one `Confirm <destination>` action only for a unique leading candidate;
- the established native-persistence current destination as one bounded primary
  confirmation when its answer contract contains exactly one server-designated
  destination; native persistence never receives an invented evidence score;
- the label `Evidence score`, never `confidence`, to avoid implying a
  probability or independent auto-classification threshold;
- a clear reason that automation stopped;
- alternate candidate confirmations only within a collapsed `details` review
  control; and
- a deliberate destination picker and retry action for manual or recovery
  cases.

`Confirm All` is restricted to items with the same validated leading
recommendation. It no longer resolves an item by taking the first candidate in
an array.

## Security And Behavior Boundaries

- The browser cannot create a recommendation or enlarge a candidate set.
- The client revalidates the recommendation's version, status, score range,
  and membership in the server candidate list before rendering it.
- A native current-destination action remains bounded by its server answer
  contract and is not treated as a ranked recommendation.
- The resolution request remains the existing minimal contract: version,
  fingerprint, action ID, and server ID. The server remains the authorization
  boundary for all of them.
- A leading recommendation is an operator aid, not automatic routing and not
  an authorization for learning or policy mutation.
- Existing normalized questions receive the projection when the pending route
  rebuilds their dynamic answer contract; no persistence migration is needed.

## Verification

- Focused server tests prove the unique leader, tied-score fallback, native
  question exclusion, and raw diagnostic omission.
- Answer-contract tests prove the projection is fingerprint-bound and native
  persistence has no inferred leader.
- Focused client tests prove canonical labels are used, invalid recommendations
  fail closed, one leading action is shown, alternatives start collapsed, and
  bulk confirmation skips items without a leading recommendation.

## Next Work

Proceed with 10R.3.2: privacy-bounded retry, recovery, stale-evidence, and
restart acceptance through real service boundaries. It should ensure recovery
actions remain useful without exposing provider internals or overriding the
recommendation and answer-contract boundaries defined here.
