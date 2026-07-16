# Policy Engine Native Runtime Authority

Status: implemented as the Phase 8R.4 runtime-authority completion component.

## Problem

The policy-detail API could already project an active native intent, but the
live classification engine still loaded `policy_presets` and merged legacy
`custom_signals` for every enabled policy. A converted policy therefore looked
native in the UI while legacy data could still influence classification. That is
not a safe migration boundary.

## Official-Source Research

- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure development practices and addressing root
  causes rather than only masking symptoms. The authority boundary is enforced
  where decisions are made, not just where policies are displayed.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  recommends following data flow from source through processing to sinks and
  enforcing business rules at the server-side decision boundary. Converted
  policies therefore suppress legacy inputs before engine scoring begins.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends consistent, bounded application events and testing logging
  behavior. Decision results retain source/status trace metadata and stable
  runtime status IDs instead of raw policy values or exception details.
- [OpenTelemetry event semantic conventions](https://opentelemetry.io/docs/specs/semconv/general/events/)
  describe named checkpoints and outcome attributes as useful event semantics.
  The existing bounded `classifarr.policy.read.*` trace remains the runtime
  source-of-authority trace.

## Options Considered

### Keep Native Intent Only In Detail Reads

Pros: smallest change and no engine refactor.

Cons: misleading product contract; converted policy behavior still depends on
legacy presets and `custom_signals`.

### Shadow-Score Native Intent Beside Legacy Presets

Pros: useful for migration analysis.

Cons: leaves two authorities in normal runtime behavior and can permit legacy
scores to affect routing. Shadow comparison belongs in bounded migration
verification, not production classification.

### Enforce Native Authority At The Engine Boundary

Pros: one authority per converted policy, no legacy preset query for converted
policies, compatibility remains isolated to unconverted policies, and invalid
or ambiguous authority fails closed.

Cons: requires a dedicated native evaluator and explicit decision trace tests.

## Final Recommendation Stack

1. Batch-load active native authority for enabled policies, reading at most two
   active intent rows per policy and loading child rows only for one
   authoritative row.
2. Build one runtime-authority projection before policy scoring. Native
   authority clears the engine's legacy preset input and applies persisted
   review behavior; unconverted policies retain the compatibility projection.
3. Evaluate native `purpose`, `hard_limits`, `helpful_hints`, and `avoid` rules
   in a dedicated evaluator. Purpose must match before profile, RAG, history,
   or pattern evidence can contribute or trigger a RAG lookup. Failed or
   unknown hard limits, invalid contracts, and ambiguous authority produce a
   zero-score non-candidate.
4. Keep compatibility preset scoring unchanged for policies without native
   authority. It remains a migration bridge, not a fallback for converted
   policies.
5. Return bounded native runtime status and the existing source trace with the
   candidate/decision result. Do not return raw legacy payloads or native rule
   values.

## Implemented Outcome

- `policyNativePolicyReadService.mjs` now has a batched active-intent loader.
  It retains the existing single-policy loader for detail reads, caps authority
  inspection at two rows, and skips rules/templates/validation reads for an
  authority conflict.
- `policyEngineRuntimeAuthority.mjs` is the engine-specific authority boundary.
  It applies native review behavior and clears `presets` for all native states,
  including invalid or ambiguous authority, so a legacy scoring fallback is
  impossible.
- `policyNativeIntentRuntimeEvaluator.mjs` owns native rule evaluation. It
  treats purpose as identity, treats helpful hints as a bounded post-identity
  adjustment, treats only an explicit matched exclusion as a bounded avoid
  penalty, and fails closed for hard-limit conflicts or unknown metadata.
- Policy constraints, language conflict handling, agreement scoring, candidate
  diagnostics, and decision results now recognize native authority and preserve
  source/status trace metadata.
- The policy-engine PostgreSQL integration test proves a converted policy with
  a retained legacy Horror preset matches its native Animation purpose and does
  not match Horror.

## Security Outcome

- No converted policy queries or scores `policy_presets` or `custom_signals`.
- Ambiguous or invalid native authority cannot fall back to compatibility
  scoring.
- Supporting evidence cannot rescue an item whose native purpose did not match.
- Native policies that are ineligible before support scoring do not consume a
  RAG retrieval merely because their stored review behavior allows RAG.
- Hard-limit unknowns are conservative non-candidates instead of automatic
  approvals.
- Missing avoid metadata is neutral. An advisory avoid penalty is applied only
  when the item's known value explicitly matches an exclusion value.
- Runtime diagnostics contain stable status IDs, bounded counts, and existing
  source traces only.

## Verification

- Focused native loader, runtime-authority, native evaluator, and constraint
  tests.
- Existing policy-engine result, semantics, and combination-mode unit suites.
- PostgreSQL-backed policy-engine integration coverage for native-over-legacy
  scoring behavior.

## Next Step

Continue the Phase 8R completion audit with **8R.14 Compatibility Path Deletion
Readiness**. It must inventory every remaining compatibility reader and prove
there are no unconverted enabled policies or unresolved reconciliation states
before removal is planned.
