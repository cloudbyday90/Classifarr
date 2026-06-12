# Policy Constraint Semantics

Status: implemented for the next release line.

## Problem

Classifarr policies historically mixed two different ideas inside the same preset signal:

- scoring evidence: a signal boosts or lowers confidence,
- runtime constraints: a signal makes a destination incompatible.

That ambiguity is risky for broad libraries. A generic signal such as `Comedy` should help a comedy-related candidate, but it should not become deterministic proof of a specialized destination. Conversely, explicit constraints such as a strict family-safe rating boundary should block a candidate instead of merely reducing confidence.

The design goal is to keep policies advisory by default while giving operators an explicit, auditable way to declare hard compatibility constraints.

## Official Source Research

Research date: June 12, 2026.

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) recommends managing AI risks through validity, reliability, accountability, transparency, explainability, and secure operation. For Classifarr, deterministic constraints should be separated from probabilistic scoring so high-risk incompatibilities are explainable and repeatable.
- [NIST AI RMF 1.0 PDF](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf) describes trustworthy AI characteristics such as valid, reliable, safe, secure, accountable, transparent, explainable, and interpretable. Policy constraint diagnostics directly support these properties for automated classification.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) identifies risks around prompt injection, insecure output handling, training data poisoning, excessive agency, and overreliance. Classifarr should not let model or retrieval outputs override deterministic compatibility gates.
- [Open Policy Agent documentation](https://openpolicyagent.org/docs) describes offloading policy decision-making into a policy engine using structured data. Classifarr keeps this principle locally by evaluating explicit policy constraints outside weighted confidence scoring.
- [PostgreSQL JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) documents JSONB support for structured configuration storage. Current policy signal JSON can carry explicit `strict`, `constraint`, `constraint_mode`, `runtime`, or `runtime_mode` semantics without a schema migration.
- [PostgreSQL Check Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) documents database-level boolean constraints. For this feature, runtime policy constraints remain application-level because they depend on media metadata and user policy JSON, not a single table row invariant.

## Recommendations

### 1. Keep Default Policy Signals Advisory

Signals should continue to score confidence unless an operator explicitly marks them as strict.

Pros:

- Avoids changing existing user policy behavior unexpectedly.
- Keeps broad genre signals useful as confidence contributors.
- Preserves current presets that are intentionally fuzzy.

Cons:

- Users must opt in when they want deterministic blocking behavior.

### 2. Add Explicit Strict Runtime Constraint Semantics

Support strict intent through existing `strict: true` and forward-compatible aliases: `constraint`, `constraint_mode`, `runtime`, or `runtime_mode` set to `strict`, `hard`, `required`, `exclude`, or `block`.

Pros:

- Preserves existing language strict behavior.
- Gives future UI/API work a clear vocabulary.
- Avoids database migration churn because signals are already JSONB.

Cons:

- The UI still needs a dedicated editor affordance so users do not hand-edit JSON.

### 3. Evaluate Constraints Separately From Score Math

Strict constraints should produce a bounded report with pass, fail, unknown, and not-applicable outcomes. Failures suppress candidates from ranking; unknown metadata does not hard-block.

Pros:

- Prevents deterministic incompatibilities from being hidden inside a weighted score.
- Avoids over-blocking when metadata is incomplete.
- Produces diagnostics that History and future replay tools can inspect.

Cons:

- A candidate with missing metadata may still require manual review instead of being automatically rejected.

### 4. Cover Multiple Signal Families

Strict constraints should work across genres, keywords, studios, language, media type, certifications, release year, vote average, and runtime.

Pros:

- Handles the real Family/R-rated failure shape.
- Lets niche libraries express real boundaries without relying on library names.
- Keeps constraints deterministic and testable.

Cons:

- More signal types require more targeted unit coverage.

## Final Stack

- Added `policyConstraintSemantics.mjs` as a pure ES module for deterministic constraint evaluation.
- Added `POLICY_CONSTRAINT_MODES` and `POLICY_CONSTRAINT_OUTCOMES` for bounded result vocabulary.
- Preserved advisory defaults; only explicit strict semantics are treated as runtime constraints.
- Evaluated strict constraints during policy evaluation and policy exclusion filtering.
- Added `policy_constraints` diagnostics to policy candidate diagnostics.
- Returned generic `constraintConflicts` alongside legacy `languageConflicts`.
- Kept unknown metadata non-blocking to avoid false negatives during sparse enrichment.

## Implemented Outcome

For a strict Family policy with `certifications: { mode: "max", max: "PG-13", strict: true }`, an `R` rated movie now produces:

- a deterministic `certification_above_max` conflict,
- `policy_constraint_conflict` in candidate suppression reasons,
- `negative_conflict` evidence class,
- exclusion from final ranking.

For a broad comedy signal with no strict semantics, the policy remains advisory. It can boost confidence, but it does not become a hard route.

## Security and Privacy Boundaries

- Constraint diagnostics store bounded scalar values only.
- No prompts, raw provider responses, API keys, headers, embeddings, or full metadata payloads are persisted.
- Strict constraints are local deterministic checks and do not invoke AI providers.
- Missing metadata is reported as `unknown`, not treated as a hard failure.

## Validation

Focused validation:

```bash
npm --prefix server run test:unit -- --testPathPatterns="policyConstraintSemantics|policyExclusionService|policyCandidateDiagnostics|policyEngine.presetSemantics|policyEngine.scoringFunctions" --runInBand --no-coverage
```

## Follow-Up Design Items

1. Policy constraint UI editor

   Intent: expose strict/advisory runtime behavior in policy and preset editors without requiring JSON edits.

   Platform improvement: fewer misconfigured policies, safer library boundaries, and clearer operator intent.

2. Policy replay harness

   Intent: replay saved classification incidents against current deterministic policy/profile/RAG logic without AI calls.

   Platform improvement: verifies that new scoring and constraint rules keep historical incidents fixed.

3. Constraint conflict observability in History

   Intent: render `policy_constraints` and `constraintConflicts` in the History detail modal.

   Platform improvement: makes strict candidate suppression understandable from the UI without PostgreSQL queries.
