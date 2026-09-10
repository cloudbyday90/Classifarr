# Retrieval-Representation Artifact Production — Design

Status: implemented, unreleased. Official guidance was reviewed on 10
September 2026 against the requested August 2026 best-practice baseline.

## Decision

Add a local, offline artifact-production boundary for the next semantic study.
It accepts one complete, status-only evaluator submission for the exact pinned
cohort and emits a paired artifact set:

1. `historical_classification_label_included`
2. `historical_classification_label_excluded`

Each condition contains the same three representations—media description,
declared library purpose, and nearest-item history. The producer enforces that
the media-description and declared-purpose decisions are byte-for-byte the
same between conditions. Only nearest-item-history decisions can vary. This
prevents a label-ablation report from accidentally comparing several changing
inputs at once.

## Existing-state assessment

`embeddingServiceFormatters.mjs` currently includes
`Classified: <library name>` when `metadata.library_name` exists. The stored
`classification_embeddings` relation retains vectors and provider/model
metadata, not the source text that produced each vector. Therefore Classifarr
cannot truthfully remove that historical field retrospectively or claim that
an existing retrieval vector is label-free.

The formatter now has an explicit `includeClassificationLabel: false` option.
The default remains unchanged for compatibility. This is preparation for a
future controlled scorer that creates ephemeral, label-included and label-free
representations from the same fixed source records. This increment does not
re-embed historical items, call a provider, or alter existing vectors.

## Architecture

```text
pinned evaluation bundle + categorical evaluator submission
                         |
                         v
strict schema, fingerprint, and full-fixture validation
                         |
                         v
paired included/excluded artifacts
  (description and purpose invariant; history can differ)
                         |
                         v
existing aggregate evaluator -> condition-specific comparisons
```

`heldOutSemanticStudyRetrievalRepresentationSubmission.mjs` accepts only
opaque fixture IDs, SHA-256 pins, and five categorical decisions per fixture.
It rejects any prompt, source text, candidate/library name, provider/model
field, vector, reviewer field, independent label, duplicate, or partial
fixture set.

`heldOutSemanticStudyRetrievalRepresentationArtifactProducer.mjs` turns a
valid submission into two nested instances of the existing strict
representation-artifact contract. The new artifact-set service binds both to
the exact evaluation documents and rejects a confounded ablation. The existing
results command accepts this paired set and returns two condition-specific,
aggregate-only comparison groups.

`study:retrieval-representation-artifacts` only reads and writes below the
existing protected `.tmp` boundary. Invalid inputs write nothing. The terminal
receipt contains only a fixed status, not the artifact set.

## Authority and limitations

This is an artifact producer, not a model scorer. It deliberately has no
AI/RAG, database, network, learning, policy, retry, routing, or browser
authority. A valid output means only that the categorical submission was
complete, paired, and correctly bound—not that either condition is accurate.

The private scorer that creates a submission must be implemented separately.
It must use the same held-out cohort for both conditions, derive the label-free
text with the new formatter option, retain raw material only in process or in a
short-lived protected local input, and never use independent reference labels
while scoring. The aggregate comparison continues to require an independently
labelled reference set.

## UI decision

No Settings or review-screen UI is added. A paired artifact is an internal
study checkpoint, not a user decision or a routing result. If future measured
condition results are surfaced, Command Center should show one concise,
auto-refreshed availability state and offer details progressively. Any changed
availability message must be exposed as a programmatically determinable status
without moving focus.

## Research basis

- The [NIST AI RMF Measure playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
  calls for appropriate metrics, documented unmeasured risks, representative
  evaluation methods, and testing for limitations. The pair isolates the label
  variable and documents that current stored vectors cannot support a
  retrospective ablation.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends integrity verification, provenance, access boundaries, and
  fail-closed handling. Strict pins, exact schemas, no-output failures, and
  the existing private-file boundary apply those controls before a study result
  can exist.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires status changes to be programmatically determinable without focus
  changes and cautions against interrupting users unnecessarily. The study has
  no live panel until it has a concise, useful result.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Treat existing vectors as label-free | Fast | False claim: source text is not retained, so the field cannot be removed retrospectively | Rejected |
| Re-index the whole library immediately | Direct experiment | Cost, provider exposure, retention, and operational churn before a scorer is defined | Deferred |
| Pair two arbitrary evaluator submissions | Flexible | Allows cohort drift and unrelated representation changes | Rejected |
| Fixed paired, status-only artifact production | Isolates the label variable, preserves privacy, and feeds the aggregate evaluator | Requires a separately governed private scorer | Selected |

## Final recommendation stack

1. Use this producer only with one fixed, held-out cohort and a scorer that is
   blind to independent reference labels.
2. Build a bounded private scorer adapter that derives both history conditions
   from the same raw records using the explicit formatter variant.
3. Compare condition reports by stratum and uncertainty; do not raise routing
   confidence or change a policy from one aggregate alone.
4. If the label-free condition remains as good or better, propose a reversible
   re-embedding pilot. If it degrades, retain the field only with a documented
   reason and continued candidate boundary controls.
