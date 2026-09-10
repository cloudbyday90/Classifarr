# Automatic Private Cohort-Capture Handoff — Design

## Decision

Classifarr will automatically expose one aggregate-only `private_cohort_capture_ready`
condition when the existing passive eligibility audit is current, complete, internally
consistent, and has at least the existing balanced 28-case target (seven eligible cases
in each of `documentary`, `genre-overlap`, `ordinary`, and `reality`).

It will not automatically run private capture, persist a snapshot or embedding set,
select a case, invoke AI/RAG, create a label, learn, alter policy, or route media. The
existing protected capture workflow remains a separate controlled operation.

## Context

The lifecycle scheduler already runs the read-only eligibility audit only when its source
fingerprint is fresh. Before this change, a current complete audit could establish that a
balanced capture frame was available, but the command-center projection still described it
as an undifferentiated future prerequisite. The UI therefore looked inactive even when the
platform had automatically completed the only safe prerequisite it owns.

The new handoff reuses that audited aggregate. It introduces no schedule, endpoint,
database table, retention policy, background model call, or browser-stored state.

## Design

### Pure readiness evaluator

`heldOutSemanticStudyCohortCaptureReadiness.mjs` accepts an audit receipt and returns a
boolean only. It requires:

1. eligibility-audit contract version `v6`;
2. `complete` status (not truncated, changed, or failed);
3. non-negative integer candidate and eligible counts for every fixed stratum;
4. eligible counts that do not exceed candidates and meet the fixed target; and
5. a candidate total equal to the sum of stratum counts.

Malformed, stale, incomplete, inconsistent, or insufficient input fails closed. No receipt
or case information crosses the evaluator boundary.

### Readiness projection

The server uses the evaluator only after it has proved that the aggregate audit receipt is
current for the lifecycle source fingerprint. It adds the closed boolean
`privateCohortCaptureReady` to the administrator-only projection and requires it to exactly
match the measured-blocker identifier. The client repeats the same closed contract checks
and discards any malformed or expanded response.

The Command Center presents a one-line status: **Private capture ready**. Detail remains
behind the existing evaluation link. No new control is shown, so the status cannot be
mistaken for a route, a model approval, or a request to export library data.

## Alternatives

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Automatically capture then discard | Feels hands-off | Performs protected work that cannot be reviewed; can waste resources; hides failures | Rejected |
| Automatically persist capture material | Enables immediate study work | Creates a new retention/authorization surface for library-derived material | Rejected |
| Manual refresh/status only | Minimal change | Reintroduces repetitive operator work and conceals automatic progress | Rejected |
| Aggregate-only automatic handoff | Clear progress, no new data handling, reuses scheduler | A controlled follow-on remains necessary | Selected |

## Security and privacy properties

- The evaluator accepts and returns aggregates only; it cannot select media.
- Contract validation fails closed on version/status/count discrepancies.
- Existing readiness projection fields continue to prohibit configuration, library, and
  media identities.
- The browser receives no audit receipt, policy, candidate, model output, embedding, or
  capture material and stores no status locally.
- The handoff has no routing authority and keeps `semanticCohortReady`, labels, semantic
  selection, and routing flags false.

## Research basis (reviewed 2026-09-10)

- The [NIST AI RMF Playbook — Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)
  calls for measuring system behavior with documented metrics, tests, and conditions. The
  aggregate gate documents its conditions and does not imply a quality result.
- [W3C WAI form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) and
  [WCAG 2.2 SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  support concise, programmatically determinable status messages. The summary is short,
  uses the existing status presentation, and preserves detail on the linked page.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  identifies sensitive retrieval/embedding data as a data-exposure concern. Avoiding an
  automatic capture or persistence path limits that exposure surface.

## Consequences

The UI becomes more hands-off without pretending that the system has evaluated semantic
quality or is authorized to learn. A real local installation remains `await_*` until its
own ordinary policy activity produces a current complete audit with seven policy-eligible
cases in every stratum.
