# Focused library fallback evaluation: design

Date: 2026-09-13

## Objective and scope

Complete the AI comparison recommended by the
[refreshed inventory readiness check](refreshed-inventory-benchmark-readiness-outcome.md):
test difficult library matches against current descriptions and learned metadata,
not library-name rules. Reuse the existing 300-item, five-fold movie/TV benchmark
and local provider. Do not add another user acknowledgement or settings panel.

The experiment compares the strict and selective fallback assessments of the
**same AI proposal**. It is not a comparison of two separately prompted models.
Cases are selected from the frozen snapshot before inference, without using
placement agreement to choose them. The held-out item and synopsis copies remain
excluded from learning. Placement labels are useful for investigating differences,
but are not independently verified destinations or measured accuracy.

## Implementation decision

Retain the existing inference, retrieval, calibration and routing algorithms.
Extend the small ESM `inventoryNeighborFallbackReport.mjs` service to report:

- The number of generated strict-control cases, separately from the number of
  items with strict neighbor support. Zero controls means strict regressions
  were not measured, even when the loss counter is zero.
- Familiarity rejections as fixed `unusual`, `sparse`, `degenerate` or `unavailable`
  counts. Their sum equals additional fallback resolutions minus the resolutions
  that pass familiarity. Scarce evidence must not be presented as a wrong match.
- Preserved and lost strict results when a caller supplies strict controls.
  The focused benchmark's selection and inference budget remain unchanged.

These are additive CLI-report fields, not a REST contract or new UI. Arbitrary
status text, titles, library identifiers, provider addresses and model prose
must not appear in the new fields. No dependency, migration or singleton is needed.

## Official research and application

Sources were found through online search/MCP and read on 13 September 2026.

| Source | Application |
| --- | --- |
| [scikit-learn data-leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html) | Preserve fold-local learning and exclude query copies; do not tune on the held-out answers. |
| [scikit-learn calibration reference](https://scikit-learn.org/stable/modules/generated/sklearn.calibration.CalibratedClassifierCV) | Keep training/calibration separation; empirical library support is not automatically a calibrated probability. No Python dependency is introduced. |
| [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs) | Reuse bounded schema-driven responses, deterministic validation and temperature zero. Valid JSON does not establish a correct destination. |
| [OWASP prompt-injection guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | Treat retrieved text and model output as untrusted; keep provider responses separate from routing authority. RAG does not eliminate injection risk. |
| [W3C status-message guidance](https://www.w3.org/TR/wcag/) and [automatic-update guidance](https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html) | No new dashboard detail in this component. Future summaries should announce meaningful status changes without taking focus and retain control over automatic updates. |

These sources guide the engineering method; they do not validate this model's
classification accuracy. No new WCAG conformance claim is made.

## Security and reproducibility

Use the configured installed local Ollama model only, pinned model digests,
read-only PostgreSQL defaults, private logging disabled, bounded context/output,
sequential inference and before/after snapshot verification. Keep the existing
identity, metadata, familiarity and live authorization checks. No cloud provider
fallback, model download, policy write, learning label or routing receipt is
created. Private intermediate reports stay in ignored `.tmp/`.

## Options and recommendation stack

| Option | Benefit | Limitation / decision |
| --- | --- | --- |
| Strict-only matching | No new routing behavior | Leaves these overlap cases unresolved; retain as the baseline. |
| Selective learned fallback in evaluation/shadow | Tests organic library understanding using existing metadata and examples | Promising candidates still need fresh live qualification; recommended. |
| Lower thresholds or ignore metadata disagreement | Produces more apparent resolutions | Can admit wrong destinations and confound the experiment; rejected. |
| Retrain or add another provider immediately | May increase model capacity | Not justified before identifying whether disagreement comes from retrieval or learned metadata; deferred. |

Recommended stack: existing PostgreSQL/pgvector, pinned local embeddings,
fold-local library profiles, strict matching first, calibrated fallback evaluation
second, existing local AI comparison and fresh server-side routing checks last.
Keep the existing SWR-based summary unchanged.

Verify report accounting, redaction, missing evidence, strict controls and the
production comparison path with synthetic tests. Record local inference results,
remaining causes and the next component in the separate
[outcome](focused-library-fallback-evaluation-outcome.md).
