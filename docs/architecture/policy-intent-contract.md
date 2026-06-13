# Policy Intent Contract

Status: implemented for the next release line.

## Problem

Classifarr needs an intent-first policy model, but existing installs already rely on preset-backed policies:

- `library_policies`,
- `policy_presets`,
- `content_presets.signals`,
- `policy_presets.custom_signals`.

Replacing those records immediately would risk breaking existing behavior. The safer first step is a server-owned, read-only contract that explains policy intent while preserving legacy preset compatibility.

## Official Source Research

Research date: June 12, 2026.

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) frames trustworthy AI around transparency, accountability, explainability, and interpretability. Classifarr should expose policy intent as a structured contract instead of requiring users to infer behavior from preset internals.
- [NIST AI RMF 1.0 PDF](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf) describes trustworthy systems as valid, reliable, safe, secure, accountable, transparent, explainable, interpretable, privacy-enhanced, and bias-managed. A bounded policy intent contract supports transparent operator review without changing classification behavior.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) provides a basis for testing application security controls. Policy intent should be produced by the server and not trusted solely from client-side interpretation.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) recommends allow-list validation for structured inputs. The contract reports unsupported legacy preset signal types and keys instead of silently accepting them as first-class intent.
- [Open Policy Agent documentation](https://openpolicyagent.org/docs) notes that policy decisions can produce arbitrary structured data, not only allow/deny answers. Classifarr follows that model by returning a structured policy intent contract with purpose, hard limits, helpful hints, avoid rules, provenance, warnings, and inference state.

## Recommendations

### 1. Derive Intent Before Storing Intent

Build `policy_intent_contract` from existing preset-backed policy data before introducing native intent tables.

Pros:

- Existing policies keep working.
- No database migration is required.
- The UI gets a stable server-owned target.

Cons:

- Intent remains derived from legacy presets for now.

### 2. Treat Unsupported Legacy Signals As Partial Inference

Unsupported legacy preset signal types or keys should not break policy loading. They should appear under `unsupported_signals` and create a warning.

Pros:

- Preserves compatibility.
- Makes ambiguity visible.
- Avoids destructive auto-repair.

Cons:

- Users may still need manual cleanup for unusual legacy presets.

### 3. Preserve Template Provenance

Expose `template_links` so the UI can show which starter templates are attached without treating templates as the policy source of truth.

Pros:

- Supports the transition from presets to starter templates.
- Keeps provenance visible.
- Makes future explicit conversion safer.

Cons:

- Template provenance is still attachment-based until native intent storage exists.

### 4. Keep The Contract Read-Only

Do not introduce intent writes in the same step.

Pros:

- Smaller blast radius.
- Lets the UI consume and validate the model first.
- Avoids accidental migration semantics.

Cons:

- Intent edits still serialize through existing `customSignals` compatibility paths.

## Final Stack

- Added `server/src/services/policyIntentContract.mjs`.
- Attached `policy_intent_contract` to policy read/create/update responses.
- Built contract sections:
  - `purpose`,
  - `hard_limits`,
  - `helpful_hints`,
  - `avoid`,
  - `review_behavior`,
  - `template_links`,
  - `warnings`,
  - `unsupported_signals`.
- Added model metadata:
  - `source`,
  - `inference_state`,
  - `model.mode`,
  - `model.intent_supported`,
  - `model.native_intent`,
  - `model.conversion_available`.
- Kept legacy preset storage unchanged.
- Added service and route coverage.

## Implemented Outcome

An existing preset-backed Family policy now returns a server-owned intent contract:

```js
{
  source: 'legacy_presets',
  inference_state: 'inferred',
  purpose: [...],
  hard_limits: [...],
  helpful_hints: [...],
  avoid: [...],
  template_links: [...],
  warnings: [],
  unsupported_signals: []
}
```

If a legacy preset contains unsupported signal data, the policy still loads and the contract becomes `partial` with bounded warnings.

## Security and Privacy Boundaries

- The contract uses only policy configuration data already available to authenticated policy APIs.
- No provider prompts, API keys, embeddings, media overviews, headers, or raw classification payloads are exposed.
- Unsupported legacy signal fields are reported, not executed as new behavior.
- The contract is deterministic and does not call external services.
- Persistence remains unchanged; no automatic migration or conversion occurs.

## Validation

Focused validation:

```bash
npm --prefix server run test:unit -- --testPathPatterns="policyIntentContract|policyConfigurationView|policies-routes" --runInBand --no-coverage
npm --prefix server run lint
git diff --check
```

## Follow-Up Design Items

1. Intent contract consumption in the policy builder

   Intent: make the UI read `policy_intent_contract` instead of independently inferring every role from presets.

   Platform improvement: reduces client/server semantic drift.

2. Intent draft write bridge

   Intent: convert UI intent edits into legacy-compatible `customSignals` while preserving template attachments.

   Platform improvement: lets users edit intent directly without native storage migration.

3. Policy impact preview

   Intent: evaluate proposed intent edits against recent classification history before save.

   Platform improvement: prevents policy changes from causing unexpected routing churn.
