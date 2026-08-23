# Reviewed Local AI Classification Fixture Cohort v1

Status: Implemented on 2026-08-22. This document records the reviewed,
installation-specific expected outcomes that turn the default local AI sweep
from a transport check into a deterministic classification evaluation. It does
not authorize routing, production deployment, policy changes, or releases.

## Objective

The local sweep has already shown that four non-library media requests reach
the queue, classification worker, AI path, decision witness, and persisted
history. Their prior fixture entries were legacy health checks, so a different
but well-formed decision could pass without a quality signal. This cohort pins
the currently reviewed clarification behavior for those exact requests.

## Official-Source Research

Research was repeated on 2026-08-22 using current primary sources.

- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  recommends scoped, task-specific evals that reflect real distributions,
  automated scoring, human calibration, and continuous evaluation. It
  specifically identifies classification and scoring against clear criteria as
  more reliable than open-ended generation. The cohort uses fixed decision
  classes, methods, and persisted statuses, all reviewed from a successful
  local run.
- [OpenAI's eval workflow guidance](https://developers.openai.com/api/docs/guides/evals)
  describes the sequence of defining expected behaviour, running structured
  test inputs, analysing results, and iterating. It also publishes the hosted
  Evals deprecation timeline, reinforcing that Classifarr's system-of-record
  evaluation must remain local and provider-neutral.
- [OWASP's Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends excluding access tokens, secrets, sensitive personal data, and
  commercially sensitive information from logs. Cohort fixtures contain only
  public media identifiers and bounded expected outcomes; reports retain
  fingerprints and allowed observation fields, not prompts, API keys, raw
  provider output, or raw policy documents.

## Options Considered

### Keep all default fixtures legacy-only

Pros:

- portable across arbitrary installations;
- no reviewed policy expectation to maintain.

Cons:

- tests only transport and record persistence;
- a changed classification method or missing clarification can still look
  green;
- no local trend data is usable as a quality baseline.

Decision: rejected for the four already-reviewed local scenarios.

### Encode exact destination libraries and confidence intervals in the portable corpus

Pros:

- stricter pass condition for classified results;
- useful for an installation where routing to a library is the intended
  result.

Cons:

- these collision and ambiguity scenarios deliberately require human review;
- destination IDs and names are installation-specific and would make the
  default cohort misleadingly non-portable;
- it would test an outcome the current policy explicitly avoids.

Decision: rejected for the portable corpus. The selected local
[policy-profile design](ai-classification-evaluation-policy-profile.md) lets a
policy owner add reviewed classified cases without publishing installation
library details or allowing a stale expectation to silently run.

### Versioned clarification cohort with method and history checks

Pros:

- verifies the decision kind, no-fallback behavior, decision path, and
  independently persisted status;
- preserves the safe no-route intent for ambiguous media;
- produces comparable fixture, policy, runtime, witness, and outcome
  fingerprints;
- requires no provider API, cloud evaluator, or secret in a test fixture.

Cons:

- it is intentionally tied to the reviewed policy fingerprint rather than
  universal product truth;
- a legitimate policy change requires a human to revise the expected outcome;
- it does not yet measure a positive routed-library decision.

Decision: selected.

## Cohort Design

The default fixture document remains a mixed-format array for compatibility:
ten existing entries are legacy health-only checks, and four entries use
`classifarr.ai_classification_evaluation_fixture.v1`. Before authentication or
any live request, `scripts/lib/aiPolicySweepFixtureDocument.mjs` validates the
entire document. It fails closed on malformed entries, unknown legacy fields,
unsupported versioned contracts, and duplicate versioned IDs.

| Fixture ID | Scenario | Expected decision | Method | Persisted status |
| --- | --- | --- | --- | --- |
| `local-ambiguity-deep-water-2006` | Ambiguity cluster | clarification | `ai_analysis` | `awaiting_decision` |
| `local-remake-crash-1996` | Remake collision | clarification | `ai_analysis` | `awaiting_decision` |
| `local-remake-crash-2005` | Remake collision | clarification | `policy_engine` | `awaiting_decision` |
| `local-name-collision-office-uk` | Name collision | clarification | `policy_engine` | `awaiting_decision` |

Every versioned entry declares `fallbackAllowed: false`. The existing grader
also requires the task-bound queued decision witness and persisted history to
agree on method and applicable library projection. A queued clarification
witness intentionally has no final confidence or destination, so the grader
records its confidence comparison as not applicable rather than fabricating a
value from history. The cohort deliberately does not invent a destination or
add a brittle confidence range.

## Implementation Outcome

- Converted the four reviewed local-sweep entries in
  `scripts/fixtures/ai-policy-sweep.fixtures.json` into versioned expected
  outcomes.
- Added an ESM fixture-document validator that runs before token exchange or
  media submission and exposes a document-level versioned-fixture count in the
  report.
- Made unsupported `version` values fail closed as invalid evaluation
  candidates instead of silently degrading to legacy, ungraded fixtures.
- Added focused tests that protect the default four-fixture cohort and its
  fail-closed document-validation behavior.
- Added a local profile extension for policy-owner-reviewed destination and
  controlled retry fixtures. The profile is validated before authentication,
  then must match the server-authored active policy-context fingerprint before
  the sweep changes settings or submits media.

## Security Properties

- The checked-in corpus has no credentials, endpoints, policy terms, library
  names, raw AI output, or routing authority.
- Validation accepts plain JSON records only and uses bounded text, positive
  IDs, and allowlisted keys before any local authentication action.
- A report retains only the already-bounded evaluation projection and hashes;
  the raw decision witness is not exported by this cohort definition.
- The local sweep's scoped token, no-route guardrail, ETag-protected temporary
  AI-settings change, and report-driven cleanup remain required controls.

## Final Recommendation Stack

1. Run the reviewed four-fixture cohort after local policy, model, or worker
   changes, and compare only matching policy/runtime fingerprint cohorts.
2. Add one reviewed positive classified fixture through the local
   [policy-profile workflow](ai-classification-evaluation-policy-profile.md),
   with an exact destination selector and conservative confidence range after a
   policy owner confirms the desired destination.
3. Keep ambiguous cases as clarification tests; do not weaken them into a
   fallback or route merely to increase a pass rate.
4. Expand the corpus with representative, edge, and adversarial scenarios,
   but review each expected outcome and never place secrets or raw model input
   in the fixture file or report.

## Next Recommended Item

Use a policy-pinned local profile to record one reviewed final destination.
The deterministic [fault-scenario harness](ai-classification-evaluation-fault-scenarios.md)
now verifies the evaluation contract's retry and contamination semantics; next,
add a disposable Docker Compose provider-stub exercise that validates one real
queue retry without normalizing fallback into a passing quality outcome.
