# Policy Builder Phase 7R Runtime Decision Inventory And Cutline

## Status

Implemented as the first Phase 7R runtime contract.

This slice inventories current runtime classification, routing, question,
learning, RAG, AI, media-profile, queue, and retry paths before Phase 7R wires
the Phase 6R engine contracts into runtime behavior.

It does not change classification behavior, execute routing differently, modify
learning writes, add new questions, or delete runtime code.

## Problem

Phase 7R moves the re-imagined engine from policy-builder setup into runtime
classification and routing. That is high-risk unless every current runtime path
has an owner decision first.

The first runtime question is:

```text
Which current services are engine primitives, which need to be rewritten around
Phase 5R/6R contracts, which question/readiness paths need replacement, and
which legacy paths should be deleted after migration?
```

This inventory also calls out two known failure modes:

- broad genre overlap acting like destination authority,
- successful classification being conflated with successful Arr routing.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure design and verification before behavioral changes. Phase
  7R.1 adds a testable inventory before runtime wiring changes.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, mapped, measured, and managed AI behavior. AI, RAG, and
  metadata signals are classified as evidence or suggestions, not final runtime
  authority.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes server-side validation and business logic controls. Runtime paths
  must identify their authority source before behavior changes.
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  describes structured traces with spans and attributes. Phase 7R.1 keeps
  bounded stage, risk, and decision identifiers that can later feed decision
  traces without exposing raw payloads.

## Recommendations

1. **Inventory before wiring.**
   Do not connect Phase 6R evidence/readiness into runtime classification until
   current runtime artifacts have keep, rewrite, replace, or delete decisions.

2. **Guard critical runtime surface coverage.**
   The inventory should fail when route entrypoints, second-pass diagnostics,
   metadata enrichment, pending notification, classification, routing, or
   persistence surfaces are missing from the cutline.

3. **Guard Phase 7R contract surface coverage.**
   The runtime/rebuild contracts that replace old behavior must also be listed
   as inventory artifacts. A new contract service without an explicit cutline
   decision should fail the inventory before later runtime wiring proceeds.

4. **Require authority sources.**
   Every runtime artifact must identify whether it is driven by observed media
   server contents, declared operator intent, manual outcome, AI output,
   metadata evidence, or legacy template compatibility.

5. **Separate classification from routing.**
   Missing Arr mapping or failed Arr push must become a distinct runtime state,
   not a silent classification success.

6. **Replace known bad question paths.**
   Genre-priority prompts, AI invalid-response prompts, AI disagreement prompts,
   and pending resolution flags that generate rules must be routed through the
   Phase 5R question contract and Phase 6R learning guard.

7. **Keep AI/RAG as evidence.**
   AI explanations, RAG neighbors, and provider metadata can support evidence
   quality, but they cannot own final destination intent or durable learning.

## Pros And Cons

Pros:

- Prevents Phase 7R from wiring through unclear runtime paths.
- Catches critical runtime surface drift when new route or decision-facing files
  are added without a cutline decision.
- Makes known question and routing risks explicit.
- Preserves useful runtime primitives such as Arr executors, outcome ledger,
  profile sync, and bounded event persistence.
- Creates a stable handoff to Phase 7R.2 runtime evidence projection.

Cons:

- Does not yet change runtime classification behavior.
- Adds a broad inventory that must be maintained as runtime paths change.
- Requires intentional updates when classification route or metadata surfaces
  are renamed.
- Does not delete legacy signal or question code yet.

## Final Recommendation Stack

- Runtime inventory service:
  `server/src/services/policyBuilderPhase7RuntimeDecisionInventory.mjs`
- Runtime inventory tests:
  `server/src/__tests__/services/policyBuilderPhase7RuntimeDecisionInventory.test.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-7r-runtime-decision-inventory.md`
- Roadmap owner:
  Phase 7R.1 Runtime Decision Inventory And Cutline in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `PHASE7R_RUNTIME_DECISION_IDS`
- `PHASE7R_RUNTIME_STAGE_IDS`
- `PHASE7R_RUNTIME_RISK_IDS`
- `PHASE7R_BAD_QUESTION_PATH_IDS`
- `listPolicyBuilderPhase7RuntimeArtifacts`
- `listPolicyBuilderPhase7BadQuestionPaths`
- `listPolicyBuilderPhase7RequiredRuntimeSurfacePaths`
- `validateRuntimeArtifact`
- `buildPolicyBuilderPhase7RuntimeDecisionInventory`

Inventory decisions:

- `keep_runtime_engine_primitive`
- `rewrite_around_phase5_6_contracts`
- `replace_with_readiness_question_contract`
- `delete_after_migration`

Runtime stages:

- classification policy path,
- signal calculation,
- AI analysis and verification,
- RAG decisions,
- question generation,
- manual resolution,
- learning side effects,
- Arr routing,
- media-server profile refresh,
- queues and retry paths.

Known bad question paths:

- genre-priority questions,
- AI invalid-response questions,
- AI disagreement questions,
- pending resolution `generate_rule` behavior.

Required runtime surface coverage now includes:

- classification route entrypoints,
- pending and correction routes,
- second-pass diagnostic routes,
- classification orchestration,
- AI/RAG/question paths,
- routing and persistence paths,
- metadata enrichment paths,
- Discord pending notification rendering.

Required Phase 7R contract surface coverage now includes:

- runtime evidence projection,
- runtime evidence fingerprinting,
- automation decision contract,
- runtime question reduction,
- request-time learning,
- library-derived policy rebuild,
- migration verifier and rollback,
- runtime metrics and decision trace.

## Security Outcome

- Runtime behavior is not changed before authority and cutline are documented.
- Critical runtime surfaces cannot fall out of the inventory silently.
- Phase 7R runtime/rebuild contracts cannot fall out of the inventory silently.
- AI/RAG/provider output is not treated as final authority.
- Learning side effects are flagged for Phase 6R guard wiring.
- Routing success and classification success are separated as a required
  follow-up contract.

## Next Step

Phase 7R.2 Runtime Evidence Projection should build the runtime evidence
projection that maps current classification inputs into Phase 6R evidence
buckets before automation decisions are changed.
