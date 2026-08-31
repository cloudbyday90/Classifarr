# Policy-Change Review-History Offline Calibration Protocol Design

## Decision

Add a read-only protocol preview beside the existing calibration-readiness
status. The preview tells an administrator whether the controlled,
aggregate-and-synthetic offline evaluation may begin and, when it may, shows
the fixed evidence procedure. It does not calculate a threshold, create a
proposal, save a snapshot, call an AI provider, or change routing.

## Problem

`ready_for_human_review` proves that six bounded aggregate periods are
available. It does not make the following operator action explicit, and it
must not accidentally imply that the application will tune a policy. The next
component therefore needs to turn readiness into a precise, safe procedure
without increasing retained data or operational authority.

## Architecture

```text
server-owned aggregate periods
            |
            v
calibration readiness + review-process consistency
            |
            v
pure ESM protocol contract ----> fixed, redacted v4 summary DTO
                                            |
                                            v
                                  strict client allow-list
                                            |
                                            v
                         automatic accessible protocol status and checklist
```

The contract accepts only the two existing redacted read models. It fails
closed when either one is malformed. It does not receive a request selector,
period date, aggregate count, decision record, media title, actor, policy,
model, prompt, RAG result, or threshold value.

## Fixed Protocol States

| State | Meaning | Browser output |
| --- | --- | --- |
| `awaiting_aggregate_evidence` | Six eligible complete aggregate periods are not available | Status only |
| `review_process_follow_up_required` | Aggregate evidence is eligible but the current three-period process comparison is not consistent | Status only |
| `ready_for_offline_protocol` | Evidence is eligible and the current review process is consistent | Fixed four-step procedure IDs only |

The ready state requires both `ready_for_human_review` and `consistent`. Its
fixed procedure is: freeze an operator-held aggregate snapshot, run the
checked-in synthetic fixture suite, compare the fixed policy bands, and
prepare a human approval packet. The word "freeze" is an operator action;
this feature neither exports nor persists a snapshot.

Every state includes explicit `false` values for automatic policy changes,
AI/RAG tuning, routing changes, and threshold-proposal generation. The client
checks all those flags and discards unknown fields before rendering.

## Security and Privacy Boundaries

- The existing administrator-only, selector-free, rate-limited, no-store
  summary endpoint remains the only API boundary.
- There is no migration, new endpoint, scheduled job, manual action, write,
  queue, provider call, or RAG access.
- Existing retention remains the current plus six completed aggregate buckets;
  the protocol adds no new stored data.
- The new server module is a pure ES module with no database, network,
  provider, policy-engine, learning, AI/RAG, retry, or routing imports.
- The protocol is intentionally not a recommendation engine. A separate,
  human-reviewed change would be required before any versioned policy proposal
  could exist.

## Accessibility and Automatic Refresh

The section uses a labelled heading, concise `role="status"` notification,
and a semantic ordered list only when the procedure is available. It reuses
the existing initial load, page-visibility refresh, and five-minute visible
page refresh; it adds no button, focus movement, or duplicate timer.

W3C WCAG 2.2 Success Criterion 4.1.3 calls for programmatically determinable
status messages without receiving focus. ARIA22 describes `role="status"` as
the appropriate polite mechanism for application status updates. The list is
outside the live status so a periodic refresh does not repeatedly announce the
full procedure.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Fixed human-gated protocol preview (selected) | Explicit next action, reproducible, privacy-minimized, no model variance | Still requires a later offline human review |
| Automatically calculate a policy threshold | Fastest apparent workflow | Converts coarse aggregate activity into policy authority without review |
| Ask AI/RAG to design or evaluate the protocol | Could provide narrative assistance | Adds prompt/model variance, broader data flow, and non-reproducible governance |
| Document the process only | Lowest code surface | Leaves the operator interface ambiguous when readiness changes |

## Recommendation Stack

1. Surface a fixed, automatically refreshed protocol state from the existing
   redacted readiness and consistency signals.
2. Require the four fixed offline evidence steps before a human may prepare an
   approval packet.
3. Keep threshold values, AI/RAG, and routing outside this component.
4. Build a separate, reviewable proposal artifact only after this protocol has
   been exercised with real aggregate history and checked-in synthetic tests.

## Official Research

Research performed on 2026-08-31:

- [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C ARIA22: `role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [OWASP API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
