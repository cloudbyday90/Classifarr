# Independent inventory content-fit design

Date: 2026-09-19

## Decision

Assess one anonymous library's retrieved descriptions at a time, then select with
a deterministic rule. This is a read-only experiment, not a routing change. The
[previous compact-evidence result](compact-inventory-evidence-outcome.md) reduced
payload size but left 32 of 100 cases sensitive to candidate order, versus 25 in
the raw control. Another prompt-size adjustment is not the next experiment.

Add `--independent-fit` as an explicit modifier of `--multi-scale-ai`. Preserve the
existing compact experiment and its protocol. The new protocol is
`inventory_independent_fit_v1`; it reuses sample selection, grouped holdouts,
source verification, memory admission, fitting and the unchanged raw control.

## Fixed experimental contract

The independent arm uses the same raw examples and top-three shortlist as the
control, not compact examples. Each request contains only the media type, query
synopsis and up to three example synopses from one candidate. No library names,
IDs, option numbers, placement labels, cosine scores or inventory counts are
sent. Existing placements are observations, not verified definitions.

Each response is exactly `{"fit":N}` with integer N from 0 through 3:

- 0: incompatible or insufficient evidence.
- 1: broad overlap only.
- 2: supported recurring subject, format and treatment.
- 3: strong, consistent content fit.

These ordinal judgments are neither probabilities nor independently verified
facts. Select only a unique highest grade of at least 2; ties and weak evidence
abstain. Do not break ties by IDs, similarity, example count or existing placement.
Empty candidates receive grade 0 without inference. Invalid output fails the case
and stops the experiment; it is not converted into a valid abstention.

The preceding recommendation also proposed structured support/contradiction
evidence. This first experiment deliberately validates only the smaller ordinal
wire contract: it tests assessment isolation without treating generated rationale
as verified evidence. It does not implement evidence-grounded explanations, and
schema validity must not be reported as semantic correctness.

Run two independent passes, reversing candidate processing and example order.
Both passes actually call the model; do not reuse cached grades to manufacture
stability. Counterbalance arm and pass timing across cases. Report both changed
candidate grades and changed final decisions. The independent arm's disagreement
measures repeat/example-order sensitivity, not simultaneous option-order bias.
Identical final decisions can still hide grade changes, hence both measurements.

At most eight generation requests per case: two raw selections plus two passes
over at most three separate candidates. Limit generation to 100 cases / 800 calls,
64 output tokens per request, the existing complete-prompt byte estimate, 64 MiB
retained packets and the existing operation deadline. Preflight all folds before
inference; no hidden retries or parameter tuning on this cohort.

## Research and alternatives

Official documentation and original research were discovered through web tools
and opened on 2026-09-19:

- [Large Language Models are not Fair Evaluators](https://aclanthology.org/2024.acl-long.511/)
  documents position bias in its own comparative evaluation task. This motivates
  measuring ordering effects; it does not prove pointwise grading solves ours.
- [Batched Self-Consistency Improves LLM Relevance Assessment and Ranking](https://aclanthology.org/2025.emnlp-main.1661.pdf)
  compares separate and batched assessments. Its batched approach improves cost
  and quality in its own tasks; separate assessment loses helpful comparative
  context and costs more calls. We test isolation specifically because of our
  measured ordering problem, not because research guarantees it is superior.
- [Ollama structured outputs](https://github.com/ollama/ollama/blob/main/docs/capabilities/structured-outputs.mdx)
  supports schema-constrained responses and application-side validation. Retain
  the local-only installed-model checks and exact bounded parser as well.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports treating retrieved text as untrusted and validating output. No returned
  grade can execute tools, mutate policy or authorize a route.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Simultaneous raw choice | Cheapest preserved control | Candidate-order sensitivity observed | Keep as baseline |
| Compact evidence choice | Bounded diversity, no extra calls | Previous run did not improve stability | Preserve, do not promote |
| Independent content-fit grades | Removes other options from each assessment; fixed aggregation | More calls; cross-request grading calibration, ties and example-order effects remain | Implement and measure |
| Automatically adopt highest model grade | Less operator work immediately | No verified accuracy or calibrated confidence | Do not enable from this experiment |

## Safety, UI and recommendation stack

1. Preserve source/model identity checks, exclusive holdouts, all-row validation,
   read-only snapshots, cancellation, admission and privacy-safe aggregate logs.
2. Compare independent grading with the unchanged control on the frozen cohort.
3. Evaluate selection coverage, abstention, repeat sensitivity and cost together.
   Observed-placement agreement is diagnostic only; independent labels remain 0
   and routing accuracy unknown.
4. Validate generalization on untouched cases before any live adoption. Avoid
   repeated tuning until this exploratory cohort produces a favorable result.

There is no new UI, acknowledgement, setting or API. W3C's
[status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
supports non-focus-stealing accessible feedback if future background progress is
shown. It does not require more operator confirmations or a dense score panel.

Implementation, validation and measured limitations belong in the separate
[outcome document](independent-inventory-fit-outcome.md).
