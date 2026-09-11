# Low-Touch Policy-Purpose Proposal Workflow — Outcome

Status: implemented and locally verified on 10 September 2026. This is not a
release. The feature creates policy changes only after one explicit
administrator action.

## Finding

The current purpose-declaration worklist is correctly conservative but poorly
shaped for routine use. It displays grouped provenance while still requiring a
separate entry into the same revision form for every policy. More importantly,
the source of each draft is profile-derived library context, which is not proof
of semantic intent. Automatically accepting the displayed rows would repeat
the kind of incorrect category reinforcement observed in the `Deep Water`
example.

## Recommended outcome

Implemented one server-derived, revision-pinned proposal batch for compatible
profile-derived policies, one explicit administrator action for that complete
batch, and a small exception queue for mixed or unverified provenance. The
reconciliation view refreshes the proposal after the transaction and on a
bounded visible-page interval. It does not add a separate refresh, test, or
acknowledgement step for compatible drafts.

This removes most repetitive clicks while keeping the one action that changes
policy authority visible and reversible. It also makes the interface quieter:
the default state becomes a concise readiness summary, with proposal evidence
and exception reasons available on demand.

## Delivered safeguards and verification

- The read response contains only policy/library identity, aggregate counts,
  provenance categories, and an opaque fingerprint. Raw purpose terms remain
  server-side.
- The apply request supplies only that fingerprint and the complete compatible
  policy list. The server reads the current plan again inside one transaction,
  rejects stale, truncated, malformed, partial, or replay-inconsistent work,
  and commits all child changes or rolls back all of them.
- Existing append-only, per-policy native-intent change receipts provide the
  durable idempotency record. The batch derives a distinct child key for every
  policy and exposes none of those keys.
- The card uses a polite status message and progressive disclosure, preserving
  focus while a background refresh updates its readiness. It makes no AI/RAG
  provider call, semantic-study selection, learning write, or routing change.
- Unit, route, component, API, and PostgreSQL integration coverage verify the
  opaque contract, authenticated route, exact-plan admission, durable replay,
  and rollback of a first child write when a later child cannot apply.

## Open pull-request check

The repository's GitHub pull-request API was queried with `state=open` on 10
September 2026. It returned no open pull requests, so there was no random PR
to implement locally. No pull request was merged or otherwise changed.

## What remains deliberately unchanged

- Classifarr does not silently promote profile-derived terms into declared
  policy purpose.
- The worklist does not route media, select a study cohort, or give AI/RAG
  independent authority.
- A future autonomous mode is deferred until the paired held-out study has
  measured a trustworthy proposal source and an administrator has explicitly
  enabled a narrow monitored scope.

## Next item

Run the private scorer for the paired retrieval-label ablation already added
to this release line, then inspect its held-out result. It is the next
evidence prerequisite for any AI/RAG-assisted proposal ranking; until it is
measured, the new purpose batch remains deterministic and administrator-gated.
