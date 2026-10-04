# Routing restart failure diagnostics

Date: 2026-10-04. Scope: disposable installation acceptance, not live recovery.

## Evidence and decision

[CI run 37217414273](https://github.com/cloudbyday90/Classifarr/actions/runs/37217414273)
failed at `forced-restart` on source `cbad9423832881db808aaa183e0eda1b34c2b806`.
The diagnostic retained only `assertion_failed`, losing the specific failed check
and the disposable container state before cleanup. A local replay of a later
image passed; that does not establish the cause of this historical failure.

Reuse the existing bounded `containerStartupDiagnostics` collector rather than
create another log parser. Capture its allowlisted state, startup classifications
and lifecycle observations before removing an owned failed fixture. Keep that
context in a private weak map keyed by the original error; emit it only with the
existing failure report after cleanup. Unknown errors cannot inject diagnostic
fields. Diagnostic failure must neither hide the original failure nor skip cleanup.

Give the existing no-OOM, expected-exit and startup-running assertions fixed check
names. Do not change their accepted values, restart timing, health deadlines,
provider call counts, cooldowns or release admission. Retain the original error;
cleanup failure still takes precedence. Do not print arbitrary assertion values,
Docker errors, environment variables, health-check output or raw logs.
Recognize PostgreSQL's fixed PID-lock refusal message as a category only; do not
copy its PID, path or hint. A recognized log line is not proof that it caused
the latest startup attempt, because the bounded tail can include earlier attempts.

## Bounds and prerequisites

- Only an already-created disposable container with the exact random name and
  ownership label is inspected. No live container or caller-supplied name.
- Collect on failure only, not on polling or successful runs. Existing collector
  commands use five-second deadlines and bounded output; log parsing keeps at
  most 100 lines per stream and 16 recognized lifecycle events per stream.
- No new daemon, database write, schema, package, HTTP endpoint or user interface.
  No work is added to fresh installations or normal runtime.
- A startup marker is an observation, not authority to bypass recovery or a
  complete causal timeline across stdout and stderr.
- All fixture resources remain bounded and isolated; cleanup remains mandatory.
  Snapshot retention must not retain credentials or the original error payload.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Retry CI or extend delays | May produce a green run | Does not identify the failed assertion | Not a repair |
| Upload raw Docker logs | More context | Credentials and private values can escape | Reject |
| Reuse safe collector and name checks | Distinguishes exit/OOM/startup without raw values | Unknown failures may still need isolated debugging | Implement |
| Weaken restart assertions | Makes failures disappear | Removes evidence the release gate requires | Reject |

Recommended stack: unchanged crash boundary → named assertions → bounded owned
container diagnostics → verified cleanup → unchanged failing receipt/gate.
Completion for this patch means distinguishable, sanitized failure evidence with
regression tests and real-image replay. It does not mean the historical CI root
cause has been established unless reproduced with matching evidence.

## Official research

Discovered through web search and opened on 2026-10-04:

- [Docker kill](https://docs.docker.com/reference/cli/docker/container/kill/)
  defines signal delivery to the container's main process.
- [Docker wait](https://docs.docker.com/reference/cli/docker/container/wait/)
  documents observing process exit. These are distinct from application readiness.
- [PostgreSQL advisory locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  is cooperative; a failed test or a successful restart cannot certify absence
  of legacy import writers. Ownership investigation is recorded separately.
- [PostgreSQL lock-file implementation](https://doxygen.postgresql.org/miscinit_8c_source.html)
  supplies the fixed refusal marker. This is the current development source,
  not proof of a particular PostgreSQL 18 binary's behavior. A PID-lock hypothesis
  needs matching real-image evidence before changing startup handling.
- [PostgreSQL shutdown](https://www.postgresql.org/docs/18/server-shutdown.html)
  distinguishes fast shutdown from forced termination. SIGKILL here is a
  disposable fault injection, never the normal shutdown policy.

## Validation and next work

Test named failure branches, diagnostic capture before cleanup, reporting after
cleanup, collector failure, foreign-label refusal, cleanup failure precedence,
secret exclusion, successful runs with no diagnostic collection, and unchanged
release rejection. Reuse the real routing rehearsal with immutable images.
The local historical-source replay reproduced a database startup exit, while
other runs passed. See the [outcome](routing-restart-diagnostics-outcome.md) for
the exact images and limitations. Obtain the underlying PostgreSQL refusal before
making a runtime or timing change.
