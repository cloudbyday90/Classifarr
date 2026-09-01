# Future Corpus Calibration Report Design

## Outcome sought

The automatic future-corpus evaluator proves only whether each fixed
score-margin band has a basic redacted baseline. The next useful capability is
to identify an **aggregate outcome pattern** that deserves policy or semantic
retrieval review, without treating a policy score as probability and without
letting a report change live behavior.

The calibration report answers two questions:

1. Does an individual score-margin band have enough operator outcomes to make
   a bounded outcome-change signal meaningful?
2. If it does, should an administrator inspect close-candidate boundaries or
   higher-margin policy/retrieval evidence?

It does not expose capture rows, use titles or descriptions, call AI, run RAG,
change thresholds, update policies, learn, retry, or route media.

## Evidence and standards reviewed

- The [NIST AI RMF Measure function](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for regular operational measurement, uncertainty-aware performance
  assessment, documented reporting, and human oversight. The report therefore
  uses a fixed Wilson interval, fixed categories, and review prompts rather
  than automatic tuning.
- [W3C's data-table guidance](https://www.w3.org/WAI/tutorials/tables/) calls
  for semantic headers and data cells. Its [caption and summary guidance](https://www.w3.org/WAI/tutorials/tables/caption-summary/)
  supports a concise description that explains the relationship among the
  aggregate columns. The detailed score-band rows therefore live in one
  collapsed semantic table, while the current result remains a short status.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires information and
  relationships to be programmatically determinable. The report does not rely
  on colour alone: every band has textual outcome and review-signal labels.
- The [OWASP guidance on vector and embedding weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  reinforces the minimization boundary: report input remains fixed counts,
  never descriptions, embeddings, prompts, provider data, or retrieval text.

## Design

### Source and authority boundary

```text
redacted future captures
  -> existing current-revision aggregate evaluator
  -> fixed count-only calibration report
  -> administrator-only, no-store Settings status and optional table
  -> human review of policy/RAG evidence outside this report
```

The calibration service depends on the existing capture-evaluation service;
it does not open a second database query or persistence path. Its endpoint
accepts no filter, actor, time-window, or record selector. It is administrator
only, rate limited, and returns `Cache-Control: no-store`.

The read model declares that AI invocation, learning, policy change, RAG
tuning, retry, and routing are all false. The client independently verifies
that declaration and drops unknown fields before rendering.

### Fixed method

The report is unavailable until the existing baseline reaches six active
outcomes in each of four score-margin bands (24 total). It then reports the
following aggregate fields per band:

- retained outcome count;
- confirmed selected-candidate count and rate;
- count of operator changes to or away from the selected candidate; and
- a fixed 95% Wilson interval for that change rate.

An individual band requires 20 outcomes before it can emit a precise review
prompt. A review prompt appears only when the lower bound of its 95% Wilson
interval is at least the fixed 20% operator-change review floor. This avoids
presenting a sparse observed correction rate as a precise calibration finding.

| Prompt | Condition | Human follow-up |
| --- | --- | --- |
| `review_close_candidate_boundaries` | A `0–4` or `5–14` point band meets the fixed review signal | Inspect destination competition, declared policy boundaries, and semantic retrieval ranking for close candidates. |
| `review_high_margin_candidate_evidence` | A `15–29` or `30+` point band meets the fixed review signal | Inspect policy specificity and semantic retrieval evidence for higher-separation candidates. |
| `review_mixed_score_band_evidence` | Both groups meet the fixed review signal | Review the policy and retrieval evidence together before proposing any change. |
| `continue_observing` | No band meets the fixed review signal | Continue automatic capture; a baseline is not a correctness guarantee. |

No report result is a routing instruction. The prompts name *where to inspect*
deterministic policy and semantic evidence, not what to change.

### Accessible, low-noise presentation

The ordinary view adds one short automatic status only after the baseline is
available. The detailed table is collapsed by default. It has a caption,
column/row headers, and text labels for every interval and signal. Refresh
continues every five minutes while Settings is open, with no manual refresh,
test, approval, or acknowledgement action.

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| Automatic threshold or RAG tuning | Fast feedback loop | Creates circular evaluation and could misroute media from sparse evidence. |
| Return captures or item descriptions | Rich investigation context | Violates the existing minimization boundary and expands re-identification risk. |
| One global correction rate | Simple and early signal | Hides whether close or high-margin candidates are the source of a pattern. |
| Fixed per-band Wilson review report | Interpretable, uncertainty-aware, privacy-bounded, and actionable for human review | Needs 20 outcomes in a band before a precise prompt can appear. |

## Final recommendation stack

1. Keep automatic future capture and its 24-row coverage baseline hands-off.
2. Use the new report to flag only statistically bounded score-band patterns
   for administrator review; do not automate threshold, policy, AI, or RAG
   changes.
3. When a prompt appears, inspect the existing policy evidence and
   candidate-scoped library retrieval separately, then use the established
   native policy proposal workflow for any change.
4. Treat a no-signal result as monitoring evidence, not as correctness proof.
5. Keep raw items, descriptions, embeddings, prompts, and provider output out
   of this report; introduce them only through a separately approved semantic
   adjudication evaluation.
