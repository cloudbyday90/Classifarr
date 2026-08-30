# Policy Score Explanation Comparison Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr adds a local, read-only comparison for an operator-selected set of
two or three pending deterministic policy-score explanations. It is deliberately
not an AI feature, a policy editor, an authorization mechanism, a data export,
or a routing action.

The Command Center already renders each selected explanation to the same
operator. A pure ES module revalidates that bounded presentation, removes every
field except fixed evidence-category IDs, fixed calibration IDs, and bounded
numeric score mechanics, and creates the comparison entirely in the browser.

The word *operator* is intentional. The existing Command Center does not add
an administrator-only guard for this view. It therefore relies on the
Command Center's existing access boundary and must not be described as a new
administrator-only security boundary.

## Research Basis

- WCAG 2.2 requires a logical focus order. The comparison section is only
  focused after the operator explicitly requests the comparison and uses
  `tabindex="-1"`, so it is not an extra stop in the normal keyboard sequence.
  [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order)
- WCAG 2.2 describes status messages as updates that assistive technology can
  determine without moving focus. Selection count updates are short, polite,
  atomic status messages; opening the requested comparison is a separate,
  deliberate action.
  [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
- NIST's AI RMF separates measurement and human governance from model
  authority. The comparison measures deterministic evidence mechanics and
  leaves policy and routing decisions to their existing human-controlled
  workflows.
  [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OWASP API3 recommends selecting only the properties a feature needs. The
  view does not add an endpoint and projects only fixed source/calibration
  vocabularies and scores from data the operator already sees.
  [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)

## Design

```text
existing pending decision presentation
  -> revalidate allow-listed score explanation locally
    -> select 2–3 explanations in browser memory
      -> read-only comparison
        -> operator continues existing individual review and confirmation
```

`policyScoreExplanationComparison.js` is the sole transformation boundary. It
accepts an existing decision presentation and fails closed unless all of the
following are valid:

- a policy score, base score, and agreement multiplier are within fixed bounds;
- the calibration status is one of the existing fixed IDs;
- each component has an allow-listed source ID and bounded numeric values; and
- at least one unique component remains after validation.

The comparison is capped at three entries. Its output includes only the score,
thresholds, base score, agreement adjustment, component mechanics, calibration
status, and anonymous source coverage. It never includes a media title, item
ID, policy or library identity, provider/model state, prompt, response,
diagnostic, AI output, or route control.

When the operator selects two valid entries, **Compare selected score
explanations** becomes available. The action opens and focuses the resulting
named section. Changing a selection closes a prior comparison so the next view
always reflects the current bounded set.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Local comparison of 2–3 already-visible explanations | No new data path; useful evidence contrast; bounded attention and disclosure | Does not retain history or identify a policy gap automatically | Adopt |
| Administrator-only comparison API | Could compare records from other pages | Creates a new identity-bearing API and authorization surface | Reject |
| Compare every pending decision | Broad operational picture | Overloads the operator, increases exposure, and hides meaningful differences | Reject |
| Ask an AI model to summarize differences | Natural-language explanation | Introduces unreliable interpretation and unnecessary provider disclosure | Reject |
| Auto-edit policy from the comparison | Fast remediation | Makes a diagnostic view an unsafe policy/routing authority | Reject |

## Security And Accessibility Boundaries

- Selection exists only in the mounted client component and is never persisted
  or sent to an API.
- The existing decision-presentation parser rejects an unknown score-explanation
  version before the comparison path. The pure utility then validates the
  already-sanitized presentation again and fails closed on unknown categories,
  calibration states, duplicate components, or out-of-range values.
- The rendered comparison has no resolve, retry, policy-edit, provider, or
  routing control.
- The selection limit is fixed at three and enforced before rendering.
- The screen shows no new identity; the operator chooses entries beside the
  individual decisions they already have access to.
- Selection status does not steal focus. A visible focus indicator appears only
  after the explicit comparison action.

## Final Recommendation Stack

1. Review each pending decision's individual deterministic evidence first.
2. Select two or three decisions only when comparing their score mechanics will
   answer a concrete policy-maintenance question.
3. Use the local comparison to spot repeated missing or weak evidence
   categories, not to infer a routing outcome.
4. Review the aggregate confirmation-evidence readiness and existing purpose
   coverage before changing a policy.
5. Keep AI advisory and routing authority separate unless a future, separately
   designed feature establishes a bounded and auditable need.
