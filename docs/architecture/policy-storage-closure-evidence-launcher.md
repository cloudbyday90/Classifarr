# Policy Storage Closure Evidence Launcher

## Purpose

The instance closure-evidence assembler removes the need to hand-create its
intermediate validation JSON, but the evidence chain still needs a controlled
way to run validation. This task adds one platform-agnostic launcher that
runs exactly two existing repository tools in order:

1. generate current validation evidence; then
2. assemble the current-closure and requirement-audit chain from that evidence
   and an explicitly supplied completion-audit artifact.

The launcher does not create completion evidence, infer removal results, or
make a policy or release decision. Completion-audit provenance remains a
required explicit input.

## Research

The design follows official guidance reviewed through August 2026:

- [Node.js child process documentation](https://nodejs.org/api/child_process.html)
  distinguishes direct process spawning from shell execution. The launcher
  therefore uses `process.execPath`, fixed script paths, argument arrays, and
  `shell: false`.
- [OWASP OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
  recommends avoiding shell invocation where possible and allowlisting both
  commands and arguments when execution is necessary. The caller cannot choose
  an executable or add a command argument outside the fixed contract.
- [SLSA verification guidance](https://slsa.dev/spec/v1.2/verifying-artifacts)
  requires verification against expected artifact identity. The launcher does
  not manufacture the completion audit; the existing assembler validates the
  supplied completion and generated validation artifacts before it can emit
  closure evidence.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) describes
  secure software development practices that can be integrated into each SDLC.
  Versioning the fixed validation catalog makes a material verification-scope
  change explicit and prevents older evidence from being reused silently.

## Options

### Run Arbitrary Operator Commands

Pros:

- Can accommodate any local validation workflow.

Cons:

- A command string expands the execution and injection surface.
- Results are no longer comparable or reproducible across installations.
- A caller can accidentally assemble stale or incomplete evidence.

### Have The Launcher Regenerate All Evidence

Pros:

- Reduces command invocations for a maintainer.

Cons:

- It would blur the deliberate completion-audit approval and provenance
  boundary.
- It risks treating a local execution context as authority for a removal
  decision.

### Fixed Validation And Assembly Launcher

Pros:

- Eliminates hand-created validation JSON.
- Uses only repository-owned Node scripts with bounded timeouts.
- Preserves explicit completion-audit provenance and fail-closed assembly.
- Works from any selected checkout without Docker, database, media-server,
  provider, or network access.

Cons:

- The caller must still provide a valid current completion-audit artifact.
- Validation can take up to the bounded command timeout.

## Final Recommendation Stack

1. Use a fixed two-command plan: validation evidence followed by instance
   evidence assembly.
2. Spawn only `process.execPath` with fixed repository script paths,
   argument arrays, and `shell: false`.
3. Require the completion-audit artifact explicitly; never infer or generate
   it in the launcher.
4. Resolve every generated output beneath the selected checkout and reject a
   path that escapes it.
5. Stop at the first failed or timed-out command and emit only a command ID,
   exit code, signal, and timeout state. Do not relay child-process output.
6. Keep all writes in the existing scripts and all artifact validation in the
   existing assembler.

## Outcome

`policyStorageClosureEvidenceLauncherPlan.mjs` constructs the fixed command
plan. `run-policy-storage-closure-evidence-launcher.mjs` executes that plan
with a 15-minute validation timeout and a five-minute assembly timeout.
Each timeout first requests graceful termination, then forces termination after
a bounded ten-second grace period; it also returns a blocked result after that
grace period if the child never closes. During execution it emits a compact
`running` record for each stage, followed by a compact complete or blocked
result.

After 8R.37.4, the generated validation artifact uses the v3 fixed catalog.
It directly runs the closure-map scope service tests and lints the
reconciliation design record before attempting assembly. A prior validation
artifact cannot be replayed as current evidence because both its version and
command catalog differ.

## 8R.36.11 Revalidation Outcome

The August 2026 regeneration ran the v3 fixed validation catalog successfully:
focused tests, server lint, fixed Markdown validation, and full server tests
all passed. The generated artifact is fingerprint-valid and directly records
the closure-map service test and reconciliation design record.

The assembly intentionally remained blocked. The explicitly supplied,
current-format compatibility-removal completion artifact reported a blocked
active-installation state and did not have replay-valid approval evidence. The
resulting current-closure audit therefore reported `blocked_by_instance_cutover`
and the requirement audit reported `blocked_by_current_closure`. These are
diagnostics, not closure claims, and the generated files remain ignored local
evidence rather than repository release artifacts.

The repository implementation evidence and its scoped component map are ready;
only a current, explicitly approved active-installation completion artifact can
resolve the remaining cutover state. The launcher must continue to reject any
attempt to synthesize that artifact from checkout contents.

Dry-run example:

```text
npm run policy:storage-closure-evidence-launcher -- --dry-run --cwd . --completion-audit-artifact .tmp/completion-audit.json
```

Non-dry execution runs existing local validation checks. It does not call
Docker, a database, a media server, an external provider, Git, or the network.

## Verification

Focused tests prove that the plan:

- contains only the two approved commands;
- uses fixed script paths and bounded timeouts;
- escalates a timed-out process and returns after a bounded grace period;
- forwards the selected checkout and generated validation path consistently;
- rejects a missing completion audit and an output directory outside the
  selected checkout; and
- prints the same plan in dry-run mode without invoking either child process.
