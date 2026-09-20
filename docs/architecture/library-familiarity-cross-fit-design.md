# Small-library familiarity cross-fitting

## Goal and scope

The previous acceptance audit blocked 15 nominations because the incumbent could
not support a disjoint 20-reference / 20-calibration split. Evaluate an alternative
that uses scarce descriptions more efficiently without reducing the minimum
reference count, trusting Classifarr's own decisions or changing live routing.

This follows [candidate-specific acceptance](inventory-challenge-acceptance-outcome.md).
No library names, genre lists, questionnaires, new provider calls or UI panels are
needed. The existing split baseline remains the default and the paired control.

## Design

Add a bounded ESM numeric kernel for leave-description-out familiarity. Reuse the
existing deterministic description-group ordering and top-three cosine scoring.
From each library's admitted training descriptions retain at most 257 groups,
score at most 128 calibration descriptions, and exclude the scored description
from its own references. Every calibration query uses at least 20 references.
The held-out query uses the same reference count as the calibration queries:
`min(256, retainedGroups - 1)`. Thus a 24-group training library can supply 23
references per check; 20 or fewer groups must still abstain.

The outer evaluation fold, all matching description copies and provenance-rejected
groups remain excluded before cross-fitting. Calibrating one training description
must never re-admit an outer held-out item. Collapsed distributions abstain.
Keep the existing empirical tail rule unchanged. The result is an empirical
familiarity rank, **not a probability or a conformal coverage guarantee**.

Expose the kernel through an explicit opt-in mode on the existing snapshot-scoped
calibration factory, with separate versioned cache identities. Cross-fit receipts
cannot silently satisfy the default split-baseline acceptance validator. Retain
work, memory, fold and cancellation bounds; failed fits are evicted. No persistent
models or additional singleton state are introduced.

Extend the read-only leader benchmark to report raw nomination, split-baseline
acceptance and cross-fit acceptance on one frozen snapshot. Both acceptance arms
keep identical neighbor distinction and policy veto rules. Report anonymous
per-library results and sparse/degenerate abstentions, not private media content.

## Research verified 20 September 2026

- [Scikit-learn grouped evaluation guidance](https://blog.scikit-learn.org/updates/update-on-metadata-routing/)
  explains why related samples must remain together to avoid leakage. Here the
  grouping unit is the complete normalized description, including identity copies.
- [Scikit-learn calibration documentation](https://scikit-learn.org/stable/modules/generated/sklearn.calibration.CalibratedClassifierCV)
  uses out-of-fold predictions for calibration and warns about fitting/calibration
  overlap. This motivates excluding each scored group; our familiarity kernel does
  not implement that classifier or claim probability calibration.
- [OWASP RAG guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  motivates provenance checks, bounded work, integrity verification and fail-closed
  behavior. Existing source drift and routing boundaries remain mandatory.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  warns against excessive announcements and requires accessible semantics when
  status is displayed. This experiment adds no screen or accessibility claim.

URLs were discovered with search and their contents opened through research tools.
The proposed algorithm is an engineering hypothesis, not a standards requirement.

## Options, pros and cons

| Option | Benefit | Limitation | Recommendation |
| --- | --- | --- | --- |
| Keep disjoint split only | Simple, independent calibration/reference sets | Cannot assess 21–39 training groups | Preserve as control |
| Lower evidence minimum | More coverage cheaply | Weakens evidence without resolving leakage | Reject |
| Group-excluded cross-fit | Uses small libraries without self-matches | Correlated calibration values; extra CPU and possible instability | Evaluate now |
| Change live routing immediately | Potentially fewer reviews | Weak labels and unproven loss tradeoffs | Defer |

Final stack: provenance-clean grouping, bounded cross-fit familiarity, unchanged
calibrated distinction, paired per-library evaluation, then separately validated
live integration only if warranted. No threshold tuning on this audit.

## Verification plan

Test the 20/21/24-group boundaries, independent score-oracle agreement, equal
reference counts, no self-reference, shared descriptions, normalization, malformed
vectors and hashes, source mutation, cancellation/retry, cache limits, explicit
version admission and unchanged veto behavior. Replay the balanced 300-item audit
on local Compose under database read-only enforcement, then record outcomes in a
separate document before deciding the next step.
