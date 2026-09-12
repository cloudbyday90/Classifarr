# Inferred-purpose candidate admission

## Goal and observed cause

The preceding library-match calibration replay exposed an upstream recall failure:
an existing destination was absent before description retrieval or AI comparison.
Its stored top genres came from library observations, but the native evaluator
treated a non-match as a failed purpose requirement. A second positive-score
filter could discard the same destination even after that first veto was removed.

This component separates admission from ranking. Library names remain labels,
not routing rules. No policy rows, thresholds, provider settings or media are
changed by the implementation or its read-only benchmark.

## Recommendations and tradeoffs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep inferred genres as admission requirements | Small candidate pool | Incomplete metadata permanently hides relevant libraries from RAG | Reject |
| Admit every destination regardless of policy | Maximum pool size | Violates explicit restrictions and media boundaries | Reject |
| Distinguish server-provenanced observations from requirements | Lets descriptions compare eligible libraries without inventing confidence | More retrieval work and potentially more reviewable candidates | Implement |

## Implementation contract

1. Retain native-authority validation, known movie/TV scope, hard limits and
   unknown-hard-limit rejection before supporting evidence is read.
2. Recognize only the currently generated profile-purpose shape: inferred,
   advisory `require_any` genre/media-type rules with
   `media_server_library_profile` provenance. Unknown or declared provenance,
   strict rules and other shapes retain the required-purpose path.
3. In mixed contracts, evaluate the required subset independently. A matching
   observed genre cannot compensate for an unmatched declared purpose.
4. Keep observed purpose scores useful to ranking. An unmatched observation
   contributes zero, not a fabricated minimum score. Helpful hints alone do not
   establish a purpose score. Media-type mismatches remain excluded.
5. Preserve admitted zero-score observations through filtering and ranking so
   full-pool description retrieval and the existing bounded AI shortlist can
   inspect them. Do not preserve failed constraints or negative-conflict rows.
6. Observed profile absence remains advisory for these admitted candidates;
   explicit policy hard limits still take precedence. Admission alone creates
   no routing receipt, confidence boost, learning label or automatic route.

Use a small pure ESM admission module and existing evaluator, diagnostics,
retrieval and ranking seams. Keep the existing full-pool cap of 64 and provider
shortlist cap of three. No new settings, acknowledgements or UI panels.

## Research and security

Research retrieved on 12 September 2026, targeting established practices
applicable by August 2026. Versioned scikit-learn 1.5 guidance predates that
cutoff. Mutable Microsoft, OWASP and W3C pages are current retrievals, not
claimed archived August snapshots.

- Filters determine the documents available to vector search. Our application
  inference is that an unreliable observed genre must not define that scope;
  actual authorization and media restrictions still must. This is not a switch
  to Azure or a claim that Classifarr uses its HNSW filtering implementation.
  [Microsoft vector-query filtering](https://learn.microsoft.com/en-us/azure/search/vector-search-filters)
- Reuse the existing grouped held-out protocol: exclude test items and duplicate
  descriptions from training, and do not tune admission to observed benchmark
  outcomes. [scikit-learn data leakage guidance](https://scikit-learn.org/1.5/common_pitfalls.html)
- Treat descriptions and library metadata as untrusted data, never instructions
  or policy authority. Keep bounded provider inputs, validated output and
  server-owned candidate membership. No prompt content or library inventory
  belongs in public reports.
  [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- Do not add more visible diagnostics to solve an admission bug. Any later
  automatic status refresh should announce meaningful changes without moving
  keyboard focus, following
  [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

## Final recommendation stack and acceptance

Validated explicit boundaries → profile observations for ranking → full eligible
description comparison → bounded local AI proposal → existing routing validation.

Synthetic tests must cover missing/non-top genres, renamed libraries, movie/TV
boundaries, explicit/mixed/strict/unknown rules, failed authority and hard limits,
zero-score retention, no-evidence fallback and unchanged routing gates. Then
repeat the same 300-item local cohort; report candidate coverage and disagreements
separately from accuracy. Implementation and measured results belong in the
separate outcome document.
