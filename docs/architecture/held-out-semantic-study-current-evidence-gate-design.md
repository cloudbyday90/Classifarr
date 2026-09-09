# Held-out semantic study current evidence-gate design

Status: implemented by existing services; observation reconciled on 9
September 2026.

## Problem

The private, read-only audit can explain a policy-only comparison population,
while the passive readiness contract determines whether the lifecycle
scheduler may retain and refresh that audit. Treating a direct audit result as
the scheduler's current state would conflate two different boundaries and
could invite an unsafe attempt to create missing policy evidence from a
library profile or configuration.

The platform needs a truthful, library- and configuration-agnostic account of
the current next prerequisite without making an operator inspect item rows or
allowing a diagnostic to create evidence, select cases, label media, invoke
AI, or route media.

## Decision

Preserve the existing two-stage boundary and document the resulting current
state rather than adding duplicate automation.

```text
current aggregate lifecycle evidence
  -> normal lifecycle receipt required | complete declared-purpose evidence required
  -> existing source-change scheduler, only after both are present
  -> current aggregate eligibility receipt
  -> existing balanced 24–32-case planner
```

The private audit remains a no-argument, read-only diagnostic. It may measure
the current canonical population, but it does not persist a lifecycle-managed
receipt or override a missing source prerequisite. The readiness projection is
the only current, administrator-facing automation signal; it returns fixed
counts and one fixed blocker identifier.

For the 9 September observation, the readiness projection reports
`normal_lifecycle_receipt_required`. A native declaration is not yet the first
missing prerequisite. After ordinary native authoring or a verified terminal
rebuild records a normal lifecycle receipt, the existing source gate will
evaluate whether complete retained declared-purpose evidence is also present.

## Research basis

W3C Data on the Web Best Practices calls for provenance, quality information,
versioning, and an explanation when data is unavailable. Separate versioned
aggregate observations make each missing prerequisite machine-processable
without exposing the underlying inventory or configuration. [W3C Data on the
Web Best Practices](https://www.w3.org/TR/dwbp/)

W3C Privacy Principles recommends minimizing data transfer to what is needed
for the user's goal. The readiness projection therefore retains fixed counts
and a fixed blocker, while the private audit reduces its in-memory assessment
to aggregate partitions. [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Promote profile observations to declared purpose | May appear to unblock a cohort | Creates circular library-derived policy authority | Reject |
| Persist every private diagnostic as lifecycle evidence | Makes more measurements visible | Confuses diagnostic and governing provenance; adds needless writes | Reject |
| Add another aggregate endpoint | Provides a new surface | Duplicates the existing closed readiness contract | Reject |
| Preserve the existing gate and reconcile its current evidence | Truthful, automatic, bounded, and portable | Does not manufacture a study-ready state | Adopt |

## Recommendation stack

1. Consume the existing readiness projection as the authoritative current
   prerequisite.
2. Let ordinary native authoring or a verified terminal rebuild create a
   normal lifecycle receipt; never synthesize it from a profile, library, or
   configuration observation.
3. After the source gate becomes available, let the existing scheduler refresh
   the aggregate audit without operator case selection.
4. Require a balanced 24–32-case cohort, independent labels, readiness, and
   frozen-study preflight before a measured semantic evaluation.
5. Consider semantic counter-evidence only after a good measured error
   profile. It may refer ambiguity to review and must never route media
   automatically.

## Non-goals

This observation does not create a lifecycle receipt, declared purpose,
cohort, label, semantic selection, provider call, policy change, or routing
decision. It adds no dependency, database migration, endpoint, scheduler, or
writer.
