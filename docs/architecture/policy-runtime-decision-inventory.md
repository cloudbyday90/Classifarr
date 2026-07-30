# Policy Runtime Decision Inventory

## Status

Implemented as the durable runtime decision inventory and cutline.

This inventory classifies current runtime classification, routing, question,
learning, RAG, AI, media-profile, queue, and retry paths before the policy
engine is wired into runtime behavior. It does not change classification
behavior, execute routing differently, modify learning writes, add questions,
or delete runtime code.

## Problem

Classifarr is moving policy intent from a setup-only concept into runtime
classification and routing. That is high risk unless every current runtime path
has an owner decision first.

The runtime inventory answers:

```text
Which current services are engine primitives, which need to be rewritten around
policy contracts, which question/readiness paths need replacement, and which
legacy paths should be deleted after migration?
```

This inventory also calls out two known failure modes:

- broad genre overlap acting like destination authority,
- successful classification being conflated with successful Arr routing.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure design and verification before behavioral changes. The
  runtime inventory adds a testable cutline before runtime wiring changes.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, mapped, measured, and managed AI behavior. AI, RAG, and
  metadata signals are classified as evidence or suggestions, not final runtime
  authority.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls. Runtime paths
  must identify their authority source before behavior changes.
- [OpenTelemetry Trace Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/general/trace/)
  define stable trace attributes for interoperable telemetry. The inventory
  keeps bounded stage, risk, and decision identifiers that can feed decision
  traces without exposing raw payloads.
- [W3C Cool URIs](https://www.w3.org/Provider/Style/URI)
  reinforces stable, implementation-independent identifiers. The runtime
  inventory uses durable policy-domain names instead of roadmap sequencing
  labels.

## Recommendations

1. **Inventory before wiring.**
   Do not connect policy evidence/readiness into runtime classification until
   current runtime artifacts have keep, rewrite, replace, or delete decisions.

2. **Guard critical runtime surface coverage.**
   The inventory should fail when route entrypoints, second-pass diagnostics,
   metadata enrichment, pending notification, classification, routing, or
   persistence surfaces are missing from the cutline. The runtime-entry stage
   itself is mandatory, so a route can never be silently reclassified as only
   a downstream decision or routing concern.

3. **Separate queue dispatch from retry.**
   The queue service, worker loop, task processor, queue mutation service, and
   scheduled retry driver are distinct decision-bearing runtime surfaces. The
   inventory must require them, classify the worker loop as a retained lifecycle
   primitive, and mark dispatch, mutation, and scheduled retry paths for
   rewrite around current automation decisions.

4. **Guard runtime contract surface coverage.**
   Runtime/rebuild contracts that replace old behavior must also be listed as
   inventory artifacts. A new contract service without an explicit cutline
   decision should fail inventory before later runtime wiring proceeds.

5. **Require authority sources.**
   Every runtime artifact must identify whether it is driven by observed media
   server contents, declared operator intent, manual outcome, AI output,
   metadata evidence, or legacy template compatibility. Values outside the
   server-owned vocabulary must fail validation rather than becoming an
   implicit authority source.

6. **Separate classification from routing.**
   Missing Arr mapping or failed Arr push must become a distinct runtime state,
   not a silent classification success.

7. **Replace known bad question paths.**
   Genre-priority prompts, AI invalid-response prompts, AI disagreement prompts,
   and pending resolution flags that generate rules must be routed through the
   policy question contract and policy learning guard.

8. **Keep AI/RAG as evidence.**
   AI explanations, RAG neighbors, and provider metadata can support evidence
   quality, but they cannot own final destination intent or durable learning.

## Pros And Cons

Pros:

- Prevents runtime wiring through unclear runtime paths.
- Catches critical runtime surface drift when new route or decision-facing
  files are added without a cutline decision.
- Makes known question and routing risks explicit.
- Preserves useful runtime primitives such as Arr executors, outcome ledger,
  profile sync, and bounded event persistence.
- Creates a stable handoff to runtime evidence projection.
- Makes queue dispatch and retry entrypoints auditable before they can be
  rewired to policy automation decisions.

Cons:

- Does not change runtime classification behavior by itself.
- Adds a broad inventory that must be maintained as runtime paths change.
- Requires intentional updates when classification route or metadata surfaces
  are renamed.
- Does not delete legacy signal or question code yet.
- Does not alter queue processing, retry scheduling, or routing behavior.

## Final Recommendation Stack

- Runtime inventory service:
  `server/src/services/policyRuntimeDecisionInventory.mjs`
- Runtime inventory tests:
  `server/src/__tests__/services/policyRuntimeDecisionInventory.test.mjs`
- Documentation:
  `docs/architecture/policy-runtime-decision-inventory.md`
- Module cutover:
  `docs/architecture/policy-runtime-decision-inventory-module-cutover.md`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `POLICY_RUNTIME_DECISION_IDS`
- `POLICY_RUNTIME_STAGE_IDS`
- `POLICY_RUNTIME_RISK_IDS`
- `POLICY_BAD_QUESTION_PATH_IDS`
- `listPolicyRuntimeArtifacts`
- `listPolicyBadQuestionPaths`
- `listPolicyRequiredRuntimeSurfacePaths`
- `listPolicyRequiredQueueDispatchSurfacePaths`
- `listPolicyRequiredRuntimeContractSurfacePaths`
- `validateRuntimeArtifact`
- `buildPolicyRuntimeDecisionInventory`

The inventory payload uses:

```text
version = policy.runtime_decision_inventory.v1
stepId = runtime_decision_inventory
nextStep.stepId = runtime_evidence_projection
```

Inventory decisions:

- `keep_runtime_engine_primitive`
- `rewrite_around_policy_contracts`
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
- queue dispatch,
- queues and retry paths.

Known bad question paths:

- genre-priority questions,
- AI invalid-response questions,
- AI disagreement questions,
- pending resolution `generate_rule` behavior.

Required runtime surface coverage includes:

- classification route entrypoints,
- pending and correction routes,
- second-pass diagnostic routes,
- classification orchestration,
- AI/RAG/question paths,
- routing and persistence paths,
- metadata enrichment paths,
- Discord pending notification rendering.

Required queue-dispatch surface coverage includes:

- queue service and worker-loop lifecycle,
- classification task processor,
- manual queue mutation operations,
- scheduled retry operations.

Required policy runtime/rebuild contract surface coverage includes:

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
- Runtime route-entry coverage cannot fall out of the inventory silently.
- Policy runtime/rebuild contracts cannot fall out of the inventory silently.
- Queue dispatch and retry surfaces cannot fall out of the inventory silently.
- Queue dispatch paths explicitly flag stale-decision replay and
  classification/routing-conflation risks before runtime wiring changes.
- AI/RAG/provider output is not treated as final authority.
- Unknown authority identifiers are rejected by focused regression coverage.
- Learning side effects are flagged for policy learning guard wiring.
- Routing success and classification success are separated as a required
  follow-up contract.

## Next Step

Continue with **Runtime Evidence Projection Architecture Cutover** so the next
runtime boundary also uses durable naming and consumes this inventory
deliberately.
