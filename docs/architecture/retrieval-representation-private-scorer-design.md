# Retrieval-Representation Private Scorer — Design

Status: implemented, unreleased. The research baseline is 31 August 2026;
official source pages were reviewed on 10 September 2026. This change creates
no release or version change.

## Decision

Add a bounded, private scorer that creates the previously missing categorical
submission for the retrieval-representation study. It compares four evidence
representations for every member of one fixed 24–32 item cohort:

1. declared library purpose;
2. the incoming media description;
3. nearest current-library history with its historical `Classified:` label;
4. the same nearest history after that label is removed by the existing
   formatter.

The scorer is an offline measurement tool, never a classification or routing
path. Its only persistent result is the existing schema-validated categorical
submission: `admit`, `review`, or `abstain` for each representation and opaque
fixture. It does not persist prompts, source records, library names, model
details, vectors, explanations, scores, or independent labels.

## Architecture

```text
one authorised cohort capture
  ├─ redacted evaluation bundle       (.tmp, 0600)
  ├─ reviewer packet                  (.tmp, 0600)
  └─ private scoring input             (.tmp, 0600)
                │
                ▼
  fixed read-only history source + held-out identity exclusion
                │
                ▼
  verified self-hosted Ollama structured-output evaluator
                │
                ▼
  fingerprint-pinned categorical submission (.tmp, 0600)
                │
                ▼
  existing paired included/excluded artifact and aggregate result workflows
```

`heldOutSemanticStudyRetrievalRepresentationScoringInput.mjs` makes the
private input exact and bounded. It contains the fixed cohort metadata,
opaque candidate IDs, internal library IDs used only by the local source, and
declared-purpose values. It deliberately excludes library and policy names,
policy provenance, retrieval results, historic labels, provider configuration,
and every reviewer or independent reference label. The input is fingerprinted
to the redacted bundle and snapshot, so a different cohort cannot be swapped
in after capture.

`heldOutSemanticStudyRetrievalRepresentationScoringSource.mjs` obtains at
most three current-history records per eligible candidate through a fixed,
parameterized query. It uses a read-only process/session, current inventory
membership, and the cohort exclusion scope. The raw records live only in the
process while the score is computed. The source failure result contains no
data and stops the run.

`heldOutSemanticStudyRetrievalRepresentationStructuredEvaluator.mjs` admits
only a non-cloud Ollama provider whose existing saved capability has already
verified provider-enforced structured output. It requests one strict JSON
schema with four categorical fields. Cloud, fallback, unverified, malformed,
or unavailable paths fail closed before the evaluator receives study material.
The prompt treats all retrieved text as untrusted data and permits no tool,
policy, learning, or routing action.

The scorer derives the two history representations from the same in-memory
records with `formatForEmbedding` and
`formatForEmbeddingWithoutClassificationLabel`. It therefore measures the
effect of *text shown to the evaluator*, not the effect of re-indexing stored
vectors. No routing confidence, policy, library placement, or learned profile
changes as a consequence.

## Security and privacy controls

- The CLI accepts only exact option pairs; it reads and writes through the
  protected `.tmp` private-file boundary.
- It sets `default_transaction_read_only=on` before importing the database
  pool-owning modules. Individual retrieval runs also have a held-out scope
  and bounded prepared parameters.
- Query text is fixed; all candidate IDs, media type, identity exclusions, and
  vector values are parameters. The output receipt is status-only.
- An evaluator can emit only the four decision IDs. Schema parsing rejects
  explanations or unexpected fields, and no raw provider response survives.
- The study remains blind to independently labelled reference outcomes until
  the existing aggregate evaluator compares a completed submission.

## Research basis

- The [NIST AI RMF Measure playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
  calls for documented metrics and limitations, representative measurement,
  and comparison of results before an operational decision. The fixed cohort,
  paired variable, retained limitations, and no-routing boundary implement
  that sequence.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends trust boundaries, provenance, validation, and treating retrieved
  content as data rather than instructions. Exact pins, schema validation,
  fixed queries, provider admission, and the untrusted-data prompt satisfy
  those controls.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise, programmatically determinable asynchronous state without
  disruptive focus changes. This backend-only checkpoint adds no dense screen;
  a later Command Center summary should use one quiet status message with
  progressive detail.

## Options and trade-offs

| Option | Advantages | Costs / risks | Decision |
| --- | --- | --- | --- |
| Use existing vectors as though label-free | Fast | Cannot remove historic source text; produces a false ablation claim | Rejected |
| Send raw source material to any configured AI provider | Simple | Violates the study trust boundary and could expose a private library | Rejected |
| Require a human to copy every condition outcome | Maximum manual control | Error-prone, burdensome, and does not scale to a fixed cohort | Rejected |
| Verified self-hosted structured scorer with categorical output | Reproducible paired measure, minimal durable data, no user review work during execution | Requires saved Ollama verification and an independent reference set | Selected |

## Final recommendation stack

1. Run this scorer only after the existing private-cohort readiness gate and
   only against a verified self-hosted structured-output Ollama configuration.
2. Produce one submission, then use the paired artifact and aggregate result
   workflows to compare label-included versus label-free evidence by stratum.
3. Do not change policy thresholds, automatic routing, or learning from this
   single offline result.
4. If label-free text is equivalent or better against an independent reference
   set, design a separately approved, reversible re-embedding pilot. If it is
   worse, keep the label only with a documented benefit and the current
   candidate-bound safeguards.

## Known limitation

The historical nearest-item *selection* still relies on the current stored
embeddings. This measure tests whether historical classification text changes
an evaluator's conclusion once comparable items are selected. It is not a
claim that a label-free embedding index has already been measured. A future
ephemeral re-embedding pilot is required to make that latter claim.
