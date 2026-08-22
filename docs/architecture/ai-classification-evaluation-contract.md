# Local AI Classification Evaluation Contract

Status: Step 1 implemented on 2026-08-22. This document defines the fixture
and deterministic-grading foundation; it does not yet run a live model or
change routing behaviour.

## Objective

Classifarr's local policy-to-AI sweep already proves that a configured local
stack can submit media, process its queue, reach the AI path, and persist
classification history. A response with the right JSON shape is not enough to
prove a correct classification, however. This component supplies the explicit
success criteria that a later live harness will use to determine whether a
classification result is correct for the current policy.

The contract lets a policy owner state one or more acceptable outcomes for a
media fixture. A normal classified outcome includes a destination library,
confidence range, accepted classification methods, and allowed persisted
history statuses. Clarification and retry outcomes are supported as explicit
alternatives rather than being silently accepted as successful classifications.

## Official-Source Research

Research was performed on 2026-08-22 using the current official sources below.

- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  recommends task-specific evals, representative data, automated scoring, and
  calibration against human judgment. It also notes that classification and
  scoring against specific criteria are more reliable evaluation shapes than
  open-ended generation. This directly supports a policy-owner-authored,
  structured expected-outcome contract.
- The same guide records that OpenAI's hosted Evals platform becomes read-only
  on 2026-10-31 and is scheduled to shut down on 2026-11-30. Classifarr must
  therefore keep its core evaluation logic local, provider-neutral, and
  executable without a hosted evaluation dependency.
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) provides
  a stable, versioned schema dialect and publishes its official meta-schema.
  The repository includes a Draft 2020-12 machine-readable fixture schema, as
  well as an application validator that enforces the same security-critical
  restrictions at runtime.
- [OWASP WSTG-BUSL-01: Business Logic Data Validation](https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation)
  requires logically valid data at every handoff, not only at the frontend.
  The grader consequently checks both the bounded classification response and
  its persisted history outcome instead of trusting one layer alone.

## Options Considered

### Keep contract-only health checks

Pros:

- no additional fixture authoring work;
- the existing sweep remains very simple.

Cons:

- a well-formed but incorrect library decision can pass;
- fallback, clarification, and retry outcomes cannot be distinguished from
  actual classification quality;
- no durable definition of expected policy behaviour exists.

Decision: rejected.

### Use a provider-hosted evaluation platform

Pros:

- managed run history and reports;
- can offer model-based judging for subjective future cases.

Cons:

- would require sending local media and policy evaluation inputs to another
  provider;
- cannot prove Classifarr's full local queue and persistence path;
- introduces provider lock-in and does not fit an Ollama-first local workflow;
- OpenAI's hosted Evals platform has a published 2026 shutdown timeline.

Decision: rejected for the system-of-record evaluation layer.

### Versioned local fixture contract and pure deterministic grader

Pros:

- makes policy-owner expectations explicit, reviewable, and testable;
- works with local models and requires no credentials, network access, or live
  AI invocation for unit tests;
- scores classification, clarification, and retry outcomes deterministically;
- detects disagreement between the AI result and persisted history;
- keeps raw prompts, raw provider responses, secrets, and routing controls out
  of the evaluation record.

Cons:

- fixtures need a knowledgeable policy owner to author and maintain them;
- a destination library name or identifier is deliberately installation- and
  policy-specific, so a generic public fixture corpus cannot be treated as
  production truth;
- live execution and configuration fingerprints remain later work.

Decision: selected.

## Design

```text
Policy-owner fixture (versioned JSON)
        |
        v
Strict fixture validator ------> rejects unknown or contradictory fields
        |
        +------------------ bounded classification observation
        |                   + bounded persisted-history observation
        v
Pure deterministic grader -----> score + named checks + pass/fail
        |
        v
Later local AI sweep integration and fingerprinted report
```

The current implementation has no database, network, filesystem, prompt, model,
or routing dependency. It is deliberately a pure ESM service boundary. A later
adapter must project live API/history data into the bounded observation shape;
it must not pass through raw provider responses or prompts.

### Fixture contract

The canonical machine-readable schema is
[ai-classification-evaluation-fixture-v1.schema.json](../schemas/ai-classification-evaluation-fixture-v1.schema.json).
The runtime contract version is
`classifarr.ai_classification_evaluation_fixture.v1`.

Each fixture includes:

- a bounded stable ID, display name, and scenario tags;
- an exact TMDB media request (`tmdbId`, `mediaType`, and title);
- `fallbackAllowed`, which must be declared rather than inferred;
- one to four explicit expected outcomes.

Each outcome has an expected decision kind, accepted methods, and allowed
persisted history statuses. A `classified` outcome must also declare the exact
target library by ID, name, or both and an inclusive confidence range. A
`clarification` or `retry` outcome may not include a library or confidence
expectation, preventing a configuration author from creating a contradictory
test case.

Example:

```json
{
  "version": "classifarr.ai_classification_evaluation_fixture.v1",
  "id": "clear-mainstream-movie",
  "name": "Clear mainstream movie",
  "tags": ["happy-path", "movie"],
  "request": {
    "tmdbId": 550,
    "mediaType": "movie",
    "title": "Fight Club"
  },
  "expected": {
    "fallbackAllowed": false,
    "outcomes": [
      {
        "decisionKind": "classified",
        "methods": ["ai"],
        "historyStatuses": ["completed"],
        "library": { "id": 7, "name": "Movies" },
        "confidence": { "minimum": 80, "maximum": 100 }
      },
      {
        "decisionKind": "clarification",
        "methods": ["policy_engine"],
        "historyStatuses": ["awaiting_decision"]
      }
    ]
  }
}
```

The values above are illustrative. A production fixture must name the library
and exact acceptable outcome for the local policy configuration it evaluates.

### Grading behaviour

The grader receives only this bounded observation:

```js
{
  classification: {
    method: 'ai',
    confidence: 91,
    library: { id: 7, name: 'Movies' },
    needsClarification: false,
    needsRetry: false,
  },
  history: {
    method: 'ai',
    status: 'completed',
    confidence: 91,
    library: { id: 7, name: 'Movies' },
  },
}
```

It evaluates every declared alternative, selects the closest one for diagnostic
purposes, and passes only if one alternative and every global check pass. The
global checks reject an undeclared `fallback` method and verify that method,
confidence, and library values agree between the classification response and
the persisted history row. The emitted result exposes only bounded identifiers,
status values, confidence values, and target-library selectors; it never
retains the title, prompt, raw response, policy text, credentials, or a routing
command.

## Implementation Outcome

Three focused ESM services now own separate responsibilities:

- `server/src/services/aiClassificationEvaluationContractShared.mjs` owns
  bounded JSON primitives and shared allowlist rules.
- `server/src/services/aiClassificationEvaluationFixtureContract.mjs` validates
  fixtures, including invalid TMDB IDs, unsupported history statuses, and
  contradictory outcome constraints.
- `server/src/services/aiClassificationEvaluationObservationContract.mjs`
  validates the bounded classification and persisted-history projection, and
  rejects raw provider response fields.
- `server/src/services/aiClassificationEvaluationGrader.mjs` contains the pure
  scoring logic. It has no side effects and reports named checks, matched
  outcome index, score, and final pass/fail state.

The corresponding focused unit tests cover valid contracts, field injection,
raw-provider-response rejection, successful classification, library/history
mismatch, an allowed clarification alternative, undeclared fallback rejection,
and malformed input. The existing `test:local:ai-policy-sweep` remains
unchanged in this step, so no live media requests or Docker state are needed to
verify the new core.

## Security Properties

- Both fixture and observation objects are allowlisted at every level and
  reject unexpected fields instead of silently preserving them.
- Titles and library names are bounded and reject control characters; IDs,
  methods, tags, media types, confidence values, and statuses use constrained
  domains.
- The contract accepts only plain JSON-like objects. It does not execute
  fixture content, evaluate expressions, resolve paths, or deserialize custom
  object prototypes.
- Evaluation is read-only. It cannot alter policy configuration, call a model,
  route media, mutate history, or authorize a release.
- The future live adapter is a deliberate trust boundary: it must use scoped
  local-sweep authentication and reduce live results to the documented safe
  observation projection.

## Final Recommendation Stack

1. Treat versioned, policy-owner-reviewed fixture outcomes as the source of
   truth for automated scoring. Include routine, collision, ambiguity,
   clarification, retry, and adversarial cases as the corpus grows.
2. Keep the core validator and grader local, pure, provider-neutral, and
   deterministic. Use human policy review to calibrate any future automated or
   model-based judge; never replace explicit destination expectations with a
   second model's opinion.
3. In the next step, construct fingerprints from the validated fixture,
   policy-relevant configuration, provider/model identity, and bounded outcome.
   A fingerprint makes comparable runs auditable; it does not decide whether a
   classification is correct.
4. Then adapt `test:local:ai-policy-sweep` to project its live response and
   history record into this contract, grade it, and emit the fingerprinted
   report while retaining its current no-route guardrail and cleanup path.
5. Run deterministic contract/grader tests in CI. Run real local model sweeps
   only on an intentionally configured Docker/Ollama stack, then compare
   reviewed reports rather than treating a one-off green run as a release
   authorization.
