# Redacted Reviewed-Corpus Capture Outcome

## Delivered

Classifarr now has a future-only reviewed-corpus capture path for eligible
runtime policy-question outcomes.

- An administrator enables the pre-existing safeguard control once and chooses
  a 7–90 day retention limit.
- A later locally authenticated operator confirmation/correction is captured
  automatically only when the server has already validated the runtime answer
  and produced the strict policy-correction outcome attribution.
- The row retains fixed evidence-state categories, outcome category, retention
  configuration revision, timestamp, and numeric operator audit identity. It
  does not retain media, library, destination, policy, AI, RAG, or retrieval
  content.
- A locked daily job deletes expired rows and appends a minimal expiry audit
  event.
- Security Settings now describes this as automatic capture instead of a
  manual/future concept. Its concise status is a polite atomic live region;
  detailed information remains progressively disclosed.

## Runtime boundary

```text
browser policy answer
  -> server validates current signed answer contract
  -> server writes authoritative resolved outcome
  -> strict redacted attribution is admitted only with a numeric authenticated actor
  -> acknowledged safeguard control authorizes redacted capture
  -> daily retention removes expired rows
```

The capture is an evaluation artifact only. It does not change the policy
candidate, the deterministic policy score, confirmation/automatic thresholds,
AI verification, RAG retrieval, pattern learning, or routing. An invalid
attribution, unauditable actor, or unacknowledged configuration produces no
capture.

## Verification

- Targeted server suite: 211 tests passed, covering the capture contract,
  redaction boundary, retention, migration, scheduler, resolver integration,
  pending route, and container heap-cap guard.
- Full server validation passed: type check, lint, 1,014 suites, and 28,183
  tests.
- Full client validation passed: type check, lint, 311 files, 4,192 tests,
  and production build.
- The PostgreSQL 18 disposable-container snapshot dump and drift check both
  passed from a clean application/database startup.
- The clean startup also revealed and fixed a Docker Desktop cgroup-unlimited
  sentinel that otherwise produced an invalid Node.js heap cap, plus a
  PostgreSQL check-constraint name collision in the new migration.

## Current RAG/AI readiness

The committed semantic counter-evidence evaluator remains **not ready** for a
live RAG or AI routing role: it currently has 8 fixtures against a 24-fixture
minimum, 66.7% precision against 95%, 50% recall against 90%, and one false
positive where the acceptance profile allows none. This is expected and is a
safety result, not a degradation: the new capture path collects future,
privacy-bounded operator outcome categories for the next offline evaluator;
it does not hide these existing readiness blockers or raise a policy score.
- The public GitHub pull-request API reported zero open pull requests at the
  time of implementation. Therefore no random open PR could be selected or
  implemented locally without misrepresenting repository state.

## Follow-up recommendation

Build the **offline reviewed-corpus evaluator** next. It should use only this
redacted future corpus to measure candidate/RAG/model proposals by evidence
stratum and operator outcome, require an independent acceptance decision, and
remain unable to change live routing. A later semantic-adjudication workflow
would need a separate design and explicit approval before any title or
description context is accessed.
