# Compatibility-purpose consumer boundary

Research outcome: November 9, 2026 Eastern, source main
4a6d345dbc91e948c55b142a2b5ee194807efebd. Read-only repository investigation.
No runtime change, provider call, historical rewrite or deployment.

## Finding

The queued name "compatibility-purpose prompt projection" is inaccurate. The
omitted purpose/compatibility pair identified in the initial-semantics work is in
a post-choice destination-evidence adapter. Its output reaches learning admission.
It is not an existing selective representation of native purpose in the provider
prompt. These consumers require separate designs.

## Confirmed post-choice chain

| Consumer | Observed behavior |
| --- | --- |
| clarificationService.mjs:125–142 | Supplies the runtime destination-evidence service to resolution |
| clarificationPolicyResolution.mjs:415–424 | Invokes it within the resolution transaction for authenticated native answers, excluding route_not_applicable |
| policyRuntimeDestinationEvidenceCommandService.mjs:143–181 | Locks state, builds provenance, checks admission and invokes the authorized executor |
| policyRuntimeDestinationEvidenceProvenance.mjs:87–133 | Maps purpose/identity to belongsHere and helpful_hint/compatibility to helpfulMatches; omits purpose/compatibility |
| Same provenance module:309–340 | Feeds the projection to bounded evidence and bounded intent/learning guards |
| policyRuntimeDestinationEvidenceAdmission.mjs:153–171 | Requires the candidate, matching tier, canWriteLearning and queued profile refresh |
| policyAuthorizedOutcomeTransactionExecutor.mjs:266–270 | Dispatches identity/compatibility evidence persistence |
| policyRefreshBackedEvidencePersistence.mjs:83–94 | Writes evidence and refresh outbox within the transaction |

The separate candidate selector also excludes purpose/compatibility at
policyRuntimeDestinationEvidenceCandidate.mjs:172–184. Changing only the adapter
would not automatically admit that pair, but could alter guards for other
supported candidates. Expanding both consumers would widen learning authority.

The provenance query selects intent.source, not rule.source, at lines 147–156.
Native storage lineage cannot substitute for canonical declared-rule proof in a
future representation. Do not infer missing proof from names, counts or current
configuration.

## Actual provider-prompt chain

classificationAiService.mjs:224–258 calls classificationBasePrompt.mjs:4–19 and
aiPromptBuilder.mjs:61–94, with formatting in aiPromptBuilderFormatters.mjs:
138–189, 201–274 and 350–412. These paths consume numeric policy signals, task
instructions, library labels/types and bounded profile/retrieval/description
candidate packets.

The closed candidate fields at policyCandidateAdjudicationEvidence.mjs:282–304
and 332–348 contain no native-purpose contract. The investigation finds no
existing LLM projection selectively including identity purpose while dropping
compatibility purpose. Adding native terms would be a new representation and
provider-disclosure decision, not restoration of a demonstrated prompt branch.

The existing numeric nativePurposePositiveSemantics.mjs contract still supports
declared compatibility purpose without granting specialized identity. This
investigation does not invalidate those scorer/persistence tests or change scores.

## Safe next decision

Choose which consumer a later batch addresses before implementation:

- Provider-prompt evidence needs explicit modes, exact item/candidate/snapshot
  binding, declared-rule provenance, role/semantics/operator/term/weight meaning,
  disclosure/output bounds and legacy/unknown behavior.
- Post-choice evidence needs explicit admission and learning authority for the
  purpose/compatibility pair, with transaction, replay and provenance safeguards.

Changing one consumer cannot be described as a harmless adjustment to the other.
Do not relabel purpose as helpful_hint or upgrade missing historical evidence.
Keep authorization in deterministic execution code; prompt wording is not a
permission boundary, consistent with [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

Correct queued references in initial-purpose-semantics-design/outcome,
npm-12-2-2-security-design/outcome and runtime-zlib-security-design/outcome.
Preserve their historical implementation and test receipts. The independently
proposed [PR 585 batch](server-tooling-pr-585-design.md) includes these documentation
corrections without changing either runtime consumer.
