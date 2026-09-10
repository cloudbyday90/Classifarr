# Private Reviewer Evidence Continuity — Design

Status: implemented, unreleased. Research was checked on 10 September 2026
against the requested August 2026 best-practice baseline.

## Decision

When an authorised administrator creates a private held-out reviewer packet,
Classifarr now automatically creates one sibling, content-free evaluation
bundle under the same constrained `.tmp` boundary. The companion preserves
only the fixture contract, fingerprint manifest, and redacted semantic
snapshot needed for the already-existing aggregate results summary.

The private packet and the new companion have the same opaque fixture binding.
If the companion cannot be written, the workflow does not write the private
packet. This prevents collecting human reviews that cannot later be measured.

## Problem reconciled

The prior private-packet workflow built a valid in-memory study bundle, used it
to create the packet, and then discarded it. The subsequent reference-set
completion had no snapshot/fixture source to give the aggregate semantic
results summary. In practice, the claimed handoff from independent review to
measurement was therefore incomplete.

The review also found that the held-out fixture correctly declared exact
contrastive evidence as `not_applicable`, but the generic offline-evaluation
contract rejected that existing status. The status now validates and maps to
the neutral `abstain` decision. It does not assert an identity match, create a
contrastive lookup, or bias the semantic measurement.

## Architecture

```text
private cohort capture
        |
        +-- private reviewer packet (media + declared policy context)
        |
        +-- redacted evaluation bundle (fixture/snapshot/manifest only)
                    |
two independent reviewer submissions
        |
packet-bound reference-set completion
        |
aggregate semantic results summary
```

`heldOutSemanticStudyEvaluationBundle.mjs` is a pure ESM projection service.
It independently validates the capture bundle through the existing snapshot
adapter, verifies the exact packet fingerprint and opaque fixture set, projects
only the necessary three documents, JSON-clones the result to discard unknown
runtime fields, and deep-freezes the output.

`runHeldOutSemanticStudyReviewerPacket.mjs` derives the sibling file name from
the already-authorised packet output and writes it through a dedicated module
that reuses the strict private JSON boundary. The caller is not asked to choose
another path, and the public receipt reveals neither path nor content. It only
adds the Boolean `evaluationBundlePrepared`.

## Security and authority boundaries

- The bundle writer inherits `.tmp` containment, symlink rejection, realpath
  checks, a 512 KiB input limit where relevant, exclusive create, and requested
  `0600` permissions from the existing private-file boundary.
- A fingerprint mismatch, fixture-set mismatch, malformed snapshot, malformed
  manifest, or unsupported field fails closed before private packet writing.
- The output excludes the packet, title, description, candidate/policy context,
  current placement, retrieval text, embeddings, prompts, model output, and
  reviewer data.
- `not_applicable` means exact contrastive evidence was intentionally not
  measured. It maps only to aggregate `abstain`, never to an admit/review
  decision.
- The change creates no HTTP API, database table, queue task, scheduler,
  provider call, RAG retrieval, learning loop, policy change, or routing path.

## Research basis

- The [NIST AI RMF Measure function](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented evaluation inputs, provenance, and measurement. The
  companion retains only the reproducibility inputs required for a later,
  independently labelled aggregate measurement.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends integrity validation, data minimisation, and fail-closed handling
  for retrieval-adjacent artifacts. Exact packet binding and the redacted
  projection implement those properties without exposing study contents.
- [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise updates that do not steal focus. The existing Command Center
  remains the sole browser status surface; no new dense panel is introduced.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Discard capture bundle after packet creation | Minimal retention | Makes later measured evaluation impossible | Rejected |
| Put snapshots into the reviewer packet | Fewer files | Gives reviewers unnecessary semantic evidence and breaks independence | Rejected |
| Ask for a second bundle path | Explicit | Adds a mechanical handoff and error-prone choice | Rejected |
| Automatically write a redacted sibling bundle | Enables measurement; no extra UI or choice; preserves review blinding | Adds a short-lived local artifact | Selected |

## Final recommendation stack

1. Create the private reviewer packet once; let the workflow create its
   redacted sibling automatically.
2. Collect and finalise two genuine independent submissions.
3. Complete the packet-bound reference set; obtain adjudication only for a
   real disagreement.
4. Feed the redacted bundle and completed reference set to the aggregate-only
   semantic results summary. Use the measured report to decide whether any
   separately governed AI/RAG advisory experiment is warranted.
