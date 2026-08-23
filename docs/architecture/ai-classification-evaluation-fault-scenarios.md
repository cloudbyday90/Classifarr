# AI Classification Evaluation Fault-Scenario Harness

Status: Implemented on 2026-08-22. This document records the deterministic,
offline verification layer for retry, fallback, existing-media, and
source-library safety paths in the local AI-evaluation workflow.

## Objective

The local policy sweep checks real local request, queue, model, and persistence
behavior. Deliberately causing fallback or contamination in that environment
would require changing real media-server state or provider availability, which
is unsuitable for a routine verification step.

This harness instead injects four strictly validated synthetic observations into
the same deterministic evaluation grader used by the live sweep. It proves that
the evaluator accepts an intentional `pending_retry` outcome while detecting
fallback, `existing_media`, and `source_library` as negative safety evidence.

The harness makes zero HTTP requests, changes no application settings, submits
no media, calls no model, and writes no database records. Its only optional
output is a bounded local JSON report under ignored `.tmp/reports/`.

## Official-Source Research

Research was performed on 2026-08-22 using current primary sources.

- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  recommends scoped, task-specific tests, automated objective scoring, and
  typical, edge, and adversarial cases calibrated with human review. A
  deterministic scenario contract keeps fault detection measurable rather than
  relying on a vague manual observation.
- [AWS Fault Injection Service experiment planning](https://docs.aws.amazon.com/fis/latest/userguide/getting-started-planning.html)
  recommends starting in a controlled test environment, defining steady state,
  monitoring impact, and using explicit stop conditions. The first layer here
  has the strongest possible stop boundary: no external target exists. A later
  live fault exercise must retain explicit preconditions and cleanup.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends strict input validation, sanitization, and excluding secrets,
  tokens, and commercially sensitive information from logs. The harness
  validates an allowlisted JSON shape and reports only scenario IDs, named
  check IDs, and named fault signals.

## Options Considered

### Induce faults against a normal local media-server installation

Pros:

- exercises real provider, queue, and persistence behavior;
- may reveal integration defects beyond the evaluator.

Cons:

- can submit media, mutate temporary model settings, pollute history, or alter
  local provider availability;
- requires a disposable setup, monitoring, explicit stop conditions, and
  cleanup verification;
- a fallback test could be mistaken for a passing quality result.

Decision: deferred to a separate disposable-environment integration exercise.

### Add a permissive flag to the normal sweep

Pros:

- one command could cover normal and adverse paths;
- no additional fixture document.

Cons:

- creates a high-risk path close to a real local sweep;
- broad flags make it easy to bypass the no-route or no-fallback safety
  defaults;
- mixes model quality evidence with fault-injection authority.

Decision: rejected.

### Selected: offline deterministic fault-scenario contract

Pros:

- uses the production evaluation contract and deterministic grader;
- has zero application and network side effects;
- verifies both positive retry handling and negative fault detection;
- emits bounded, repeatable evidence that is safe to run before a live sweep.

Cons:

- does not prove a live provider outage is mapped to `pending_retry` by every
  deployment;
- synthetic observations cannot replace queue, model, database, or
  media-server integration testing.

Decision: selected as the safe first layer.

## Design

```text
checked-in synthetic scenario document
              |
              v
strict scenario + fixture + observation validation
              |
              v
existing deterministic evaluation grader
              |
              v
bounded named checks + fault signals + expected-verdict comparison
              |
              v
local report only (0 HTTP, 0 application writes, 0 media submissions)
```

`scripts/lib/aiPolicySweepFaultScenario.mjs` is the pure ESM contract module.
It accepts only this document shape:

```json
{
  "version": "classifarr.ai_policy_sweep_fault_scenario.v1",
  "scenarios": [
    {
      "id": "fault-controlled-retry",
      "fixture": "one versioned evaluation fixture",
      "observation": "one bounded classification/history observation",
      "expected": {
        "evaluationPassed": true,
        "failureCheckIds": [],
        "signalIds": []
      }
    }
  ]
}
```

Every scenario fixture ID must match its scenario ID. Unknown fields,
unsupported versions, invalid evaluation fixtures, invalid observations,
unrecognized signals, duplicate scenario IDs, and more than eight scenarios
fail validation before grading.

The checked-in document contains four synthetic cases:

| Scenario | Required outcome | Harness verdict |
| --- | --- | --- |
| `fault-controlled-retry` | `ai_analysis` plus `pending_retry` | passes: retry remains an explicit supported non-final outcome |
| `fault-fallback` | fallback instead of the expected AI retry | passes only when `fallback_not_allowed` is detected |
| `fault-existing-media-contamination` | `existing_media` instead of an expected clarification | passes only when the contamination signal and failed checks are detected |
| `fault-source-library-contamination` | `source_library` instead of an expected clarification | passes only when the contamination signal and failed checks are detected |

For the last three cases, a **harness** pass means the guard detected the
simulated negative condition. It never means fallback or contamination is an
acceptable classification result.

## Operator Procedure

Run the side-effect-free fault harness before a local live sweep:

```powershell
node scripts/verify-ai-policy-sweep-fault-scenarios.mjs `
  --output ".tmp/reports/ai-policy-sweep-fault-scenarios.json"
```

On Windows PowerShell with npm 12, use the direct ESM command shown above.
Npm can interpret `--output` as its own option and produce a no-op or CLI
error. The package alias `npm run test:local:ai-policy-sweep:faults` is useful
only when no script arguments are required.

Require all of the following before proceeding to a live sweep:

1. document validation succeeds;
2. all four scenario contracts pass;
3. the report confirms `networkRequests`, `applicationWrites`, and
   `mediaSubmissions` are all zero; and
4. the generated artifact remains local and is not attached to a public
   release or CI log.

## Security Properties

- The executable imports no HTTP client, authentication helper, environment
  credential, model provider, database client, or media-server adapter.
- Scenario validation allowlists fields and uses the existing strict fixture and
  observation contracts before any evaluation takes place.
- Reports intentionally omit fixture titles, request metadata, library names,
  observations, raw provider output, policies, tokens, endpoints, and error
  text. They contain only contract IDs, expected/actual booleans, named checks,
  and named fault signals.
- The harness has no option that can enable routing, contact a provider, or make
  fallback a passing live-quality outcome.
- The report is advisory local evidence. It cannot approve a release, model,
  deployment, route, policy change, or destination.

## Implementation Outcome

- `scripts/lib/aiPolicySweepFaultScenario.mjs` owns document validation, fault
  signal detection, deterministic grading, and expected-verdict comparison.
- `scripts/fixtures/ai-policy-sweep.fault-scenarios.json` supplies the four
  reviewed synthetic scenarios with no real media or local policy data.
- `scripts/verify-ai-policy-sweep-fault-scenarios.mjs` owns strict CLI parsing
  and bounded local report generation.
- `server/src/__tests__/scripts/aiPolicySweepFaultScenario.test.mjs` covers
  successful detection, non-disclosure, unknown data, version rejection, and
  verdict drift.
- `docs/local-ai-policy-sweep.md` and `.agent/workflows/release.md` now place
  the no-side-effect harness before optional local live-evaluation evidence.

## Final Recommendation Stack

1. Run the deterministic fault-scenario harness on every change to evaluation
   contracts, expected fixtures, fallback policy, or contamination handling.
2. Keep normal local sweep profiles strict: fallback, `existing_media`, and
   `source_library` remain negative quality signals.
3. Use the policy-pinned profile for reviewed positive destinations and normal
   retry expectations; do not encode local destinations in the portable fault
   document.
4. Before a release that changes provider recovery or queue behavior, run a
   separately designed disposable-environment integration exercise with
   explicit stop conditions and cleanup evidence.
5. Keep all live and offline reports local, bounded, and human-reviewed.

## Next Recommended Item

Build a disposable Docker Compose integration fixture that places a test-only
provider stub in front of the local AI path. It should inject one bounded,
observable provider failure, prove the real queue produces `pending_retry`,
verify no media route occurs, and clean up its own generated records. Do not
run it against a normal media-server installation.
