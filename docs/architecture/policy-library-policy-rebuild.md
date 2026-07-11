# Policy Library-Derived Policy Rebuild

## Status

Implemented as the durable library-derived policy rebuild runtime contract with
product-domain module, export, and contract names.

This contract creates a side-effect-free rebuild proposal from observed library
profile evidence, fingerprint-bound guarded outcomes, explicit operator
constraints, routing configuration, outlier evidence, and profile freshness. It
produces a policy intent draft plus readiness, source summaries, warnings,
acceptance gates, and rollback gates. It does not activate, replace, delete, or
persist policy.

Every rebuild proposal now passes its normalized evidence through the shared
bounded evidence boundary. A rejected boundary returns a sanitized
`blocked_by_evidence_boundary` proposal with no projection, intent, or
readiness contract.

## Problem

The re-imagined policy model starts from the media server as the source of
truth, but rebuilding policy from current library contents is risky if it is
treated as an automatic migration:

```text
observed examples are useful
guarded outcomes are useful
guarded outcomes must be bound to sanitized upstream evidence fingerprints
operator constraints are authoritative
observed absence is not an exclusion
route configuration is operational state
profile freshness affects trust
```

Library-derived policy rebuild turns those inputs into a reviewable proposal
rather than an automatic policy replacement. That keeps automation moving
toward the new model without reintroducing destructive or opaque behavior.

This checkpoint tightens the guarded outcome boundary: a rebuild proposal can
no longer consume an outcome merely because it has a sanitized fingerprint. The
outcome must also pass the request-time learning contract, including bounded
question-reduction validation proof and matching trace attributes.

The proposal's validation diagnostics use durable bounded-intent and policy
automation-readiness terminology. Roadmap phase labels are not part of the
runtime rebuild contract.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework 1.0](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes govern, map, measure, and manage functions for AI risk. The
  rebuild contract maps evidence sources, measures confidence/readiness, and
  requires explicit management gates before replacement.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes provenance, monitoring, and risk controls for generative AI
  systems. The proposal preserves source summaries, assumptions, warnings, and
  bounded trace reasons instead of producing an opaque rewritten policy.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  highlights excessive agency, insecure output handling, and overreliance. The
  rebuild proposal has no direct activation or persistence side effects.
- [Microsoft Human-AI Experience Guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
  emphasize user control, clear uncertainty, and graceful recovery.
  Library-derived policy rebuild requires operator acceptance and a rollback
  snapshot before any later replacement path can apply the proposal.
- [OpenTelemetry Semantic Convention Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends lower-case namespacing, snake_case for multi-word name components,
  and precise unambiguous terms. The contract uses
  `policy.library_policy_rebuild.v1` and product-domain step names instead of
  roadmap phase identifiers.

Additional hardening guidance:

- NIST AI RMF provenance and monitoring guidance supports carrying bounded
  evidence proof through the rebuild chain so operators and later migration
  verifiers know which guarded outcomes were actually consumed.
- OWASP LLM application guidance supports refusing untrusted or unvalidated
  intermediate outputs. Guarded outcomes without upstream evidence fingerprints
  are now warning/error context, not proposal evidence.
- OWASP LLM guidance also supports validating intermediate outputs before they
  influence downstream actions. Guarded outcomes without valid request-time
  proof are now rejected before they can shape a rebuild proposal.
- OpenTelemetry semantic convention guidance supports stable, common trace
  attributes. Rebuild traces now mirror guarded-outcome request-proof counts so
  migration verifiers can correlate the proposal source summary with bounded
  telemetry without raw runtime payloads.
- Microsoft HAX guidance supports clear uncertainty and recovery. Missing
  fingerprints surface as explicit validation risks instead of silently
  influencing the proposed policy.

## Recommendation

Use a deterministic library-derived proposal builder before any migration or
replacement workflow.

The proposal should answer:

```text
What does the current library show belongs here?
Which guarded outcomes support future classification?
Which explicit constraints must be preserved?
Can confirmed matches route?
Is the profile fresh enough to trust?
What assumptions and warnings must the operator review?
Was a rollback snapshot required before replacement?
Were any side effects performed?
```

## Pros And Cons

Pros:

- Converts observed library/application evidence into a structured intent draft.
- Preserves explicit operator constraints unless the operator changes them.
- Keeps observed absence as warning/review context, not automatic exclusion.
- Requires explicit acceptance and rollback gates.
- Gives migration verifier work a stable proposal input.

Cons:

- Does not yet replace legacy policy behavior; migration remains a later slice.
- Conservative warnings may require operator review for outliers or preserved
  constraints.
- Proposal confidence depends on the quality and freshness of library profile
  evidence.
- Runtime integrations must provide validated request-time outcome envelopes
  before guarded outcomes can affect rebuild evidence.

## Final Recommendation Stack

1. Consume only bounded, local evidence:
   - observed library profile,
   - guarded outcomes with sanitized upstream evidence fingerprints,
   - explicit constraints,
   - routing configuration,
   - outlier signals,
   - profile freshness.
2. Reuse policy evidence, intent, and readiness contracts for proposal
   generation.
3. Produce a proposal envelope with:
   - proposed intent draft,
   - readiness state,
   - confidence,
   - evidence source summary,
   - assumptions,
   - warnings,
   - acceptance gate,
   - rollback gate,
   - disabled side effects.
4. Treat observed absence as warning-only context.
5. Preserve explicit hard limits and avoid rules.
6. Require explicit operator acceptance before activation.
7. Require rollback snapshot before any later accepted replacement.
8. Leave migration comparison and rollback execution to the migration verifier.
9. Reject guarded outcome handoffs that lack sanitized SHA-256 upstream
   evidence fingerprints or whose bounded trace counts no longer match source
   summaries.
10. Reject guarded outcomes that lack request-time validation proof, fail the
    request-time learning contract, or carry request/question proof that drifts
    from the guarded outcome fingerprint.
11. Mirror request-proof accepted/missing/invalid counts into bounded rebuild
    trace attributes.
12. Require the bounded evidence boundary before creating a projection. Return
    a side-effect-free blocked proposal instead of falling back to direct
    projection when that boundary rejects input.

## Implemented Files

- Library-derived rebuild proposal contract:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs`
- Evidence dependency:
  `server/src/services/policyEvidenceBoundary.mjs`
- Intent dependency:
  `server/src/services/policyIntentEngine.mjs`
- Readiness dependency:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Roadmap owner:
  Library-Derived Policy Rebuild in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `POLICY_REBUILD_AUDIT_RISK_IDS`
- `POLICY_REBUILD_PROPOSAL_STATUS_IDS`
- `POLICY_REBUILD_REASON_IDS`
- `POLICY_REBUILD_WARNING_IDS`
- `buildPolicyLibraryPolicyRebuildProposal`
- `buildPolicyLibraryPolicyRebuildAudit`
- `validatePolicyLibraryPolicyRebuildProposal`

## Proposal Statuses

`ready_for_review`
: Evidence is sufficient for operator review and no higher-priority gate is
  blocking the proposal.

`needs_more_evidence`
: Belongs-here evidence is missing or too weak.

`needs_operator_constraint_review`
: Explicit hard limits or avoid rules were preserved and should be reviewed
  before acceptance.

`needs_routing_configuration`
: Confirmed matches cannot route until the destination routing target is
  configured.

`stale_profile`
: The library profile must be refreshed before the proposal can be trusted.

`blocked`
: A hard-limit conflict or policy-edit requirement blocks the proposal.

`blocked_by_evidence_boundary`
: Rebuild evidence failed server-side validation. The proposal retains only a
  sanitized boundary context and no derived projection, intent, or readiness.

## Security And Data Handling

- The proposal builder does not call providers.
- The proposal builder uses an allow-listed evidence envelope and the shared
  bounded evidence gate before it creates a projection.
- A rejected evidence boundary exposes only stable status and risk IDs; it does
  not expose rejected values, error text, or derived policy contracts.
- The proposal builder does not expose raw provider payloads.
- The proposal builder does not activate, replace, delete, or persist policy.
- The proposal builder does not write learning or routing changes.
- Observed absence cannot become an avoid or exclusion rule.
- Explicit constraints remain preserved unless an operator changes them later.
- Trace output uses bounded reason codes and counts, not raw payloads or prompts.
- Guarded outcomes are only consumed as compatibility/outlier proposal evidence
  when they carry a sanitized upstream SHA-256 evidence fingerprint from the
  runtime decision, question-reduction, and request-learning chain.
- Guarded outcomes are only consumed when the request-time learning contract
  validates successfully, including bounded question-reduction proof.
- Source summaries store bounded fingerprint counts and digests only; they do
  not store raw library labels, item titles, provider payloads, prompts, or
  runtime diagnostics.
- Validation rejects missing guarded-outcome fingerprints and trace/source
  summary fingerprint count mismatches before the proposal can pass.
- Validation rejects missing or invalid request-time proof and request-proof
  trace/source summary mismatches before the proposal can pass.

## Test Coverage

The focused test suite verifies:

- proposals include belongs-here, helpful-match, hard-limit, and routing fields,
- valid proposals retain a ready bounded evidence context and SHA-256
  projection fingerprint,
- rejected evidence returns a boundary-blocked proposal with no projection,
  intent, or readiness output,
- attaching a derived contract to a boundary-blocked proposal fails validation,
- guarded outcomes with valid upstream evidence fingerprints are consumed as
  proposal evidence,
- guarded outcomes with valid request-time/question-reduction proof are
  consumed as proposal evidence,
- guarded outcomes without upstream evidence fingerprints are not consumed and
  fail validation,
- guarded outcomes without request-time proof or with invalid request-time proof
  are not consumed and fail validation,
- guarded outcome fingerprint trace counts must match source summaries,
- guarded outcome request-proof trace counts must match source summaries,
- proposals require explicit operator acceptance,
- proposals require rollback snapshots,
- proposal side effects remain disabled,
- observed absence stays warning-only and cannot become avoid evidence,
- missing routing produces a routing configuration status,
- stale profile produces a profile-refresh status,
- missing identity produces a needs-more-evidence status,
- direct activation/replacement/deletion/learning/routing writes fail
  validation,
- missing acceptance, rollback, source summary, or constraint-preservation gates
  fail validation,
- the component audit points to
  `nextStep.stepId = migration_verifier_rollback`.

## Outcome

Library-derived policy rebuild gives the rebuild path this shape:

```text
library profile + fingerprint-bound guarded outcomes + explicit constraints + routing/freshness
  -> allow-listed bounded evidence projection
  -> policy intent draft
  -> policy readiness
  -> policy rebuild proposal envelope
  -> operator acceptance and rollback required
  -> no direct side effects
```

This creates a stable handoff to migration verification without destructive
automatic replacement.

## Next Step

Migration Verifier And Rollback Path should compare this proposal against
legacy behavior, show only migration-relevant differences, require a rollback
snapshot before replacement, and define the deletion criteria for old
preset/custom-signal runtime paths.
