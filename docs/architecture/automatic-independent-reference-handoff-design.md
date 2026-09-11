# Automatic Independent Reference Handoff — Design

Status: implemented, unreleased. This design was reviewed on 11 September 2026
against the requested August 2026 best-practice baseline.

## Decision

When an explicitly authorised private reviewer-packet capture succeeds,
Classifarr now prepares two separate, opaque reviewer worksheets as part of
the same local operation. This removes the repeated setup command and avoids
an easy mistake: accidentally reusing one reviewer's submission identity for
both labels.

The automation stops at worksheet preparation. Reviewers still choose every
`admit`, `review`, or `abstain` label independently. Replacing those labels
with the current library placement, policy outcome, retrieval result, or an AI
answer would be circular evidence, not a valid evaluation of RAG or metadata.

## Workflow

```text
aggregate capture-ready handoff
             |
             v
explicit local, read-only capture command
             |
             +-- redacted evaluation bundle
             +-- private reviewer packet (review context only)
             +-- private scorer input
             +-- reviewer-one opaque worksheet
             +-- reviewer-two opaque worksheet
             |
             v
two independent completed submissions -> existing consensus -> offline report
```

`heldOutSemanticStudyReviewerSubmissionPair.mjs` is a small ESM service that
calls the existing packet-bound worksheet builder twice using the same capture
instant and refuses a missing or duplicate submission ID. The reviewer-packet
workflow owns readiness, path uniqueness, controlled writes, and its aggregate
receipt. The CLI derives all five companion paths from the one requested packet
path; it never prints a path or private content.

The two worksheets contain only opaque fixture IDs, the study fingerprint,
expiry, fresh submission ID, and empty bounded decisions. They contain no
media description, library, policy term, placement, retrieval, embedding,
prompt, score, provider, model, or proposed label. All five artifacts continue
to use the existing project-local `.tmp` boundary with exclusive creation,
symlink containment checks, and requested POSIX `0600` mode.

## Command Center

The Command Center is intentionally not a reviewer dashboard. The semantic
evaluation card now shows only its current aggregate status, one sentence
about the next automatic capability, and a link to the detailed readiness
view. It neither starts a study nor implies that one has already run.

The status uses a concise `role="status"` live region, preserving context and
focus while avoiding the prior introductory and boundary paragraphs. Private
packet state is not persisted or shown in the dashboard, so the card cannot
misrepresent a local file operation as an application-wide learning state.

## Security and authority boundaries

- A current aggregate `private_cohort_capture_ready` handoff remains required
  before any private capture or worksheet preparation.
- A pair is created before the private packet is written. Any pair-preparation
  or worksheet-write failure is fail-closed and prevents packet creation.
- The workflow receipt says only whether companion artifact classes were
  prepared; it excludes paths, reviewer identity, labels, media, library,
  policy, and retrieval content.
- There is no new route, database table, browser storage, scheduler, provider
  request, RAG-index write, training operation, policy mutation, or routing
  authority.
- A distinct opaque submission ID helps bind documents, but does not prove that
  people are independent. Review assignment and secure distribution remain a
  local operational control.

## Alternatives and trade-offs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep two manual template commands | No workflow change | Repetitive setup and a greater chance of reuse or omission | Rejected |
| Auto-fill labels from policy, placement, or AI | Nearly no reviewer work | Circular ground truth; cannot measure retrieval correctness | Rejected |
| Add a browser review surface | Familiar interaction | Enlarges private-data retention, authorization, and dense UI scope | Rejected |
| Automatically prepare two content-free templates locally | Removes mechanical work while retaining independent labels | Human judgment and controlled distribution remain necessary | Selected |

## Research basis

- NIST's [AI RMF Measure playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
  calls for appropriate, documented measures and involvement of assessors who
  are independent of the front-line developers. The paired worksheets preserve
  that separation and bind labels to one frozen cohort.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends access control, provenance, bounded context, and fail-closed
  behavior. This flow keeps private context local, uses a fingerprint binding,
  and exposes only aggregate receipts.
- [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports programmatically determinable status without a focus change. The
  compact Command Center status conveys the automatic state without creating a
  noisy or interactive study panel.

## Final recommendation stack

1. Use automatic capture to prepare the packet, scorer input, and two fresh
   worksheets only when the aggregate readiness handoff is current.
2. Assign the packet to genuinely independent reviewers and finalize both
   worksheets before their review window expires.
3. Use the existing fingerprint-bound consensus and adjudication path for
   disagreement; do not substitute system output for a human reference label.
4. Run the existing paired retrieval-representation report and review error,
   coverage, and uncertainty by stratum.
5. Consider a separate, candidate-bounded advisory-priority experiment only
   when the measured result supports it. Keep routing deterministic.
