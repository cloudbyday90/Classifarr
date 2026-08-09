# Policy Candidate Evidence Calibration

Status: implemented for the next release line.

## Problem

Policy scoring had two separate safety mechanisms:

- candidate diagnostics could mark evidence as weak,
- final action selection could downgrade weak top candidates to manual or selection flows.

The missing step was ranking calibration. Before this change, a weak candidate with a high raw score could still sort above a stronger candidate. That meant broad compatibility evidence such as generic `Comedy`, profile-only affinity, or RAG-only similarity could shape the primary question even when stronger identity or multi-source evidence existed below it.

The goal is to keep weak evidence visible while reducing its ranking authority before the final decision is made.

## Official Source Research

Research date: June 12, 2026.

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) frames trustworthy AI around validity, reliability, safety, accountability, transparency, explainability, and interpretability. Classifarr should therefore separate raw scores from calibrated decision authority and make the adjustment inspectable.
- [NIST AI RMF 1.0 PDF](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf) describes trustworthy systems as valid, reliable, safe, secure, accountable, transparent, explainable, interpretable, privacy-enhanced, and bias-managed. Bounded calibration diagnostics support transparent and repeatable classification behavior.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) recommends reviewing outputs for validity and safety and monitoring system outputs and performance. Classifarr should not treat AI/RAG-derived confidence as sufficient decision authority without deterministic corroboration.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) identifies overreliance and excessive agency as LLM application risks. Calibration limits how much weak model-adjacent evidence can influence routing.
- [Open Policy Agent documentation](https://openpolicyagent.org/docs) describes policy decisions as structured outputs, not only allow/deny booleans. Classifarr follows that pattern by storing raw score, calibrated score, reason code, multiplier, and cap.

## Recommendations

### 1. Calibrate Before Ranking

Apply evidence quality calibration before sorting candidates. Do not wait until after a weak candidate has already become the top result.

Pros:

- Stronger evidence can outrank weak but high raw scores.
- Broad compatibility signals remain visible but lose primary authority.
- The final question anchor becomes more defensible.

Cons:

- Historical raw confidence values may no longer match final ranking order.

### 2. Preserve Raw Score

Keep `raw_score` and persist a bounded `score_calibration` object in candidate diagnostics.

Pros:

- Operators can see exactly how the candidate changed.
- Future replay tooling can compare old and new calibration rules.
- Calibration is explainable without exposing prompts or raw provider payloads.

Cons:

- Adds a small amount of diagnostic metadata per candidate.

### 3. Use Conservative Multipliers and Caps

Apply deterministic caps to weak evidence classes:

- compatibility-only: multiplier `0.60`, cap `55`,
- profile-only: multiplier `0.65`, cap `60`,
- RAG-only: multiplier `0.70`, cap `60`,
- negative conflict: multiplier `0`, cap `0` for a failed strict policy constraint or a profile-only conflict with no declared identity evidence.

Pros:

- Prevents generic compatibility from reaching auto or confirm bands.
- Keeps weak candidates eligible for manual selection when useful.
- Blocks conflicted candidates from ranked results.

Cons:

- Sparse libraries may need manual correction or stronger presets before they rank highly.

### 4. Keep Strong Evidence Unchanged

Do not calibrate identity or multi-source candidates unless they have a negative conflict. An observed library-profile absence remains diagnostic when it differs from an active declared native identity rule; it is not a policy veto.

Pros:

- Avoids penalizing well-supported policies.
- Keeps existing successful classifications stable.
- Makes the rule easy to reason about.

Cons:

- Strong but wrong identity presets still need separate policy authoring review.

## Final Stack

- Added `policyCandidateCalibration.mjs` as a pure ES module.
- Calibrated candidate scores before threshold normalization and rank sorting.
- Preserved raw score as `raw_score`.
- Added `candidate_diagnostics.score_calibration` with bounded fields:
  `schema_version`, `applied`, `raw_score`, `calibrated_score`, `multiplier`, `cap`, and `reason_code`.
- Filtered negative-conflict candidates after calibration.
- Added direct calibration tests and ranker integration tests.

## Implemented Outcome

An `identity_evidence` candidate with score `70` now outranks a `compatibility_only` candidate with raw score `92`, because the compatibility candidate calibrates to `55`.

A profile-only or RAG-only candidate can still appear in manual review, but it no longer reaches confirm or auto authority purely through a high raw score.

A negative-conflict candidate calibrates to `0` and is removed from ranked results. Profile absence can still suppress a profile-only or RAG-only candidate, but cannot erase an active declared native identity match.

## Security and Privacy Boundaries

- Calibration uses only existing bounded candidate diagnostics and numeric scores.
- No prompts, full overviews, API keys, headers, embeddings, or provider responses are stored.
- Calibration is deterministic and local; it does not invoke AI providers.
- Raw scores are preserved for explainability but not used as final ranking authority once calibration applies.

## Validation

Focused validation:

```bash
npm --prefix server run test:unit -- --testPathPatterns="policyCandidateCalibration|policyCandidateRanker|policyCandidateDiagnostics|policyEngine.presetSemantics" --runInBand --no-coverage
```

## Follow-Up Design Items

1. Calibration metrics and drift report

   Intent: track how often calibration changes the top candidate and which evidence classes are most affected.

   Platform improvement: makes tuning measurable instead of subjective.

2. Policy replay harness

   Intent: replay historical classification incidents against current deterministic scoring, constraint, profile, and RAG logic without AI calls.

   Platform improvement: validates that calibration improves known incidents without creating regressions.

3. Candidate evidence UI

   Intent: expose raw score, calibrated score, evidence class, suppression reasons, and calibration reason in History details.

   Platform improvement: lets users understand why a candidate moved up or down without inspecting PostgreSQL.
