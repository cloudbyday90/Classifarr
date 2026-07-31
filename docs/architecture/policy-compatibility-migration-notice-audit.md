# Policy Compatibility Migration Notice Audit

**Status:** Implemented
**Phase:** 6R.5 Operator Workflow Rebuild
**Research baseline:** June 2026 best practices, reviewed 2026-07-31

## Decision

Reduce the compatibility migration notice to a factual, report-derived outcome
and an explicit local dismissal action. Retain the server report's removal
count, affected-policy count, bounded affected-preset preview, and
version-scoped local dismissal. Remove the browser-authored upgrade headline
and the instruction to manually reapply presets.

`PolicyPresetMigrationNotice.vue` remains a presentation component. Its parent
decides whether a normalized report exists, and
`usePolicyBuilderReferenceData.js` owns report parsing and local dismissal.
Neither layer writes policy state, establishes workflow authority, refreshes
providers, or controls runtime classification.

This change adds no endpoint, policy write, validation rule, or runtime
decision logic.

## Scope Classification

| Notice element | Previous copy or behavior | Classification | Decision |
| --- | --- | --- | --- |
| Headline | `Legacy preset attachments were auto-dropped after upgrade` | Browser-authored mechanism and timing framing | Remove. |
| Summary suffix | `Reapply corrected presets where needed.` | Browser-authored manual workflow instruction | Remove. |
| Preview label | `Recently removed:` | Browser-authored temporal interpretation | Rename `Affected presets:`. |
| Summary count | Removed attachment count and affected-policy count | Deterministic projection of server report fields | Retain. |
| Preview names | First three report attachment names or keys | Bounded, report-derived context | Retain. |
| Dismissal | `Dismiss` emits one event and stores only the report version locally | Local presentation preference, not policy mutation | Retain; name `Dismiss migration notice`. |
| Live-region role | No `status` or `alert` role | Persistent notice with an interactive dismissal action | Do not add a live-region role. |

## Research And Recommendation

[W3C's Understanding SC 3.3.2](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
recommends giving users the cues they need without cluttering the page with
unnecessary instructions. The report-derived removal sentence and bounded
affected-preset context communicate the outcome; a manual recovery prompt does
not describe a required control in this surface.

[W3C's Accessible Names and Descriptions guidance](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
recommends concise accessible names that convey a control's purpose. The
visible `Dismiss migration notice` text therefore provides the button's clear,
matching accessible name without an overriding ARIA label. [WAI-ARIA
1.2](https://www.w3.org/TR/wai-aria/) defines `status` as a polite live region;
this persistent notice is not modeled as a changed advisory status and also
contains an interactive action, so no unsupported live-region semantics are
introduced.

[OWASP's Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
states that client state is input rather than truth and that workflow
invariants belong on the server. The browser can present a server report and
remember local dismissal, but cannot establish migration success or prescribe
recovery workflow. [Vue's security guidance](https://vuejs.org/guide/best-practices/security.html)
also confirms that interpolation escapes HTML; the component renders report
text through interpolation and does not use `v-html`.

### Options

| Option | Pros | Cons |
| --- | --- | --- |
| Retain current headline and reapply prompt | Explains historic implementation terminology | Makes the browser a migration narrator and asks for manual work without current action authority. |
| Remove the notice entirely | Lowest visual density | Hides a real server-reported compatibility migration outcome. |
| Retain report-derived outcome and local dismissal only | Communicates bounded fact and preserves an accessible, non-mutating preference action | Detailed migration mechanics remain outside normal policy maintenance. |

## Final Recommendation Stack

1. Render only deterministic projections of the server-provided report fields.
2. Keep preview content bounded to affected names or keys; do not add provider,
   library, or policy queries to enrich it.
3. Use a concise visible dismissal label that states the action's subject.
4. Do not add `status` or `alert` semantics without a defined live-update
   contract and announcement behavior.
5. Keep migration execution, validation, recovery authority, and policy writes
   on the server; local storage retains only the dismissed report version.
6. Render report strings through Vue interpolation and never through `v-html`.

## Implementation Outcome

- Removed the hard-coded upgrade and auto-drop headline.
- Removed the browser-authored `Reapply corrected presets where needed.`
  instruction from normalized report copy.
- Renamed preview context to `Affected presets:`.
- Renamed the button to `Dismiss migration notice` while preserving its narrow
  event and version-scoped local persistence.
- Preserved report parsing, count and preview bounds, Vue text interpolation,
  modal ownership, typed compatibility event forwarding, API behavior, policy
  validation, and server-owned authority.

## Verification

- Focused notice, composable, maintenance-surface, and modal tests cover
  report-derived rendering, preview omission, local dismissal, version
  persistence, and absence of retired browser framing.
- Full client tests, build, static checks, coverage ratchet, affected server
  inventory checks, and documentation lint remain release gates.

## Next Item

The compatibility routing-readiness card retirement audit is implemented in
[Policy Compatibility Routing-Readiness Card Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
Next, perform a **compatibility setup-card grid retirement audit** for
`PolicyBuilderSetupCards.vue` and `policyBuilderSetupCards.js`. Confirm the
grid remains unmounted, then remove it rather than preserve stale anchors or
browser-derived readiness state.
