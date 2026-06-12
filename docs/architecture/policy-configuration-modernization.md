# Policy Configuration Modernization

Status: implemented for the next release line.

## Problem

Policy configuration has grown into several overlapping concepts:

- preset signals,
- custom per-policy signal overrides,
- advisory scoring weights,
- strict runtime constraints,
- exclusions,
- diagnostics used after a classification run.

Those concepts were valid, but they were not exposed as one structured policy-intent model. The UI and operators could see raw presets and some runtime semantics, but not a stable view that answered: "Which signals establish identity, which only provide compatibility, which are hard constraints, and which are soft boosters?"

The goal is to modernize policy configuration around a typed, explainable projection without changing classification outcomes in the same step.

## Official Source Research

Research date: June 12, 2026.

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) frames trustworthy AI around transparent, accountable, and explainable system behavior. Classifarr should make classification policy intent inspectable before an operator has to diagnose individual outcomes.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) emphasizes verifiable application behavior and secure handling of application inputs. Policy configuration should use bounded, normalized inputs rather than accepting arbitrary runtime aliases.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) recommends allow-list validation for structured input. Policy signal overrides now normalize known semantic and constraint-mode fields and drop unsupported aliases.
- [Open Policy Agent documentation](https://www.openpolicyagent.org/docs) models policy decisions as structured, inspectable data. Classifarr follows the same principle by projecting policy configuration into explicit decision-intent buckets instead of only exposing raw JSON signals.
- [PostgreSQL JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) support semi-structured JSON storage when the application owns validation. Classifarr can keep `policy_presets.custom_signals` as JSONB while enforcing a stricter service-layer contract.

## Recommendations

### 1. Add a Read-Only Policy Configuration Projection

Expose a normalized `configuration_view` on policy responses that groups merged preset signals into:

- `identity_signals`,
- `compatibility_signals`,
- `strict_constraints`,
- `boosters`,
- `exclusions`.

Pros:

- Gives the UI and operators a stable intent model.
- Avoids a breaking database migration.
- Keeps scoring behavior unchanged while improving explainability.

Cons:

- Adds a second representation of policy signals that must stay derived from the source of truth.

### 2. Normalize Runtime Constraint Aliases on Write

Treat `constraint_mode`, `constraint`, `runtime_mode`, and `runtime` as supported alias fields, but normalize valid values to `strict` or `advisory` and drop unsupported values.

Pros:

- Reduces policy JSON drift.
- Keeps existing clients compatible with the newer constraint model.
- Prevents typo-like aliases from becoming invisible behavior.

Cons:

- Invalid custom aliases are discarded instead of persisted for manual repair.

### 3. Keep JSONB Storage, Add Service-Level Structure

Do not introduce policy-schema tables yet. Use the service projection as the typed boundary while preserving existing JSONB flexibility.

Pros:

- Small blast radius.
- Works with existing backups and restores.
- Lets the project learn from real policy-builder needs before hardening schema.

Cons:

- Database constraints cannot yet enforce every signal-level rule.

### 4. Separate Intent From Outcome

Keep `configuration_view` focused on configured policy intent, not a classification result.

Pros:

- Prevents outcome diagnostics from mutating policy configuration semantics.
- Supports policy-builder UI, audits, and future replay harnesses.

Cons:

- Operators still need History details for item-specific evidence.

## Final Stack

- Added `policyConfigurationView.mjs` as a pure ES module.
- Added `configuration_view` to policy create, update, and read responses.
- Merged base preset signals with custom policy overrides before projection.
- Projected each signal into one primary role:
  - identity,
  - compatibility,
  - strict constraint,
  - booster,
  - exclusion.
- Added bounded summary counts and warnings for weakly anchored policy configurations.
- Normalized custom signal constraint-mode aliases during policy writes.
- Added focused unit tests and a route-level assertion.

## Implemented Outcome

A policy with a `Family` genre preset, a strict `PG-13` max certification, a studio preference, and an advisory language exclusion now returns a structured `configuration_view` that shows each piece in its intended role.

This does not change scoring authority by itself. It creates the platform contract needed for a modern policy builder, policy audit view, and future migration from raw signal JSON toward stronger typed configuration.

## Security and Privacy Boundaries

- The projection uses only policy configuration data already returned through authenticated policy APIs.
- No media overviews, provider prompts, API keys, embeddings, or raw classification payloads are included.
- Unsupported runtime alias values are dropped at write time.
- The implementation is deterministic and does not call external services.

## Validation

Focused validation:

```bash
npm --prefix server run test:unit -- --testPathPatterns="policyConfigurationView|policies-routes|policyConstraintSemantics|policySignals" --runInBand --no-coverage
npm --prefix server run lint
git diff --check
```

## Follow-Up Design Items

1. Policy builder intent-first UI

   Intent: rebuild policy editing around explicit intent sections instead of raw preset customization.

   Platform improvement: makes policy authoring safer and reduces accidental broad signals like generic `Comedy` becoming stronger than intended.

2. Policy schema validator and migration assistant

   Intent: add a formal server-side schema that validates policy signal shape and reports repairable legacy configuration drift.

   Platform improvement: catches invalid or ambiguous policy JSON before it influences classification.

3. Policy replay and impact preview

   Intent: show how a policy edit would have affected recent classifications before saving or enabling it.

   Platform improvement: lets operators tune policies against real evidence without causing routing churn.
