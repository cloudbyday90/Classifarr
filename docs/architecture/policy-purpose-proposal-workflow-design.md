# Low-Touch Policy-Purpose Proposal Workflow — Design

Status: proposed. Assessed on 10 September 2026 against the requested August
2026 best-practice baseline. No automatic policy change is enabled by this
document.

## Problem

The current reconciliation worklist groups matching provenance, but still
requires one **Review and declare purpose** action per profile-derived policy.
That is high-friction and visually dense. It also invites a dangerous shortcut:
turning observed library contents directly into the policy's future authority.

The distinction matters. Library contents say what was previously placed in a
library; they do not reliably say what belongs there. The `Deep Water` example
is precisely the failure mode: a previous broad or mistaken placement can make
an unrelated title look like corroborating evidence. A bulk, silent conversion
of those observations into declared rules would make that error durable.

## Decision

Replace the many-button worklist with a proposal-first, exception-focused
workflow. It reduces repeated interaction without treating profile evidence as
semantic proof.

```text
inventory + existing policy structure + declared constraints
                         |
                         v
      deterministic, revision-pinned purpose proposals
                         |
          +--------------+--------------+
          |                             |
          v                             v
safe, non-conflicting group       ambiguity, conflict, or stale revision
          |                             |
          v                             v
one grouped administrator review      compact exception queue
          |
          v
transactional revision-checked apply -> automatic refresh -> scheduler reassessment
```

“Safe” here means the proposal is a current, server-derived draft that passes
the same structural and overlap checks used for an individual update. It does
not mean that a profile-derived term is independently correct. Until the
held-out evaluation has calibrated a trusted proposal source, a single explicit
administrator approval remains the correct boundary for a batch that changes
policy authority.

## Interaction model

1. On page load, Classifarr fetches one compact status: for example,
   “10 purpose drafts ready; 8 can be reviewed together; 2 need attention.”
   It auto-refreshes after policy changes and on a bounded interval; it does
   not require a separate Refresh or Test action.
2. The default view shows only the summary, the grouped libraries, and the
   reason an exception needs attention. Rule-level detail is progressively
   disclosed.
3. **Review 8 proposals** opens a single review surface. It presents a count,
   library/policy identity, each proposed change, and any overlap warning; the
   final action is one explicit, accessible **Apply 8 reviewed purposes**.
4. The server re-reads every current revision, validates every proposal, and
   either commits the complete batch with per-policy audit receipts or returns
   no changes and identifies the stale/conflicting entries. It must not apply a
   subset while telling the user the batch succeeded.
5. After a successful commit, the existing scheduler and the semantic-study
   readiness summary refresh automatically. The page reports the result in a
   `role="status"` region without moving focus. Individual review is reserved
   for exceptions, not normal setup.

## Security and data boundaries

- The proposal service is deterministic and server-side. It uses only the
  policy, library, and current declared-purpose inputs already authorised for
  the maintenance view; it does not call an external model or expose raw rules
  to an aggregate dashboard.
- Every proposal is bound to policy ID, policy revision, and a short-lived
  server-created batch token. The apply endpoint accepts that token only once,
  requires an administrator identity, and writes an append-only audit receipt.
- Validation occurs again inside the one database transaction. Stale,
  conflicting, malformed, or truncated proposals fail closed with no policy
  mutation.
- AI/RAG can later rank or explain a proposal only as a bounded draft input.
  It must never auto-declare purpose, alter routing, or use independent study
  labels. The paired retrieval study is the prerequisite for evaluating such a
  ranker rather than assuming it is reliable.

## Options and trade-offs

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Keep one button per policy | Smallest implementation | High repetitive effort; dense page; hides the real exception set | Reject |
| Silently promote profile-derived terms | No operator work | Reifies historic misplacements such as `Deep Water` into policy authority | Reject |
| Bulk apply every displayed row | Fewer clicks | Truncation, stale revisions, and mixed-confidence rows can create partial or unsafe change | Reject |
| Deterministic proposals, one atomic review for safe rows, exception queue | Low routine effort; auditable; preserves current authority boundary | Requires a batch contract and review surface | Select |
| Auto-apply after measured calibration and explicit administrator opt-in | Lowest ongoing effort | Requires a successful held-out evaluation, drift controls, rollback, and monitoring | Defer |

## Research basis

- The [NIST AI RMF Measure playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
  calls for meaningful measures, documentation of limitations, and evaluation
  for limitations and usability. It supports treating profile evidence as a
  measured proposal input rather than unchecked authority.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends provenance, integrity checking, strict access boundaries, and
  fail-closed handling. Revision pins, a single-use batch token, revalidation,
  and atomicity apply those controls to policy maintenance.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires status changes to be programmatically determinable without moving
  focus. A compact auto-refreshing status plus progressive disclosure is more
  accessible than a permanent table of repeated controls.

## Recommended implementation order

1. Add a read-only proposal summary and compact exception grouping to replace
   the repeated worklist controls.
2. Add the revision-pinned, all-or-nothing batch review/apply API and audit
   receipt, with no AI/RAG call and no automatic apply.
3. Build the private scorer for the paired retrieval-label ablation already
   implemented in this release line; use its measured outcome to decide
   whether a bounded proposal ranker is warranted.
4. Only after calibration, add an opt-in unattended mode for a narrow,
   monitored proposal class with rollback and drift thresholds.
