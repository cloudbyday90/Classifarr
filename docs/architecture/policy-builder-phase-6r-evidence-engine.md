# Policy Builder Phase 6R Evidence Engine

## Status

Implemented as the first Phase 6R engine contract.

This slice creates a server-owned evidence vocabulary and deterministic
projection helper. It does not wire runtime classification, learning, routing,
native intent storage, or UI changes. Those remain later Phase 6R/7R/8R work.

## Problem

The previous Phase 6 direction exposed too many implementation diagnostics in
the policy builder: replay preview, impact preview, provider readiness, TMDB
coverage, parity panels, and scoring internals. That made operators reason
about tools instead of destination meaning.

Phase 6R.1 starts the replacement engine by answering one narrower question:

```text
What does Classifarr know about this destination, and which authority source
supports each piece of evidence?
```

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  frames trustworthy AI systems around risk-managed design, evaluation, and
  trustworthiness considerations. For Classifarr, AI and provider output should
  be evidence inputs or suggestions, not policy authority.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)
  emphasizes secure development practices, risk-based prioritization, tracking
  security requirements, and provenance. The evidence engine therefore records
  source authority and strips raw/transient provider payloads.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for secure web application control verification. The design
  keeps server-side validation and audited contracts as the boundary instead of
  trusting client/UI state.
- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  define spans, attributes, events, and context propagation. Phase 6R.1 does
  not adopt telemetry, but each evidence bucket now has a stable trace attribute
  so later decision tracing can map evidence without renaming the model.

## Recommendations

1. **Use a server-owned evidence vocabulary.**
   The evidence buckets are:
   - identity evidence,
   - compatibility evidence,
   - hard-limit evidence,
   - avoid evidence,
   - outlier evidence,
   - routing evidence,
   - freshness evidence,
   - insufficient evidence.

2. **Keep source authority explicit.**
   Evidence entries must identify their source and authority source. Operator
   declared intent is the only source allowed to create hard-limit or avoid
   evidence.

3. **Strip provider and UI implementation details.**
   Evidence projection must not expose raw provider payloads, live lookup state,
   provider quota/cooldown state, replay payloads, impact-preview payloads, or
   UI chip labels.

4. **Stay offline and deterministic.**
   Phase 6R.1 evidence projection uses cached/provided inputs only. It never
   performs live TMDB or other provider calls.

5. **Make the contract auditable.**
   The server exposes an audit that fails when future changes allow metadata to
   own identity, final outcomes to learn directly, live lookups inside evidence
   projection, or raw/transient payload leakage.

## Pros And Cons

Pros:

- Creates a small engine primitive instead of another policy-builder panel.
- Gives Phase 6R.2 a stable input model for intent suggestions.
- Keeps server-side authority explicit and testable.
- Makes provider data useful without making provider state the product model.
- Avoids live API calls in policy-building evidence projection.

Cons:

- This is not yet a full profile reducer for all current library data.
- Existing replay/impact reducers are not deleted in this slice.
- Runtime classification still uses current paths until Phase 7R integration.
- Native storage waits until Phase 8R after engine contracts prove stable.

## Final Recommendation Stack

- Server module:
  `server/src/services/policyBuilderPhase6EvidenceEngine.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6EvidenceEngine.test.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-6r-evidence-engine.md`
- Roadmap owner:
  Phase 6R.1 Evidence Engine in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The server module exports:

- evidence bucket IDs,
- evidence source IDs,
- prohibited payload IDs,
- an evidence projection builder,
- an evidence projection audit for generated/tampered contract instances,
- bucket/source lookup helpers,
- bucket/source validation helpers,
- a full evidence-engine audit.

The projection entry shape is intentionally small:

```text
bucketId
sourceId
authoritySourceId
key
label
value
count
confidence
reasonCode
observedAt
stale
includesRawPayload = false
liveLookupPerformed = false
```

This shape is safe to pass into future intent/readiness work without exposing
raw provider payloads or UI-specific labels.

The projection audit validates the generated instance after construction. It
fails when a projection:

- marks itself as generated from live provider data,
- exposes raw provider payloads or UI chip language,
- contains unknown buckets, sources, or authority sources,
- lets a source populate a bucket it is not allowed to own,
- lets metadata enrichment own destination identity,
- lets hard-limit or avoid evidence bypass operator-declared intent,
- contains individual entries that claim raw payloads or live lookup behavior.

## Security Outcome

- Live provider calls are prohibited in evidence projection.
- Raw provider payloads are not copied into projection entries.
- Generated projections are independently auditable so future code cannot
  bypass the constructor by mutating or assembling unsafe evidence entries.
- Provider quota/cooldown state is not evidence.
- Manual outcomes can describe evidence, but cannot create learning directly.
- Hard limits and avoid evidence require operator-declared intent.
- Trace attributes are stable strings and contain no sensitive values.

## Next Step

Proceed to **Phase 6R.2 Intent Engine**. That component should consume these
evidence buckets and produce proposed destination intent with assumptions,
warnings, confidence, and review needs while keeping inferred evidence separate
from operator-declared constraints.
