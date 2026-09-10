# Low-Touch Policy-Purpose Proposal Workflow — Outcome

Status: assessed, not yet implemented on 10 September 2026. This is not a
release and creates no policy change.

## Finding

The current purpose-declaration worklist is correctly conservative but poorly
shaped for routine use. It displays grouped provenance while still requiring a
separate entry into the same revision form for every policy. More importantly,
the source of each draft is profile-derived library context, which is not proof
of semantic intent. Automatically accepting the displayed rows would repeat
the kind of incorrect category reinforcement observed in the `Deep Water`
example.

## Recommended outcome

Implement one server-derived, revision-pinned proposal batch for compatible
policies, one explicit administrator review action for that batch, and a small
exception queue for conflicts or uncertainty. Refresh the readiness and
reconciliation summaries automatically after the transaction. Do not add a
second testing or acknowledgement step for normal compatible proposals.

This removes most repetitive clicks while keeping the one action that changes
policy authority visible and reversible. It also makes the interface quieter:
the default state becomes a concise readiness summary, with proposal evidence
and exception reasons available on demand.

## What remains deliberately unchanged

- Classifarr does not silently promote profile-derived terms into declared
  policy purpose.
- The worklist does not route media, select a study cohort, or give AI/RAG
  independent authority.
- A future autonomous mode is deferred until the paired held-out study has
  measured a trustworthy proposal source and an administrator has explicitly
  enabled a narrow monitored scope.

## Next item

Build the read-only proposal summary and the strict batch contract first. It
is the highest-value usability prerequisite because it reduces the current
ten-policy setup flow to one safe review plus genuine exceptions, while the
new private retrieval scorer remains the evidence prerequisite for any future
AI-assisted or autonomous proposal ranking.
