# Policy Builder Phase 8R Validation Evidence Generator

## Intent

Phase 8R closure requires machine-readable validation evidence for four
checkpoint categories:

- focused Phase 8R tests,
- server lint,
- markdown validation,
- full server validation.

The validation evidence generator runs those fixed commands, records bounded
command results, and emits JSON that can be supplied to
`npm run policy:phase8r:evidence`.

This is closure tooling, not a runtime path. It does not change policy storage,
policy behavior, compatibility removal, or checkpoint semantics.

## Official-Source Research

- NIST SP 800-218 SSDF recommends verifying software against requirements and
  maintaining evidence that verification activities were performed. This
  generator applies that by turning validation command results into
  machine-readable evidence rather than relying on narrative claims.
- OWASP SAMM verification guidance treats repeatable verification activities as
  part of assurance maturity. This generator makes the validation set
  repeatable and auditable.
- SLSA artifact verification guidance emphasizes inspecting and verifying
  artifacts before trusting them. This generator produces a validation artifact
  that the Phase 8R evidence runner can inspect.
- Node.js `child_process.spawn` is the official API for running child
  processes. The generator uses fixed command specs and array arguments instead
  of constructing user-controlled shell strings.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP SAMM Verification:
  <https://owaspsamm.org/model/verification/>
- SLSA verifying artifacts:
  <https://slsa.dev/spec/v1.0/verifying-artifacts>
- Node.js child process API:
  <https://nodejs.org/api/child_process.html>

## Recommendations

### Use Fixed Validation Commands

The generator should run a fixed command list owned by the repository, not
accept arbitrary command strings from users.

Pros:

- avoids command injection,
- keeps closure evidence consistent,
- makes generated JSON comparable across local and CI runs.

Cons:

- adding or changing validation gates requires code changes.

### Keep Evidence Bounded

Record command, pass/fail state, exit code, signal, duration, timestamps, and a
bounded failure message. Do not store full command logs in the evidence JSON.

Pros:

- lowers risk of leaking environment details,
- keeps artifacts readable,
- preserves enough data for the checkpoint to make a decision.

Cons:

- detailed debugging still requires command logs.

### Separate Generation From Closure Evaluation

The generator runs commands and emits JSON. The Phase 8R evidence runner
continues to decide whether closure is allowed.

Pros:

- keeps evaluation deterministic,
- avoids mixing command execution with checkpoint logic,
- allows CI or local workflows to regenerate validation evidence independently.

Cons:

- requires two closure steps: generate validation JSON, then run the evidence
  checkpoint.

## Final Recommendation Stack

Use this stack for Phase 8R validation evidence:

1. Define fixed validation command specs in a service module.
2. Run commands from a root script with array arguments and no shell string
   construction.
3. Continue running later checks after failures by default so the output shows
   all broken gates.
4. Emit checkpoint-compatible JSON with `focused`, `lint`, `markdown`, and
   `full` entries.
5. Optionally write the JSON to `.tmp/phase8r/validation-evidence.json`.
6. Keep the Phase 8R evidence runner responsible for final closure decisions.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8ValidationEvidence.mjs`.
- Added `generate-policy-builder-phase-8r-validation-evidence.mjs`.
- Added root npm script `policy:phase8r:validation-evidence`.
- Added focused tests for:
  - successful validation evidence,
  - command string formatting,
  - failed command metadata,
  - missing command results,
  - unknown check IDs,
  - reported file/storage/Git side effects.

Validation command set:

- `focused`: focused Phase 8R Jest suites for current evidence, evidence run,
  checkpoint, and completion audit contracts.
- `lint`: server lint.
- `markdown`: changelog and Phase 8R architecture markdown lint.
- `full`: full server unit and integration test suites.

Current-state run:

- `npm run --silent policy:phase8r:validation-evidence -- --output .tmp/phase8r/validation-evidence.json`
  completed with `statusId: passed`, `passedCount: 4`, `checkCount: 4`, and
  `riskCount: 0`.
- Feeding that JSON into `npm run --silent policy:phase8r:evidence -- --validation-evidence .tmp/phase8r/validation-evidence.json`
  cleared the validation blockers.
- The Phase 8R closure run now blocks only on missing machine-readable Phase
  8R.21 final-removal-audit evidence.

Example:

```bash
npm run --silent policy:phase8r:validation-evidence -- \
  --output .tmp/phase8r/validation-evidence.json
```

Then pass the generated file into the closure evidence run:

```bash
npm run --silent policy:phase8r:evidence -- \
  --validation-evidence .tmp/phase8r/validation-evidence.json
```

## Next Step

Add the machine-readable Phase 8R.21 final-removal-audit evidence export so the
evidence runner has both missing closure inputs: validation JSON and
final-removal-audit JSON.
