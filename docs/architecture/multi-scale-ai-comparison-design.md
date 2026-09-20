# Paired local AI context comparison

## Goal and scope

This document records protocol v1. The current CLI uses protocol v2, specified in
the [compact evidence design](compact-inventory-evidence-design.md); its raw control
and safety boundaries remain unchanged, but its second arm replaces appended
context with a bounded selection. Do not combine results across protocol versions.

Evaluate whether the additional context introduced in `dddd1597` changes local AI
choices usefully. Retrieval coverage alone did not establish semantic correctness.
This is a read-only, content-only ablation, not a replay of the full live policy
adjudication prompt and not permission to change routing thresholds.

## Frozen comparison protocol

- Reuse the deterministic 300-description movie/TV cohort and grouped folds.
  Remove every copy of each held-out description before fitting either broad or
  local groups. Conflicting descriptions for one stable identity are already
  excluded by the shared corpus reader.
- Retrieve across every same-media library. Select at most three candidates using
  only the strongest raw description match; never insert the observed destination.
  Report shortlist misses and empty/sparse candidates instead of hiding them.
- Compare raw examples against the same raw examples plus at most three additional
  representative examples per candidate. Reuse the live text projection and
  formatting, including its 600-code-point limit and duplicate removal.
- Use anonymous candidate numbers, not library names, rules, titles, genres,
  observed destination labels, or model-generated library summaries.
- Evaluate each arm in forward and reversed candidate order. Alternate which arm
  runs first. A stable choice requires both orders to select the same destination;
  abstention and order sensitivity remain separate measured results.
- Default to zero generation. Explicitly allow at most 100 generation cases and
  400 local calls, with fixed model digest, temperature, seed, context and output
  limits. The generation subset is selected before observing model responses.
- Require successful optional local discovery in every fold before inference.
  Live broad-context fallback remains safe, but a mixed fallback experiment is
  not a fully prepared multi-scale comparison. Report fixed failure categories
  and fitting time, not arbitrary exception messages; do not extend deadlines.
- Stop inference on the first invalid response, provider failure, cancellation or
  output/context-limit signal. Do not retry or reinterpret failed output as a
  valid abstention. Discard incomplete pairs from paired outcome counts.
- Recheck embedding identity and all source component digests after evaluation.
  Changed input invalidates the report. No database writes, provider fallback,
  model downloads, policy updates, or routing calls are available to this runner.

## Metrics and privacy

Report paired choice changes, stable choices, abstentions, order sensitivity,
observed-placement agreement gained/lost, tokens, latency, and failures. Include
movie/TV and anonymous library strata, plus sampled versus generated counts.
Placement agreement is **not accuracy**: independent labels remain zero and
accuracy remains null. A reused cohort is a diagnostic development set, not an
untouched final test set. Prompts, responses, item identifiers, individual hashes,
descriptions, vectors, and configured endpoints stay out of reports and progress.

## Research reviewed on 19 September 2026

- [Ollama structured outputs](https://ollama.com/blog/structured-outputs): constrain
  output with JSON schema and validate it; temperature zero improves consistency
  but does not establish semantic correctness or perfect reproducibility.
- [scikit-learn data leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html):
  split before fitting transformations. Apply that principle to both levels of
  content grouping, not just the final comparison.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  bound and delimit untrusted context, validate outputs, and keep downstream
  authority separate. Anonymous numbers are not a substitute for these controls.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  avoid unnecessary interruptions. This evaluation adds no settings, confirmation
  screen, or chatty live region; future visible status should be concise and
  programmatically available without moving focus.
- [Research on option-order sensitivity](https://aclanthology.org/2024.findings-naacl.130/):
  reordered choices can change model answers. This supports measuring order
  sensitivity separately from agreement; it does not establish the cause of any
  particular Classifarr result or guarantee that a published mitigation transfers.

## Options and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Coverage-only benchmark | Fast, deterministic evidence of retrieval safety | Cannot measure AI choices | Keep as a separate gate |
| Paired anonymous local AI comparison | Isolates context contribution without name shortcuts | Four calls per case; placement is imperfect evidence | Implement now |
| Full production policy replay | Measures interaction with policy and metadata | Confounds the context-only experiment | Follow after this result |
| Raise confidence or auto-route immediately | Fewer visible reviews | No demonstrated correctness improvement | Do not implement |

Recommended stack: existing read-only snapshot and fold planner, cached multi-scale
profile loader, live evidence projection, dedicated small comparison/metrics
modules, existing trusted-local generation client, and the existing benchmark CLI.
No new dependencies or user-facing controls are needed.

## Verification plan

Test source leakage, candidate scope, raw preservation, duplicate removal, anonymous
prompts, strict output parsing, both orders, balanced call order, partial failures,
cancellation, budgets, privacy, and CLI source invalidation. Run the actual local
Compose benchmark, record aggregate results separately, then run regression gates.
