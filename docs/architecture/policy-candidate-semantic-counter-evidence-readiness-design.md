# Policy Candidate Semantic Counter-Evidence Readiness Design

## Status

Implemented as an offline-only evaluation gate on 2026-09-01. It does not
change classification, policy scoring, candidate ranking, AI invocation, or
routing.

## Problem

The current-library semantic retriever can supply bounded advisory context for
a policy-owned `prompt_select` candidate set. The reported failures show the
next problem: a broad declared policy can produce a plausible `prompt_confirm`
candidate even where the media identity or synopsis appears inconsistent with
the destination. A disaster documentary appearing under a comedy-oriented
destination is the motivating class of error.

It would be unsafe to make semantic retrieval silently demote that candidate.
Current evaluation evidence is a small, synthetic, redacted snapshot; it is
not representative of broad-policy/documentary/reality/genre-overlap cases.

## Research Basis

- NIST's AI RMF Measure guidance calls for documented test sets, metrics, and
  tools, and warns that non-representative data can produce inaccurate or
  harmful assessments. The gate makes the corpus coverage and measurement
  limits machine-readable before a semantic signal could influence a workflow:
  [NIST AI RMF Playbook — Measure](https://airc.nist.gov/airmf-resources/playbook/measure/).
- OWASP identifies poisoning, cross-context leakage, and unauthorized access
  as RAG/vector risks. This design accepts only pinned, committed redacted
  artifacts and returns aggregate counts and metrics—never current catalog
  text, vectors, prompts, providers, or model output:
  [OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/).
- W3C's Authoring Practices emphasize semantic, keyboard-operable disclosure
  patterns. This is a CLI/report-only control, so it adds no product UI; a
  later operator view must retain the existing concise summary plus optional
  disclosure rather than expose an always-expanded diagnostic card:
  [WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).

The numerical guardrails below are Classifarr's conservative provisional
release-review criteria, not thresholds prescribed by those sources.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Let semantic retrieval demote `prompt_confirm` now | Fastest apparent response to a known bad candidate. | Small synthetic evidence set has false positives and misses review cases; would make probabilistic evidence policy authority. | Reject. |
| Add more always-visible evidence cards | Gives every technical fact to an operator. | Repeats the busy, hard-to-interpret UI problem and still does not establish reliability. | Reject. |
| Add an offline, pinned readiness gate | Reproducible, measurable, fail-closed, and no live-media exposure. | Does not improve a classification until a larger labelled corpus is built. | Adopt. |
| Send all library descriptions to a model for every decision | May increase apparent context. | Broadens data exposure, cost, prompt-injection surface, and nondeterministic authority. | Reject. |

## Selected Architecture

```text
committed fixture document + committed semantic snapshot + manifest
  -> existing status-only semantic snapshot evaluator
  -> fingerprint and authority revalidation
  -> fixed counter-evidence readiness profile
       24 fixtures, 8 review references,
       4 cases in each required stratum,
       zero false positives, >=95% precision, >=90% recall
  -> aggregate readiness report
       not_ready | ready_for_human_review | invalid_evaluation
  -> future human design review only
```

`policyCandidateSemanticCounterEvidenceReadinessContract.mjs` owns the fixed
profile, status vocabulary, blockers, and inert authority. The evaluator owns
source binding, metric recomputation, stratum counts, and status derivation.
The command loads only three repository-owned JSON files at fixed paths and
emits JSON. `not_ready` is a successful evaluation result; malformed or
unbound artifacts exit non-zero as `invalid_evaluation`.

The gate recomputes its semantic review metric from the status-only rows rather
than trusting a caller-supplied metric. It validates that every report row
matches a reviewed fixture and that the snapshot report's content address
matches the exact fixture document.

## Required Corpus Strata

The first target corpus must contain at least four human-reviewed cases in
each of these overlapping strata:

- `broad-policy` — broad destination rules that can make a title look
  superficially eligible;
- `documentary` — factual/non-fiction material;
- `reality` — factual or unscripted series material; and
- `genre-overlap` — titles likely to match several collection vocabularies.

It must contain at least 24 cases overall and eight cases whose correct
outcome is a human review. The current committed snapshot is intentionally
well below this bar. Labels must be independent review decisions, not a
rephrasing of the policy outcome or model response.

## Security and Authority Boundaries

- The profile is server-owned constant vocabulary; CLI callers cannot loosen
  thresholds, choose files, or select a data source.
- Fixture/snapshot binding uses the existing stable SHA-256 content address.
  A malformed, altered, or unbound artifact returns `invalid_evaluation`.
- The report returns aggregate metrics, tag counts, fixed blockers, and a
  content fingerprint only. It omits fixture names, item IDs, library names,
  descriptions, vectors, similarity values, prompts, provider/model details,
  and model responses.
- All automatic actions remain false. Even `ready_for_human_review` grants no
  policy-change or automatic-routing eligibility.
- This design does not add an HTTP route, persistence, migration, provider
  call, database query, background job, retry, or client polling path.

## Final Recommendation Stack

1. Keep current bounded semantic evidence advisory and operator-confirmed.
2. Use this gate to collect and test a redacted, independently labelled corpus
   before proposing a policy-path change.
3. Require a human design/security review even if the corpus reaches
   `ready_for_human_review`.
4. Only then consider a separate, bounded transition from broad
   `prompt_confirm` to candidate comparison; never automatic routing.
5. If an operator surface is later needed, use one short status and native
   disclosure for details, preserving the current UI's low-noise default.
