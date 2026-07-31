# Policy Compatibility Section Configuration Summary Scope Audit

**Status:** Implemented  
**Phase:** 6R.5 Operator Workflow Rebuild  
**Research baseline:** June 2026 best practices, reviewed 2026-07-31

## Decision

Delete `summarizePolicyIntentSection` and the `behaviorSummary` card field.
Compatibility cards already render each configured draft value as a labeled,
provenance-aware chip. The summary was redundant and every non-empty sentence
interpreted how the runtime would use a policy signal.

The compatibility card therefore retains factual configuration display through
its labeled chips and direct control instructions. Native policy workflow
readiness remains the only server-owned behavior and readiness projection.
This change adds no endpoint, policy write, validation rule, or runtime
decision logic.

## Scope Classification

| Summary message | Classification | Decision |
| --- | --- | --- |
| `This destination is defined by ...` | Browser interpretation of destination identity | Delete; the Belongs Here chips display the configured values. |
| `... can support a match ...` | Browser interpretation of matching behavior | Delete; Helpful Matches labels and chips describe the configuration. |
| `Items must stay within ...` | Browser interpretation of enforcement | Delete; the configured maximum-rating chip displays the value. |
| `Classifarr should ask when ...` | Browser interpretation of review behavior | Delete; review-trigger chips display the selected conditions. |
| `... can raise confidence ...` | Browser interpretation of confidence behavior | Delete; Boost chips display the configured values. |
| `... should count against this destination` | Browser interpretation of exclusion behavior | Delete; Avoid chips display the configured ratings. |

## Research And Recommendation

[OWASP's Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
recommends deriving security-relevant values and enforcing workflow invariants
on the server. A browser summary must therefore not imply that it evaluates
policy behavior, automation, or enforcement from an unsaved draft.

[W3C's Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/) recommends
short forms with clear labels and instructions for the inputs that matter. The
section label, action help, and labeled chip list provide that direct,
accessible context without a redundant behavior paragraph.

### Options

| Option | Pros | Cons |
| --- | --- | --- |
| Retain behavior summaries | Familiar prose above chips | Duplicates configured values and implies client-owned runtime semantics. |
| Rewrite summaries as factual text | Removes the strongest behavior claims | Still repeats the labeled chip list and adds visual density without new information. |
| Remove the summary and retain chips | One factual configuration display, less cognitive load, no browser behavior claim | Removes redundant prose that some readers may have used for scanning. |

## Final Recommendation Stack

1. Use labeled configured-signal chips as the sole compatibility-draft display.
2. Keep direct static instructions beside their editable controls.
3. Keep option availability and duplicate prevention local to the control.
4. Keep policy semantics, enforcement, review, routing, and readiness on the
   server.
5. Do not recreate a behavior-summary helper or compatibility API for unsaved
   draft interpretation.

## Implementation Outcome

- Deleted `summarizePolicyIntentSection` and its helper used only for summary
  text.
- Removed `behaviorSummary` from section projection, card rendering, and
  focused client tests.
- Preserved labeled chips, provenance labels, removal commands, option
  diagnostics, and typed draft commands unchanged.

## Verification

- Focused projection, section, card, and editor tests verify the removed field
  and retained chip/control behavior.
- Full client tests, build, static checks, coverage ratchet, and affected
  server inventory checks remain release gates.

## Next Item

The compatibility routing-readiness card retirement audit is implemented in
[Policy Compatibility Routing-Readiness Card Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
The grid retirement is implemented in [Policy Compatibility Setup-Card Grid
Retirement Audit](policy-compatibility-setup-card-grid-retirement-audit.md).
Next, perform the **Phase 6R.5 policy user-mental-model setup-card contract
audit** and remove unreachable server-side card data without disturbing active
workflow contracts.
