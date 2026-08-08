# Policy Storage Closure Validation Evidence

## Intent

Policy storage closure requires machine-readable validation evidence for the
fixed checks that prove the closure chain is safe to evaluate.

The validation evidence generator runs a bounded command set, captures command
status metadata, and emits JSON that downstream storage closure audits can
consume. It is a tooling path, not runtime classification logic. It does not
change policy storage, policy behavior, compatibility removal, or closure
decisions.

## Official-Source Research

- NIST SSDF recommends repeatable secure development practices and verification
  evidence across the software lifecycle. The generator turns validation command
  results into structured evidence instead of relying on narrative claims.
- NIST SP 800-128 frames configuration changes as controlled changes with
  traceable integrity evidence. The command set is fixed in source control so
  validation scope changes are reviewed as code changes.
- OWASP Logging Cheat Sheet recommends bounded, consistent event data. The
  generated JSON captures command, status, exit code, signal, duration,
  timestamps, and bounded failure context without embedding full logs.
- Node.js `child_process.spawn` is the official asynchronous child-process API.
  The generator uses fixed command specs and array arguments with `shell: false`
  instead of constructing user-controlled shell strings.
- Node.js documents that Windows `.cmd` launchers require shell handling. The
  generator therefore invokes npm's JavaScript CLI through `process.execPath`
  when it is available, keeping the command boundary shell-free for direct Node
  and Windows invocations.
- SLSA verification guidance recommends comparing supplied provenance with
  trusted expected values and rejecting unrecognized inputs. The v3 artifact
  uses a source-controlled command catalog as that expectation, then replays
  retained normalized input without executing commands.
- Node.js `crypto` provides the SHA-256 primitive used to bind the bounded
  artifact projection before a closure consumer accepts it.

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js child process API:
  <https://nodejs.org/api/child_process.html>
- SLSA artifact verification guidance:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- Node.js crypto API:
  <https://nodejs.org/api/crypto.html>

## Recommendations

### Use Fixed Validation Commands

The generator should run a fixed command list owned by the repository, not
accept arbitrary command strings from users.

Pros:

- avoids command injection,
- keeps closure evidence consistent across local and CI runs,
- makes validation scope changes reviewable.

Cons:

- adding or changing validation gates requires code changes.

### Keep Evidence Bounded

Record command, pass/fail state, exit code, signal, duration, timestamps, and a
bounded failure message. Do not store full command logs in the evidence JSON.

Pros:

- lowers risk of leaking environment details,
- keeps artifacts readable,
- preserves enough data for closure audits to make decisions.

Cons:

- detailed debugging still requires command output from the validation run.

### Separate Generation From Closure Evaluation

The generator runs commands and emits JSON. Storage closure audits decide
whether the evidence is acceptable.

Pros:

- keeps closure decision services deterministic,
- avoids mixing command execution with pure audit logic,
- allows CI and local workflows to regenerate validation evidence independently.

Cons:

- requires callers to generate validation JSON before running closure audits.

### Fingerprint And Replay Evidence

Retain normalized command results and side-effect input, bind the derived
artifact with SHA-256, and rebuild it in pure consumers before use.

Pros:

- rejects stale or altered validation summaries,
- catches a regenerated digest whose derived check state disagrees with input,
- keeps the checkpoint and current audit free of command execution.

Cons:

- increases artifact size modestly,
- requires current v3 evidence rather than legacy four-check summaries.

## Final Recommendation Stack

1. Use `policyStorageClosureValidationEvidence.mjs` as the fixed command
   specification and evidence builder.
2. Use `generate-policy-storage-closure-validation-evidence.mjs` as the CLI
   wrapper.
3. Expose `npm run policy:storage-closure-validation-evidence`.
4. Emit `policy.storage_closure_validation_evidence.v3` with a canonical
   command catalog, retained normalized input, and a versioned SHA-256 digest.
5. Run command specs with array arguments and `shell: false`.
6. Resolve npm and npx to their JavaScript CLI through the active or bundled
   Node distribution before falling back to the platform command path.
7. Continue running later checks after failures by default so output shows all
   broken gates.
8. Emit JSON with `focused`, `lint`, `markdown`, and `full` entries.
9. Reject unknown check IDs, duplicate results, invalid generation timestamps,
   and reported file/storage/Git side effects.
10. Require a pure fingerprint and replay verification before the completion
    checkpoint or current-closure audit consumes the evidence.

## Implementation Outcome

Implemented:

- Added `policyStorageClosureValidationEvidence.mjs`.
- Added `generate-policy-storage-closure-validation-evidence.mjs`.
- Added root npm script `policy:storage-closure-validation-evidence`.
- Added focused tests for:
  - successful validation evidence,
  - command string formatting,
  - failed command metadata,
  - missing command results,
  - unknown check IDs,
  - reported file/storage/Git side effects.
- Added a shell-free, cross-platform command-invocation service for direct Node
  and Windows validation runs. It resolves npm and npx through the active or
  Node-distribution JavaScript CLI when available.
- Updated the closure validation command set to include the renamed storage
  closure current audit, its fingerprint/replay integrity suite, and closure
  requirement audit suites.
- Updated the fixed focused and Markdown validation manifests to require the
  initial-establishment triage, transaction, readiness/recovery, route,
  integration, and closure-evidence records independently from legacy
  conversion coverage.
- Added the current-closure artifact-integrity design record to the fixed
  markdown validation manifest.
- Added v2 fingerprint and pure replay services. The completion checkpoint and
  current-closure audit now reject validation evidence that is legacy,
  malformed, altered, or not reproducible from retained bounded inputs.
- Advanced the artifact contract to v3 after closure-map reconciliation. Fixed
  focused validation now directly includes
  `policyStorageClosureComponentScopeMap`, and fixed Markdown validation
  includes [Policy Closure-Map Reconciliation](policy-closure-map-reconciliation.md).
  Fresh evidence therefore binds the repository versus active-installation
  boundary before a current closure audit can consume it.

Example:

```bash
npm run --silent policy:storage-closure-validation-evidence -- \
  --output .tmp/policy-storage/validation-evidence.json
```

## Security Boundary

The SHA-256 field provides workflow-integrity evidence, not remote-producer
authentication. Cross-host or untrusted-operator handoff requires signed CI
provenance and a trusted builder policy.
