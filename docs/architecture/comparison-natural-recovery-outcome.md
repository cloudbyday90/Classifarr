# Natural comparison recovery outcome

Date: 2026-10-06. [Design, tradeoffs and official sources](comparison-natural-recovery-design.md).

## Implementation and verification

The isolated launcher now accepts `--comparison-recovery`. Small ESM modules own
real schedule registration, lifecycle cleanup, recovery evidence and orchestration.
The existing refresh fixture is shared without changing prior study contracts.
An opt-in synchronous admission observer records the exact numeric decision; the
normal runtime has no observer, and limits, hysteresis, priorities, reservations,
backoff and garbage collection remain unchanged. Traces retain at most 256
allowlisted checkpoints, including failure runs, never provider bodies or secrets.

Local checks passed: 160 backend suites / 2229 tests, 40 tooling tests, server
lint/typecheck, copyright, normal/production dependency analysis, static ESM imports,
Markdown lint and whitespace checks. The ownership audit required review of the
three changed complete launchers and their new callees before updating their hashes.
Isolation and protected inventory behavior are unchanged; existing unresolved
writer debt is not declared resolved. No full application coverage rerun is claimed.

Fresh random open-PR selection chose #556 at
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact manifest/lockfile diff was
applied locally. Seven runtime-policy checks passed; the server Node-major check
failed. Only trial edits were reverted, and all eight checks then passed as part
of the tooling suite. No installation, merge or retained dependency update.

The preceding main commit's seven workflows completed successfully, including CI,
resource regression and security scans. Those results do not validate this new change.

## Image observation

Pending the exact-image elapsed-time run and local no-cache rebuild evaluation.
This section will record observed pressure, recovery, limitations and cleanup;
passing harness tests alone do not prove natural recovery or lower memory use.

An initial pilot was deliberately stopped after review found a completion-order
edge case: source mutation could coincide with an older successful revalidation.
The tightened receipt requires recovery and revalidation after the recorded
source-change time. Cleanup now also joins active callbacks if timer destruction
or worker shutdown throws. These checks have dedicated regressions; the stopped
pilot is not accepted as recovery evidence.
