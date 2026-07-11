# Classification RAG Loop Stage Naming Cutover

## Status

Implemented July 11, 2026.

## Decision

Rename the internal RAG lifecycle module from
`classificationRagLoopPhases.mjs` to `classificationRagLoopStages.mjs` and
rename its exports to:

- `runEnrichmentStage`
- `runPass2RetrievalStage`
- `runPolicyRecheckStage`
- `runAiRerunStage`

The application already records these operations as durable stage IDs:
`enrichment`, `retrieval_pass2`, `policy_recheck`, and `ai_rerun`. The module
and exports now match that operational vocabulary.

## Scope And Compatibility

This is a private ESM module with one repository-owned caller:
`classificationRagLoopService.mjs`. It has no route, database, configuration,
or published client contract. The rename therefore changes imports and symbols
directly instead of retaining phase-named aliases.

The following behavior is intentionally unchanged:

- execution order;
- retry and timeout limits;
- resilience-manager keys;
- persisted and emitted event `stage` values;
- RAG, metadata, policy, and AI decision behavior.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, unambiguous names and namespacing where useful. The
  operational stage is the stable meaning of this lifecycle boundary; the
  delivery phase that introduced it is not.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  supports traceable, risk-managed API changes. The cutover is limited to an
  internal contract, has focused import tests, and preserves external behavior.
- [Node.js ECMAScript Modules](https://nodejs.org/api/esm.html) documents static
  module resolution. The repository-owned importer is changed atomically with
  the module move, leaving no CommonJS bridge or runtime loader indirection.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Retain phase-named module and exports | No importer change | Leaves temporary roadmap language in production code | Rejected |
| Add alias exports for old names | Eases a hypothetical external migration | No external API exists; alias preserves naming debt | Rejected |
| Direct stage-named ESM cutover | Durable terminology, small reviewable diff, no dead bridge | Requires updating the only importer and focused tests | Selected |

## Verification

- The RAG lifecycle test asserts the durable export contract and rejects the
  retired export names.
- The runtime decision inventory requires the stage-named module and rejects
  the retired path.
- Existing RAG-loop service and integration tests cover the preserved runtime
  execution behavior.
- The production naming inventory and regression audit are re-run after the
  move; their baseline is lowered only after the measured count falls.

## Security Outcome

No authorization, database, network, secret, or input-validation behavior
changed. Removing unused compatibility aliases reduces the chance that future
production code imports delivery-term APIs or reintroduces an ambiguous
lifecycle contract.

## Next Step

Continue the production naming inventory with the next isolated production
surface that has no persisted or public compatibility obligation.
