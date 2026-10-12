# Frontend static-contract phase diagnostics

Research date: 2026-10-12. Baseline: main `26b8a92a248d46b5bb3acf79511a03660654e632`.
Scope: test-only diagnostics, not an application-memory or timeout fix.

## Decision and alternatives

Previous combined runs intermittently exceeded the existing 10-second ESLint
setup or 5-second CSRF scan deadline. Instrumented reruns passed, so the cause
remains unisolated. Temporary edits are not a repeatable way to capture the next
failure. Add a small ESM phase recorder, enabled only by
`CLASSIFARR_TEST_PHASE_DIAGNOSTICS=1`, to those three static-contract suites.
The CI client-test step opts in so the next CI timeout retains phase evidence
without requiring a second run; local invocations remain disabled by default.
Normal passed-test console suppression stays in place. Failed-test output and
the explicit local `--silent=false` command reveal the records.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Opt-in phase wall/CPU measurements | Separates setup, collection, reads, matching and assertions in the real run | Measurement overhead; cannot identify OS scheduling or disk causes alone | Implement first |
| Worker and coordinator CPU profiles | Shows hot stacks and transform work separately | Larger local artifacts, paths and additional overhead | Escalate after a captured slow phase |
| Increase deadlines, disable coverage/isolation or skip scans | Fewer timeout failures | Hides the symptom and changes guarantees | Reject |
| Repeated passing runs | Confirms observed runs work | Cannot establish the intermittent failure's cause | Report, never call a fix |

Recommended stack: unchanged Node 24/Vitest 5.0.4, real isolated forks, existing
project ordering and deadlines, full combined coverage, opt-in bounded phase
records, then targeted CPU profiling only where evidence points. Do not change
runtime memory safeguards, host protection or production recovery.

## Official research

Sources discovered/retrieved through MCP on the research date:

- [Vitest profiling guide](https://main.vitest.dev/guide/profiling-test-performance)
  distinguishes setup, import, execution and environment time. Worker profiles
  use `execArgv`; profiling the coordinating Node process is a separate step.
- [Node process API](https://nodejs.org/api/process.html) documents monotonic
  `hrtime.bigint()` and process-wide `cpuUsage()` in microseconds. CPU time may
  include other work in the process and is not a measurement of disk wait.
- [DefinitelyTyped version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  ties declaration versions to the described library version, supporting the
  existing Node runtime/declaration major guard.

## Diagnostic contract

Use fixed scope and phase names, an automatically generated correlation ID,
timestamp, worker PID, monotonic wall duration and process CPU deltas. Aggregate
repeated reads/matches by phase; never retain source text, filenames, environment
values, exception messages, provider responses or unbounded per-file samples.
Emit one start record and one terminal record per instrumented operation.
An absent terminal record means incomplete evidence, not success or a diagnosis.

The recorder must preserve synchronous return values and thrown errors, and
asynchronous values/rejections. Completion records describe the callback, not
Vitest's verdict: a hook may finish after Vitest has already timed it out.
Output failures must not replace assertion failures. Disabled mode must neither
sample timing nor write output. Metrics for nested phases are inclusive and
must not be added to their enclosing total. No timers, retries or file writes
are introduced by the recorder.

## Random open PR trial

Fresh open PR enumeration returned #558 and #556. A cryptographic random draw
returned index 1, selecting [#556](https://github.com/cloudbyday90/Classifarr/pull/556),
head `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Apply its exact server
manifest/lock proposal locally: Node declarations 24.19.2 to 26.6.4 and
undici-types 7.24.6 to 8.9.0. Review installation scripts and test strict install,
tree, audit, server typechecking and tooling policy. Restore an incompatible
proposal; do not change the runtime or its compatibility guard to accommodate it.
No merge or remote PR mutation is authorized or needed.

## Verification and operating instructions

Unit-test fixed schemas, aggregation, disabled mode, identity, exception
preservation and output failure. Exercise the recorder through real Vitest
subprocesses, including a synthetic hook timeout. Keep the actual source scan
and lint assertions unchanged. Run the combined coverage suite with diagnostics
and normal project ordering; retain the failed run if it fails. A pass does not
close the original incident. Compare to a diagnostics-disabled acceptance run.

From `client/` in PowerShell, using the pinned toolchain:

```powershell
$env:CLASSIFARR_TEST_PHASE_DIAGNOSTICS = '1'
try {
  node scripts/run-vitest.mjs run --coverage --maxWorkers=2 --silent=false
} finally {
  Remove-Item Env:CLASSIFARR_TEST_PHASE_DIAGNOSTICS
}
```

Retain the process exit code and final Vitest summary alongside phase records.
Use the record's correlation ID to pair start/end events and its scope/PID to
distinguish suites. Wall time much greater than CPU time narrows the question
but does not prove disk latency, antivirus interference or a scheduler defect.
CPU counters have platform-dependent resolution; a zero delta for a short phase
does not mean it performed no CPU work, and multi-core CPU time can exceed wall time.
Keep raw profiles and full logs private under ignored `.tmp/` and inspect them
before sharing. Do not automatically upload raw profiles as CI artifacts.

Guard the CI opt-in and unchanged test command in runner/config acceptance.
Complete local lint, runner/config regressions, build and documentation checks.
Preserve backup/rollback image before the requested no-cache local Compose
replacement; verify exact source/image and health/hardening. Dump schema using
an isolated fresh database after rebuilding. Record outcome separately; leave
Unraid, Plex/Ollama and unresolved mappings untouched. No release/version bump.
