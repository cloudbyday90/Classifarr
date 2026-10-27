# Purpose authority consistency design

Date: 2026-10-27. Scope: the first classification refactor agreed after the
read-only intent/database audit. The user authorized implementation on `main`,
local verification, documentation, commit and push. No release or production
deployment is part of this change.

## Problem and evidence

The audited installation has ten active policies and nine active native intents.
Their relationships, purpose rows, routing targets and validation records are
intact. Existing native storage is therefore not evidence that purpose was
explicitly declared. The canonical rule classifier identifies seven native
purposes as profile-derived and two as unverified migrated template rules.
The generic API currently calls all nine declared. Specialized identity scoring
excludes broad profile-derived genres but accepts equivalent unverified template
genres as distinguishing purpose. That inconsistency changes calibration and
candidate ordering.

The database's active native header requires `inference_state = inferred`,
including for real declarations. Rule provenance and governed write receipts,
not that header or a structural `valid` result, distinguish declarations.
The conversion reconciler is running; it intentionally skips already-native
contracts and does not improve their semantic definitions. Observation profiles
refresh separately.

Private production snapshots and titles remain in ignored `.tmp/`. Public
regressions use synthetic identities and arbitrary destination names. The audit
also found broader inferred-fit errors, outcome-report coverage gaps and missing
per-item learned-routing rejection reasons; those remain separate work.

## Official-source research

The following URLs were discovered through the connected search MCP and opened
on 27 October 2026. Stable W3C Recommendations predate this date; mutable OWASP
guidance describes the material retrieved on this date, not a frozen archive.

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) distinguishes derivation and
  attribution. Application inference: preserving a rule's origin does not
  establish that it is an operator declaration. Reuse the existing compact
  provenance model; introducing RDF or an ontology runtime would add no value
  to this bounded correction.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) separates
  structural metadata, provenance and quality information. Keep native storage
  validation, declared purpose and measured classification quality distinct.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends explicit decisions, default denial and authorization testing.
  Application inference: unverified evidence must not acquire specialized
  declared-purpose proof through a permissive fallback. This is an evidence
  authority check, not a replacement for administrator authorization.
- [OWASP decision and output handling](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Decisions_And_Output_Handling_Cheat_Sheet.html)
  recommends binding decisions to their inputs and rejecting unusable results.
  Keep the existing routing receipts, constraints and fresh checks; a provenance
  projection is not a routing receipt.
- [W3C WCAG 2.2 headings and labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
  requires descriptive, accurate labels. A policy API must not call observed
  purpose declared. This change adds no input, focus movement or live region;
  it does not claim a complete accessibility audit.

## Options and tradeoffs

| Option | Advantages | Costs and risks | Decision |
| --- | --- | --- | --- |
| Rewrite inferred rows as declarations | Minimal runtime work | Invents operator authority and conceals the original evidence | Reject |
| Remove all inferred ranking and admission | Simple declaration boundary | Discards useful observations and hides candidates from learned comparison | Reject |
| Repeat source checks in each consumer | Small edits | Preserves the duplication that caused the discrepancy | Reject |
| Reuse one provenance classifier and aggregate projection | Consistent meaning, bounded output, existing storage retained | Changes ranking for migrated templates; requires Anime and mixed-rule regression checks | Select |

## Implementation contract

1. Keep `policyDeclaredPurposeProvenance.mjs` as the pure source of truth for
   per-rule declaration classification. Aggregate the existing
   `declared_native`, `profile_derived`, `mixed` and `unverified` states there.
   Retain the existing purpose-change interface as a compatibility wrapper.
2. Specialized identity may use only rules classified as server-recorded native
   declarations. Preferences, media type and other non-content signals still
   cannot establish specialized identity. Matching declarations must still pass
   the existing content and cross-candidate tests.
3. The generic policy authority projection keeps native storage/read authority
   separate from purpose declaration. Derive its declaration status from rule
   provenance, include only declared rules in its declared section and expose a
   fixed aggregate purpose-provenance object. Mixed purpose retains a visible
   declaration requirement even where a declared subset exists. Raw per-rule
   provenance is not added to the public authority projection.
4. Preserve observational scoring, eligible zero-score comparison, existing
   base-template candidate restrictions, hard limits, avoids, exact-item memory
   and learned routing. Do not relabel a base rule as a profile observation.
5. Preserve the existing schema, saved versions, governed declaration writers,
   thresholds and routing receipt checks. No live migration or reclassification.

The implementation uses existing modular ESM services, PostgreSQL storage and
Jest contracts. No new singleton, dependency, setting or endpoint is needed.
There is no client runtime consumer of the generic authority projection; verify
that boundary rather than adding a redundant client interpreter.

## Verification and limits

- Test declared native/operator, profile-derived, base, missing, malformed,
  empty and mixed purpose through the same classifier and consumers.
- Preserve bounded immutable aggregate output and prevent provenance/content
  leaks or input mutation.
- Test that inferred Anime requirements still admit matching candidates and
  exclude nonmatching candidates while losing unjustified specialized proof.
- Cover genuine declared content, shared declared overlap, constraints and
  learned evidence separately from arbitrary destination labels.
- Use a synthetic scripted-comedy case to test the ranking
  consequence. Replay the ignored audit snapshot offline for directional
  evidence, without provider calls or routing writes.
- Run affected unit/integration suites, broader policy/routing regression,
  typechecking, lint, code-health checks and documentation validation.

The observed ranking-only counterfactual changes the scripted-TV examples but
does not change the documentary or seasonal-movie failures. Those remaining
cases are explicit error controls, not successful results. No accuracy rate or
automatic-route improvement is promised from this limited sample.

## Final recommendation stack

Server-recorded rule provenance -> one pure classifier and bounded aggregate ->
specialized content proof and honest API declaration -> unchanged candidate,
constraint and fresh-routing checks -> synthetic and private offline regression.

After this component, measure broader inferred-purpose ranking against retained
operator outcomes. First make authorized exact-item outcomes visible to
evaluation without granting generalized learning, and retain per-item learned
routing stopping reasons so subsequent behavior changes have usable evidence.

Observed implementation and validation belong in
[the separate outcome](purpose-authority-consistency-outcome.md).
