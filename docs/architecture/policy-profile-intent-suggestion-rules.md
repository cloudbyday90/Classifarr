# Policy Profile Intent Suggestion Rules

## Status

Implemented as the deterministic profile-to-intent rule boundary for Phase 6R.2.

`policyProfileIntentSuggestionRules.mjs` converts a bounded
`policy.evidence.v1` projection into explainable proposed intent entries. It
does not read a media server, call a provider, persist policy data, create
learning, execute routing, or accept browser-provided rules.

## Problem

The media-server profile is evidence of current library application, not a
durable policy write. Classifarr needs to turn that evidence into useful
proposals without allowing broad genres, provider metadata, absent values, or
client-controlled fields to silently become destination authority.

Keeping this logic inline in the intent engine made rule ownership difficult to
review and made it easy for future changes to add an unexplained branch. The
rule service establishes one versioned, deterministic mapping with a stable
rule ID and server-owned explanation for every derived entry.

## Official Guidance Reviewed

Current guidance reviewed for this design, as of June 2026:

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  organizes trustworthy AI risk management around governed, mapped, measured,
  and managed behavior. Profile evidence therefore remains traceable,
  explainable proposal input instead of silently becoming policy authority.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side derivation of values that affect state and explicit
  workflow enforcement. The server derives every rule result from trusted
  projection data; the UI cannot select a rule, authority source, or outcome.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlists and semantic validation. Rule IDs,
  destination fields, reason codes, and static explanations are allowlisted and
  validated when a descriptor is present in an intent entry.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends documented security requirements and verification. The pure rule
  plan has deterministic-order, authority, payload-redaction, and tamper tests.

## Options

### Keep Rule Branches Inline In The Intent Engine

Pros:

- Smallest immediate code change.
- No additional service boundary.

Cons:

- Rule catalog, explanation text, and ordering remain coupled to draft
  assembly.
- Harder to test or audit rule behavior independently.
- Future callers may duplicate branches or produce a different proposal.

### Use Flexible Ranking Or AI To Choose Intent Fields

Pros:

- Can adapt to unusual libraries without new deterministic rules.

Cons:

- Weakens explainability and reproducibility.
- Risks promoting metadata or broad genres into identity.
- Requires a separate verification layer before any result is trustworthy.

### Use A Versioned Server-Owned Rule Plan

Pros:

- One deterministic mapping for all profile-derived proposals.
- Every entry has a static rule ID and explanation.
- Stable ordering makes audits, tests, and change review reliable.
- Authority rules remain explicit: only operator evidence creates hard limits or
  avoid entries; absence produces review suggestions.

Cons:

- New inference behavior requires an explicit rule and focused regression test.
- The initial catalog is intentionally conservative and may defer more cases.

## Final Recommendation Stack

1. Bounded evidence projection:
   `server/src/services/policyEvidenceBoundary.mjs`
2. Deterministic suggestion rules:
   `server/src/services/policyProfileIntentSuggestionRules.mjs`
3. Intent draft and bounded handoff:
   `server/src/services/policyIntentEngine.mjs`
4. Explicit operator acceptance and declared-intent command:
   `server/src/services/policyDeclaredIntentCommand.mjs`
5. Native persistence only after the existing authority and transaction gates.

The rule plan is proposal-only. It cannot bypass declared-intent commands,
learning eligibility, automation readiness, routing readiness, or native
storage authority.

## Implemented Rule Contract

Each output entry includes the existing evidence provenance fields plus:

```text
suggestion.version
suggestion.ruleId
suggestion.explanation
```

The explanation is a static server-owned string selected by the allowlisted
rule. It is never copied from a browser, provider payload, AI response, or
library label.

The implemented rules are:

| Input condition | Result | Rule boundary |
| --- | --- | --- |
| Specific observed library identity | `belongs_here` proposal | Remains inferred until accepted |
| Operator-declared identity | `belongs_here` proposal | Durable authority is preserved |
| Metadata offered as identity | `helpful_matches` proposal | Metadata cannot define identity |
| Broad observed genre without specific support | `helpful_matches` proposal | Warning explains the demotion |
| Observed compatibility evidence | `helpful_matches` proposal | Supports fit after identity is plausible |
| Operator-declared hard limit or avoid value | Constraint proposal | Observed values cannot create either field |
| Outlier, stale, or insufficient evidence | `ask_when` proposal | Never becomes an automatic exclusion |
| Declared or observed routing evidence | `routing_target` proposal | Routing stays separate from identity |

The plan is sorted deterministically by field, key, and authority. It reports
the applied rule IDs and provides an audit that recomputes the expected plan.
A changed explanation, field, reason code, or rule causes descriptor or plan
validation to fail.

## Security Outcome

- Raw evidence is rejected; callers must provide `policy.evidence.v1`.
- Object-valued payloads are normalized out of proposed entry values.
- Rule IDs and explanations are fixed server data, not request fields.
- Metadata and broad genres cannot bypass identity safeguards.
- Observed constraint-like values are ignored unless they have operator-declared
  provenance.
- Stale or absent observations create review requirements only.
- The service has no I/O or storage side effects.

## Verification

Focused coverage is in
`server/src/__tests__/services/policyProfileIntentSuggestionRules.test.mjs` and
protects deterministic ordering, source authority, broad-genre and metadata
demotion, absence handling, object-payload redaction, descriptor tampering, and
raw-input rejection. `policyIntentEngine.test.mjs` verifies that the draft
retains and audits the descriptor.
