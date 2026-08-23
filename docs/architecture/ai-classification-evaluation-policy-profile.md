# AI Classification Evaluation Policy Profile

Status: Implemented on 2026-08-22. This document records the local,
policy-owner-reviewed extension for installation-specific AI classification
evaluation fixtures.

## Objective

The checked-in default cohort deliberately tests portable ambiguity and
clarification outcomes. It must not claim that every Classifarr installation
routes a title to the same library with the same confidence. That would expose
local destination information and turn a valid policy difference into a false
failure.

The profile lets an operator add up to 32 local, versioned fixtures—such as one
reviewed final destination or a deliberately controlled retry case—without
committing them. It binds those expectations to the exact server-authored
policy-context fingerprint used during the review. A changed policy cannot
silently use the old expected outcome.

This is evaluation evidence only. A profile cannot configure a provider, alter
a policy, authorize a route, submit media by itself, deploy software, or approve
a release.

## Official-Source Research

Research was performed on 2026-08-22 using current primary sources.

- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  recommends scoped tests that reflect real tasks, include typical, edge, and
  adversarial cases, automate objective scoring, and remain calibrated with
  human judgement. Profiles make locally reviewed destination cases explicit
  rather than making a portable fixture pretend to be universal.
- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
  describes repeatable testing, evaluation, verification, and validation across
  model and integration stages, with documented objectives and independent
  review. The policy fingerprint makes the reviewed operational context
  explicit and testable.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises excluding secrets and commercially sensitive data, validating data
  from other trust zones, and protecting stored event data. Profiles are local
  ignored files, validate exact fields, and contribute only bounded metadata to
  reports.

## Options Considered

### Put local library expectations in the checked-in default corpus

Pros:

- no extra command-line option;
- straightforward deterministic grading.

Cons:

- library IDs, names, confidence ranges, and policy expectations are local;
- creates false failures on valid installations;
- increases the chance that local operational detail reaches Git history.

Decision: rejected.

### Permit an unpinned arbitrary local fixture file

Pros:

- flexible for fast experimentation;
- requires little implementation.

Cons:

- a policy edit can leave an old expected destination in use;
- results cannot distinguish model drift from policy drift;
- a local file can quietly grow into an unreviewed evaluation corpus.

Decision: rejected.

### Selected: validated local profile pinned to active policy context

Pros:

- supports exact local library and confidence expectations without publishing
  them;
- validates every embedded fixture using the existing strict versioned contract;
- refuses a stale policy context before model settings or media submission;
- preserves trend comparability because fixture and policy fingerprints change
  together;
- reports only profile version, fixture count, and bounded policy fingerprint.

Cons:

- profile owners must intentionally renew the profile after a policy change;
- the profile cannot safely manufacture a retry, fallback, or contamination
  condition; those require a separately controlled test environment;
- it is local evidence, not a universal product benchmark or release gate.

Decision: selected.

## Design

```text
ignored local profile                  server-authored current policy context
  fixture expectations                         bounded SHA-256 digest
           |                                             |
           v                                             v
strict profile validator ---> merged fixture document ---> exact binding check
           |                                             |
           +--------------------- reject on mismatch ----+
                                                         |
                                                         v
                                  normal no-route local sweep execution
```

`scripts/lib/aiPolicySweepFixtureProfile.mjs` owns the pure ESM profile
contract. A profile has exactly three fields:

```json
{
  "version": "classifarr.ai_policy_sweep_fixture_profile.v1",
  "policyContext": {
    "version": "classifarr.ai_classification_evaluation_policy_context.v1",
    "algorithm": "sha256",
    "fingerprint": "<64 lowercase hexadecimal characters>"
  },
  "fixtures": ["one to thirty-two versioned evaluation fixtures"]
}
```

The fixtures use the existing
`classifarr.ai_classification_evaluation_fixture.v1` contract. The profile
cannot carry an endpoint, token, prompt, provider output, policy document,
reviewer identity, free-form note, or unknown field.

`scripts/local-ai-policy-sweep.mjs` reads and validates the profile before any
authentication. It merges the profile with the normal fixture document, so the
existing full-document duplicate-ID and contract validation still applies. It
then obtains the normal read-only policy context. Before any model settings are
changed, no-route settings are toggled, or fixture is submitted, it requires
exact match of context version, SHA-256 algorithm, and fingerprint. A mismatch
terminates the run without execution side effects.

## Operator Procedure

1. Run the portable default cohort locally and review the desired final
   destination or controlled retry behavior with the policy owner.
2. Copy
   `scripts/fixtures/ai-policy-sweep.policy-profile.example.json` to an ignored
   `.tmp/` location. Replace the example title, destination, confidence range,
   and all-zero policy fingerprint; do not add credentials or notes.
3. Use the `preflight.policyContext` from the reviewed local report as the
   profile's policy-context value. Keep the default no-route guardrail enabled.
4. Run the local sweep with `--fixture-profile <ignored-profile-path>`. If the
   active policy fingerprint changed, stop, review the policy change, and create
   a new profile rather than bypassing the mismatch.

   ```powershell
   node scripts/local-ai-policy-sweep.mjs `
     --fixture-profile ".tmp/ai-policy-sweep.policy-profile.json"
   ```

   On Windows PowerShell with npm 12, use this direct ESM invocation instead of
   an `npm run` alias because npm can intercept `--fixture-profile`.

5. Compare only matching trend cohorts. The fixture and policy fingerprints
   make changed profile context a new reviewed cohort, not a regression.

## Security Properties

- The profile lives under ignored `.tmp/`; the checked-in file is a deliberately
  non-runnable example with an all-zero policy fingerprint.
- Validation rejects malformed JSON shapes, unknown fields, invalid hashes, and
  invalid embedded fixtures before local authentication.
- Duplicate versioned fixture IDs fail the combined-document validation, so a
  profile cannot replace a portable expectation by shadowing its ID.
- The policy match happens before settings writes, no-route toggles, or media
  submissions. No database schema, server route, service credential, or CI
  capability is added.
- Fallback, existing-media, and source-library contamination remain failures in
  normal quality cohorts. They must not be allowed merely to improve an
  evaluation score.

## Implementation Outcome

- `scripts/lib/aiPolicySweepFixtureProfile.mjs` provides modular profile
  validation, merge metadata, and policy-binding verification.
- `scripts/local-ai-policy-sweep.mjs` adds `--fixture-profile` and
  `CLASSIFARR_FIXTURE_PROFILE`, while preserving default behavior when no
  profile is supplied.
- `scripts/fixtures/ai-policy-sweep.policy-profile.example.json` gives an
  explicitly non-runnable local starting point.
- Focused tests cover valid profiles, bounded report metadata, invalid profile
  input, duplicate fixture IDs, and exact policy-context matching.

## Final Recommendation Stack

1. Keep portable reviewed ambiguity fixtures in source control; place
   installation-specific destination expectations only in a local profile.
2. Pin every local profile to the policy context that the policy owner reviewed.
   On a mismatch, stop and review—never bypass or reinterpret it as model drift.
3. Keep fallback disabled in normal scored outcomes and treat contamination as a
   failed precondition, not a route or a success case.
4. Use controlled, disposable local environments for retry and contamination
   exercises. Record their results as human-reviewed evidence, never as CI
   release authority.
5. Compare profile runs through the existing trend baseline only within matching
   fixture, policy, runtime, and witness cohorts.

## Next Recommended Item

Create a controlled local fault-injection harness for the retry and
contamination safety paths. It should use a disposable test setup, assert the
expected `pending_retry` or contamination failure evidence, and never make
fallback a passing release condition.
