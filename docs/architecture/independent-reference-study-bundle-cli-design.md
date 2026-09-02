# Independent Reference Study Bundle CLI Design

## Status

Implemented on the unreleased branch on 2026-09-02. This is an offline,
read-only evaluation path. It does not introduce HTTP, UI, database, AI, RAG,
learning, policy-change, retry, operator-workflow, or routing authority.

## Problem

The semantic counter-evidence readiness gate could accept an independently
labelled reference set, but the command line always paired it with the eight
checked-in synthetic fixtures, semantic snapshots, and manifest. It could not
evaluate the intended real 24–32 case study from the operator's library
without replacing repository files. Consequently, a valid real-world study
had no safe, reproducible way to enter the same aggregate gate.

## Selected Design

```text
four project-contained JSON inputs
  fixture document + semantic snapshots + binding manifest + independent labels
  -> size, type, containment, schema, and fingerprint checks
  -> in-memory semantic snapshot evaluation
  -> independently labelled aggregate readiness report
  -> ready_for_human_review only; never automatic routing
```

The new input responsibility is deliberately divided into small ESM modules:

- `scripts/lib/project-json-input.mjs` owns containment, canonical-path,
  regular-file, 128 KiB, and JSON loading rules.
- `scripts/lib/policy-candidate-semantic-counter-evidence-study-inputs.mjs`
  owns CLI option parsing and the all-or-nothing study-bundle requirement.
- `server/src/services/policyCandidateSemanticCounterEvidenceStudy.mjs` owns
  in-memory composition of snapshot evaluation and readiness evaluation.
- `scripts/run-policy-candidate-semantic-counter-evidence-readiness-evaluation.mjs`
  is now only the thin process boundary that loads inputs and prints the
  existing aggregate report.

The historical baseline remains available with no arguments, or with only
`--reference-set-file` when testing a label set that is bound to the checked-in
fixture fingerprint. Any external fixture, snapshot, or manifest option
switches to `project_redacted_study` mode and requires all four inputs. This
prevents silently evaluating a real case set against a checked-in snapshot or
applying labels to a mixed source.

```text
node scripts/run-policy-candidate-semantic-counter-evidence-readiness-evaluation.mjs \
  --fixture-file path/to/redacted-fixtures.json \
  --snapshot-file path/to/redacted-semantic-snapshots.json \
  --manifest-file path/to/redacted-semantic-snapshot.manifest.json \
  --reference-set-file path/to/independent-reference-labels.json
```

Every path must be a project-relative `.json` file that resolves inside the
checkout. The loader requires a regular file no larger than 128 KiB and never
prints the supplied path or document content. The existing contracts then
require exact SHA-256 binding among the fixture document, snapshot manifest,
and independently labelled reference set. A malformed or mismatched bundle
fails closed as `invalid_evaluation`; a partial external bundle fails before
evaluation.

The evaluation authority now accurately states
`validated_fixed_input_read_only`, rather than `committed_read_only`. It still
means fixed input only: the evaluator has no filesystem access itself and the
CLI does not retain or write the supplied records.

## Evidence Boundary

This command accepts a redacted **study**. It is not a library import, RAG
indexer, or live AI provider integration. The runner emits only the existing
aggregate artifact: profile thresholds, aggregate counts and metrics, bounded
validation summaries, content-address fingerprints, and false authority flags.
It never emits a fixture ID, title, description, library, provider, prompt,
response, embedding, candidate, reviewer, or individual reference label.

`ready_for_human_review` means the offline metric gate's conditions were met.
It is not a claim that the labels are independently produced, that a model is
safe for every library, or that a route may be automated. The fixed protocol
identifier remains an external operational attestation; study owners must
enforce reviewer separation and access controls outside Classifarr.

## Research Basis

The following official sources were reviewed on 2026-09-02 for the requested
August 2026 baseline:

- NIST AI RMF's Measure function calls for rigorous testing, performance
  assessment, benchmark comparison, documentation, test sets, and independent
  assessors. The complete bound bundle makes the measurement inputs and limits
  explicit before a human design review. [NIST AI RMF Core — Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  and [NIST AI RMF Playbook — Measure](https://airc.nist.gov/airmf-resources/playbook/measure/).
- OWASP LLM08 recommends fine-grained access and source validation for vector
  and embedding systems. Restricting this component to small project-contained
  JSON, exact fingerprints, strict schemas, and aggregate output avoids a new
  RAG/vector data channel. [OWASP LLM08:2025 Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/).
- W3C's WCAG-EM describes a useful evaluation discipline: define scope, select
  a representative sample, evaluate it, and report results. The 24–32 case
  cap and required strata are a bounded implementation of sample definition;
  the CLI documents rather than substitutes for the independent-review method.
  [W3C WCAG Evaluation Methodology 2.0](https://www.w3.org/TR/wcag-em-2/).

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the fixed eight-case CLI | Smallest implementation. | Cannot measure a real study through the gate. | Reject. |
| Add a live library/RAG export endpoint | Could collect rich examples automatically. | Expands API, privacy, retention, retrieval-injection, and authorization scope. | Reject. |
| Accept any combination of external and checked-in files | Flexible troubleshooting. | Enables silent mixed-provenance evaluation and weakens reproducibility. | Reject. |
| Accept one complete, bounded, fingerprint-bound project bundle | Makes a real study operational while preserving offline, aggregate-only authority. | Study owners must prepare and protect inputs. | Adopt. |

## Final Recommendation Stack

1. Construct a redacted, representative 24–32 case study covering
   broad-policy, documentary, genre-overlap, and reality strata.
2. Keep reviewer identities, access-control evidence, and any sensitive source
   material outside the checkout and outside Classifarr's aggregate output.
3. Run independent double-blind review, then create the content-free bound
   reference-label document.
4. Run this complete-bundle command and inspect the aggregate readiness report.
5. If it reaches `ready_for_human_review`, review a separate frozen
   candidate-scoped RAG/index/model proposal; do not promote the report into
   automatic routing.
