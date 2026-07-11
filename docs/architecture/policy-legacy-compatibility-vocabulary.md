# Policy Legacy Compatibility Vocabulary

Status: implemented as the third Phase 0R source-of-truth contract.

## Scope

Phase 0R.3 defines how Classifarr should talk about legacy preset-backed policy
data while the platform moves toward native intent storage.

This slice does not change policy storage, routing, classification scoring,
database schema, save behavior, or UI rendering. It creates a server-owned ESM
vocabulary contract that distinguishes product language, support language,
internal compatibility language, and migration language.

## Research Inputs

Official sources reviewed as of June 2026:

- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Compatibility and migration work should be traceable, reviewed, and
    validated as part of secure software lifecycle practices.
- CISA Secure by Design:
  <https://www.cisa.gov/securebydesign>
  - Secure defaults and clear accountability matter during modernization; the
    old model should not stay as a hidden permanent path.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Compatibility payloads should stay bounded and allow-listed instead of
    becoming free-form user-facing configuration.
- OWASP Top 10 Legacy Application Management:
  <https://owasp.org/www-project-top-10-legacy-application-management/>
  - Legacy components that remain in active use need explicit management,
    ownership, and modernization plans.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Operator-facing terminology should describe what users can act on, not
    internal storage mechanisms.

## Recommendations

1. Use `Starter Template` as the product term for presets.
2. Keep `legacy preset record`, `customSignals`, and `custom_signals` as
   internal/support/migration language only.
3. Use `Compatibility bridge` for the temporary adapter that preserves existing
   policy behavior while intent drafts and native storage are introduced.
4. Use `Compatibility payload` for the legacy structured override data that
   remains round-tripped for unconverted policies.
5. Use `Intent draft` for operator intent before native storage owns durable
   policy records.
6. Use `Rollback snapshot` for bounded conversion safety records. Do not call
   them archives of the old product experience.
7. Use `Native intent storage` only for explicitly converted policies after
   validation, backup, restore, and rollback safety are proven.

## Pros And Cons

### Pros

- Keeps existing installs safe without teaching the old storage model as the
  future product model.
- Gives UI, server, docs, and tests one source for legacy terminology.
- Makes rollback snapshots bounded migration records instead of permanent
  parallel policies.
- Protects product copy from raw `customSignals` and preset JSON language.
- Prepares Phase 8R deletion gates by marking every compatibility term except
  native intent storage as non-permanent.

### Cons

- Existing client utilities and tests still reference `customSignals` internally
  until Phase 1R/2R/3R/8R replacement work happens.
- The vocabulary does not migrate data by itself.
- Support and migration docs may still need internal terms when troubleshooting
  existing policies.
- Some current implementation docs still describe historical phases with legacy
  terms; those should be updated as each R-phase inventory runs.

## Final Stack

- Authority vocabulary dependency:
  `server/src/services/policyAuthorityVocabulary.mjs`
- Legacy compatibility vocabulary contract:
  `server/src/services/policyLegacyCompatibilityVocabulary.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyLegacyCompatibilityVocabulary.test.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-legacy-compatibility-vocabulary.md`

## Implemented Outcome

Phase 0R.3 now defines these compatibility terms:

| Term | Audience | Purpose |
| --- | --- | --- |
| Starter Template | Product | A reusable shortcut that seeds editable intent. |
| Legacy policy record | Internal | Existing preset-backed DB data that must remain readable. |
| Compatibility bridge | Support | The temporary adapter preserving unconverted policy behavior. |
| Compatibility payload | Internal | Existing `customSignals` / `custom_signals` override data. |
| Intent draft | Product | Editable declared intent before native storage owns persistence. |
| Rollback snapshot | Migration | Bounded conversion safety record for rollback windows. |
| Native intent storage | Product | The final durable model after explicit conversion gates pass. |

Only `Native intent storage` is marked as the permanent target model. Every
other compatibility term is intentionally temporary or bounded.

## Follow-Up

The next Phase 0R task is **0R.4 Question And Learning Vocabulary**. That task
should define acceptable runtime question framing, answer outcomes, and learning
side-effect language before Phase 5R server authority work continues.
