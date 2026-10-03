# Published-upgrade startup rejection capture

Date: 2026-10-03.

## Evidence and decision

CI run `37120415214` passed fresh startup, crash recovery and volume migration,
then failed at `normal_rejection`. Its container exited with code 1 and was not
OOM-killed. The artifact does not establish the application's exact error.

Code review found a separate concrete evidence bug: the drill checks only
Compose stdout for the expected restore-verification rejection, while
`server/src/index.mjs` writes startup errors to stderr. The embedded isolation
drill already checks both streams. Add a regression for stderr-only rejection,
then accept the fixed expected marker from either captured stream. Keep the
required exit code; an unrelated crash or missing marker must still fail.

Bound the log read to 200 lines. Do not print log contents, weaken startup
admission, retry a restore automatically, or convert an unknown crash into a
pass. Re-run the full disposable published-upgrade drill with the same candidate
image to distinguish this capture defect from other startup failures.

## Tradeoffs

Checking both streams fixes transport-dependent evidence loss with no runtime
change. It still relies on a fixed startup message; a future structured rejection
receipt could reduce that coupling but is unnecessary to repair this check.

Recommended order: regression test, bounded dual-stream capture, real-image
rehearsal, then observe the next CI result. No release or live deployment.
