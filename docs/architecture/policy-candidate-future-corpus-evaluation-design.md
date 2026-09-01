# Future Redacted Reviewed-Corpus Evaluation Design

## Outcome sought

Classifarr now captures eligible future operator outcomes automatically, but
the existing offline report is intentionally limited to an administrator-created
historical snapshot. The two data sources must not be silently mixed. This
design adds a separate, aggregate-only evaluator for the future capture table.

It answers one bounded question: *does the current, redacted, automatic corpus
cover each deterministic score-margin band well enough to begin a separately
approved evaluation of a future policy, retrieval, or model proposal?*

It does not call a provider, read an item, retrieve from RAG, score a proposal,
change a policy, learn from an outcome, retry a job, or route media. A policy
score remains deterministic evidence-safety calibration, not model confidence.

## Evidence and standards reviewed

- NIST's AI RMF Measure function calls for documented, repeatable TEVV with
  deployment-relevant and representative test data, as well as monitoring in
  operation. The evaluator therefore has a fixed versioned contract, fixed
  score-band coverage, and no live decision authority. [NIST AI RMF
  Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- NIST's Generative AI Profile applies lifecycle risk management to the
  organization’s own use case and risk tolerance. Here, a ready baseline only
  admits a human design review; it never promotes a model or retrieval change.
  [NIST AI RMF Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
- OWASP warns that RAG/vector systems can leak data or cross contexts when
  permissions and data boundaries are weak. The database query therefore emits
  only grouped margin/outcome counts and does not expose capture IDs, actors,
  timestamps, evidence JSON, media, libraries, prompts, provider data, or
  embeddings. [OWASP LLM08: Vector and Embedding
  Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- The Settings status uses a polite, atomic status message so background
  refreshes are announced without stealing focus; it provides a short current
  state instead of another evidence dashboard. [W3C ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
  and [W3C Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)

## Design

### Separate source boundary

The evaluator reads only active, future-captured rows that match the current
automatic-capture revision. Capture starts with a server-owned, content-free
30-day retention default; it does **not** wait for an acknowledgement. An
administrator may later acknowledge an optional retention choice (7–90 days),
which starts a new comparable revision and enables the separately gated
historical-snapshot workflow. Historical `classification_history`, the
redacted historical projection, and all live classification/RAG tables are
outside the evaluator query boundary.

```text
automatic future redacted capture
  -> safe-default or optional-retention revision
  -> SQL groups only (score-margin band, operator outcome) counts
  -> fixed aggregate readiness read model
  -> compact administrator-only status, refreshed every five minutes
  -> separate human-approved proposal-evaluation design
```

Changing the capture retention setting changes its hashed revision. The report
then begins a new baseline rather than implying comparability across retention
configurations.

### Aggregate contract

The read model has two states:

| State | Meaning | Authority |
| --- | --- | --- |
| `collecting` | At least one margin band has fewer than six active outcome rows. | None |
| `ready_for_human_evaluation` | Each of the four score-margin bands has at least six active outcome rows. | Starts only a human design review |

The baseline is 24 rows: six for each of `0–4`, `5–14`, `15–29`, and `30+`
score-margin bands. The report returns total per-band counts and fixed operator
outcome-category counts. It deliberately does not use the results as a
confidence score, a promotion threshold, or a model/RAG evaluation result.

The route is administrator-only, rate-limited, and `Cache-Control: no-store`.
Its query uses parameterized values and only aggregate columns. An index scoped
to the current revision and active expiry window supports the read without
adding a data-bearing field.

### Hands-off accessible status

Security Settings reads the status on page load. While data is collecting, it
refreshes every five minutes in a `role="status"` / `aria-live="polite"` /
`aria-atomic="true"` region. There is no “refresh”, “test”, or “approve”
button. Optional retention and historical-snapshot controls are kept in a
collapsed disclosure so they do not look like a prerequisite for Classifarr.

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| Reuse the historical snapshot report | Reuses existing UI and math | Mixes intentionally separate historical and future sources; would misstate provenance |
| Return captured rows to the browser | Rich operator analysis | Violates minimization and increases re-identification/exposure risk |
| Run model/RAG proposals during capture | Fast feedback | Circular evaluation, provider exposure, and route-safety risk |
| Aggregate future captures by current revision | Privacy-bounded, repeatable, automatic, configuration-comparable | Establishes baseline readiness only; cannot evaluate semantic quality on its own |

## Final recommendation stack

1. Start automatic future capture with the server-owned 30-day, content-free,
   retention-bounded default; make an acknowledgement necessary only for an
   optional retention override and the separate historical-snapshot workflow.
2. Use the new aggregate evaluator only to prove basic score-band coverage for
   an explicitly separate, human-approved proposal evaluation.
3. Keep the compact automatic status in Settings; expose no capture rows or
   manual refresh control.
4. Require a separate semantic-adjudication design before title, description,
   library inventory, retrieval text, embeddings, or model outputs can be used
   to evaluate a RAG/AI proposal.
5. Keep deterministic policy and routing safeguards authoritative until a
   proposed change passes that later evaluation and an operator approves it.

## Non-goals

- This is not a model or RAG benchmark.
- This is not a semantic corpus and does not contain media descriptions.
- This does not change policy score, candidate selection, thresholds, or
  routing.
- This is not automatic learning, fine-tuning, or policy maintenance.
