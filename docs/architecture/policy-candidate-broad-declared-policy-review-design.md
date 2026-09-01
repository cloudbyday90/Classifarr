# Broad Declared-Policy Review Recommendation Design

## Status

Implemented on the unreleased branch. This design is a read-only policy
maintenance recommendation. It does not identify a policy, alter a score,
invoke AI or RAG, learn from an outcome, retry work, or route media.

## Problem

Classifarr already calibrates broad compatibility and insufficient specialized
evidence before candidate ranking. The remaining maintenance question is
whether that bounded deterministic calibration is repeatedly associated with a
later operator destination change.

The existing Correction Analytics page retained the necessary aggregate data,
but only exposed a broad all-evidence trend. That made an operator infer a
specific next policy-maintenance task from dense monitoring tables.

## Selected Design

The client derives one recommendation from the existing, authenticated
aggregate-only longer-horizon report:

```text
fixed declared_policy:contextual aggregate bucket
  + two adjacent completed 28-day periods
  + review-ready 95% Wilson interval in both periods
  + comparable aggregate cohort mix
  -> read-only recommendation to review policy scope
```

`declared_policy:contextual` is a fixed internal evidence state. It represents
a policy whose declared signal is broad/overlapping or has insufficient
specialized evidence; it is not a library-content match, model judgement, or
semantic conclusion. The browser accepts only that exact allow-listed bucket,
its count-derived readiness contract, and the two date windows. Unknown server
fields, policy terms, library names, titles, model data, prompts, retrieval
text, and actor identity are not retained for rendering.

The recommendation is not shown when either period lacks observations, is
inconclusive, has no material signal, has a missing or malformed bucket, or the
cohort guard reports insufficient data or a material mix shift. This is a
fail-closed recommendation: absence means “no focused recommendation,” not
“the policy is correct.”

## Operator Experience

When the narrow review condition is met, Statistics shows one compact card:

- plain-language next step: review a policy that may be too broad;
- an explicit statement that it does not identify or prove a policy problem;
- a native disclosure with the two aggregate periods, changed-selection counts,
  rates, and existing Wilson intervals;
- a reminder to inspect representative decisions before editing a policy.

It adds no button, no automatic refresh control, no live-region announcement,
and no navigation with policy identity. This keeps a data-dependent advisory
from making the already information-dense page busier. The native disclosure
uses the browser-supported disclosure pattern for user-controlled detail;
changing the disclosure does not need an asynchronous status announcement.

## Security and Authority Boundary

- The server query, authentication boundary, completed-UTC-day windows, and
  fixed low-cardinality dimensions are unchanged.
- No database migration, new endpoint, new query parameter, or event-level
  correction record is introduced.
- Client validation recomputes and checks count-derived readiness before the
  recommendation can appear; duplicate or malformed matching buckets cannot
  produce one.
- The UI interpolates client-owned copy and aggregate numbers only. It renders
  no HTML from the server.
- The recommendation is advisory and human-gated. Deterministic ranking
  calibration remains unchanged and AI/RAG gain no authority.

## Research and Options

Research was checked September 1, 2026, using guidance available through
August 2026.

NIST’s [AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
calls for regular measurement, documentation of uncertainty, and incorporation
of adjudicated feedback. This design uses validated operator outcomes as a
bounded measurement signal, preserves uncertainty, and leaves the maintenance
decision to a human.

W3C’s [Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
defines the expected interaction and `aria-expanded` semantics for
user-controlled detail. W3C’s [WCAG status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
also distinguishes user-controlled expansion from asynchronous status changes;
therefore the optional explanation is a native disclosure, not another live
announcement.

OWASP’s [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
recommends appropriate logging scope and protection. The design reuses
low-cardinality aggregates rather than creating a new title-, library-, or
operator-level review log.

| Option | Benefits | Costs and risk |
| --- | --- | --- |
| Per-policy correction dashboard | Direct ownership and drill-down | Requires retaining and authorizing policy identity and representative history; a larger privacy, retention, and inference surface. |
| Let AI or RAG reinterpret corrections | May appear adaptive | Weakens deterministic authority, makes causality unclear, and risks overfitting to sparse or shifted cohorts. |
| Show every evidence-state trend inline | Complete aggregate visibility | Recreates the dense, hard-to-action monitoring experience. |
| Fixed aggregate-only scoped recommendation (selected) | Specific next step, uncertainty-aware, privacy-minimized, human-gated | Cannot name a policy or establish causality; needs two representative periods before appearing. |

## Final Recommendation Stack

1. Keep broad compatibility calibration deterministic and pre-rank.
2. Use only `declared_policy:contextual` aggregate corrections to identify a
   potential declared-scope review area.
3. Require two adjacent representative 28-day periods and a comparable cohort
   before showing the recommendation.
4. Show one progressive-disclosure card, not another persistent evidence table
   or automated action.
5. Require an operator to review representative decisions and edit policy scope
   through the existing policy-maintenance workflow, if warranted.
