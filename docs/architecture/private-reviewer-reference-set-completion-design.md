# Private Reviewer Reference-Set Completion — Design

Status: implemented, unreleased. Sources were checked on 10 September 2026
against the requested August 2026 best-practice baseline.

## Decision

Add a single ESM-only local command that completes the already-human portion of
the held-out semantic-study workflow. It accepts the original private packet
and two finalized content-free reviewer submissions; it then creates the
existing reference-set document only when both submissions exactly cover that
packet's fixture binding and reach consensus. A disagreement writes nothing and
reports that an adjudication submission is required.

This removes the remaining manual reference-set ID and separate root-script
handoff after reviewers have made real decisions. It does not create reviewer
worksheets, collect a decision, interpret a title or description, invoke
AI/RAG, train a model, alter a policy, or route media.

## Why this is the next safe automation

The Command Center already presents one concise, automatically refreshed,
aggregate readiness state. Rebuilding that UI would duplicate an existing
component and make the product denser. The protected boundary instead left a
small local handoff gap: completed reviewer submissions required a separate
composition command and an operator-selected identifier.

The new command automates deterministic work *after* independent human review:

```text
current private packet
        + two finalized human submissions
        |
        v
exact packet fingerprint and fixture-set validation
        |
        +-- invalid -> no output
        +-- disagreement -> no output; third adjudication required
        |
        v
complete content-free reference set under .tmp
```

`heldOutSemanticStudyReviewerReferenceSet.mjs` is a pure service. It obtains
only the packet's redacted binding (fingerprint and opaque fixture IDs), checks
both submissions against that exact set, and delegates decision consensus to
the existing independent-review service. It derives the reference-set ID from
the already-present SHA-256 fixture address; it does not retain it elsewhere.

`runHeldOutSemanticStudyReviewerReferenceSet.mjs` owns the process boundary. It
uses the existing constrained private JSON reader/writer: project-local `.tmp`
only, no symlinks, 512 KiB input maximum, realpath containment, exclusive
create, and requested `0600` output mode. Its stdout receipt includes only a
fixed status, aggregate counts, and whether output was written.

The command can also verify an identical existing reference set after a
downstream failure. It recomputes consensus first and compares the entire
bounded JSON document before continuing. Different or unreadable contents
remain errors; existing files are never overwritten. See the
[recovery design](retrieval-evaluation-recovery-design.md).

## Security and authority boundaries

- A structurally malformed packet, altered fingerprint, duplicate/missing
  fixture, mixed submission set, duplicate reviewer submission ID, or invalid
  adjudication fails closed.
- Review-time packet expiry remains enforced by the earlier finalization step.
  Consensus may happen afterward because it consumes only the already
  finalized, content-free documents and rechecks their immutable packet
  binding.
- A partial reference set is never written. An adjudicator receives the next
  action only through the aggregate status; the CLI prints no fixture IDs or
  labels.
- The service is in-memory and offline. It has no HTTP route, database access,
  scheduler, queue, provider, embedding, RAG, model, or routing dependency.
- Reviewer identity and the real-world independence of reviewers remain
  external operational controls. An opaque submission ID prevents duplicate
  documents but cannot prove who made the decision.

## Research basis

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, metrics, and independent evaluation. Exact
  packet binding preserves the provenance of the human reference set without
  turning it into automatic training data.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends provenance, integrity validation, access control, and fail-closed
  behaviour for sensitive retrieval-adjacent inputs. The workflow validates the
  content address and fixture set before writing an artifact.
- [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise updates without interrupting focus. No new browser status
  is added: the existing Command Center status remains the single automatic UI
  signal, while this local CLI returns a brief, non-sensitive completion
  receipt.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the separate root composition command | No new code | Requires manual ID selection and a disconnected handoff | Rejected |
| Automatically watch folders and compose on arrival | Most hands-off | Adds retention, lifecycle, and ambiguous reviewer-state handling | Rejected |
| Add a browser review/results dashboard | Familiar | Exposes sensitive workflow context and duplicates Command Center readiness | Rejected |
| Packet-bound local completion command | Reduces deterministic handoffs; fails closed; no new network surface | Two human submissions still must exist | Selected |

## Final recommendation stack

1. Keep the Command Center's existing aggregate auto-refresh as the sole UI
   progress signal.
2. Generate two distinct worksheets, collect independent human decisions, and
   finalize each while the packet is current.
3. Run `study:reviewer-reference-set`; add only the required third adjudication
   submission when it reports a disagreement.
4. Run the existing offline semantic results summary, then decide whether a
   separately governed, candidate-bounded advisory priority experiment is
   justified. Do not enable auto-routing from a single study.
