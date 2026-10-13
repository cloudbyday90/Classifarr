# Shutdown and queue-recovery drill diagnostics

## Decision — 13 October 2026

Preserve the original scenario failure separately from cleanup failures. Keep both
blocking. Add a bounded, allowlisted diagnostic artifact for each existing drill,
and verify the absence of every exact generated resource after cleanup. This is
test infrastructure, not application self-healing or permission to recover live data.

The motivating [failure investigation](queue-recovery-drill-failure-20261013.md)
establishes only a cleanup failure. Its missing child errors cannot be reconstructed.

## Research and alternatives

Official sources discovered and checked on 13 October 2026:

- [Node child-process documentation](https://github.com/nodejs/node/blob/main/doc/api/child_process.md):
  rejected promisified commands can include stdout and stderr. Serialize selected
  exit, signal and timing fields instead of the Error object or command text.
- [Docker volume removal](https://docs.docker.com/reference/cli/docker/volume/rm/):
  an in-use volume cannot be removed. Record this as a category when reported,
  not as the assumed cause of every cleanup failure.
- [Docker labels](https://docs.docker.com/engine/manage-resources/labels/): retain
  resource ownership labels alongside exact random names before deletion.
- [GitHub artifact action](https://github.com/actions/upload-artifact): use exact
  JSON paths, explicit hidden-file inclusion for `.tmp`, and short retention.
- [GitHub status expressions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions?ref=blog.mergify.com):
  `always()` allows diagnostic upload after failure; a bounded upload step must
  not mask the failing drill or turn a cancelled run into acceptance evidence.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Print complete nested errors and logs | Maximum raw detail | May expose SQL, credentials, environment or payloads | Reject |
| Ignore cleanup failure or blindly retry | Fewer red runs | Conceals leaks and original scenario failures | Reject |
| Bounded structured diagnostics and absence checks | Actionable, safe context with failures preserved | Small tested diagnostic contract; unknown errors remain generic | Adopt |

## Implementation boundaries

Use small ESM modules for error projection and report persistence, reusing the
existing Docker harness and scenario runners. No additional dependency, network,
production database mutation, provider call, memory-limit change, or Docker prune.

Record source/workflow identity when available, actual local image ID, fixture
mode, exact random container/volume names, phase, a bounded operation tail, original
failure, cleanup failures and per-resource absence verification. Unknown errors
have a generic category and bounded script location; never publish raw messages,
stacks, command arguments, SQL, stdout, stderr, full inspect output or environment.
Nested causes/aggregates are depth/count limited and cycle safe.

Write an initial `running` report before Docker work and update it at lifecycle
boundaries; an interrupted report is not success. Atomic replacement avoids partial
JSON. Persistence failure itself blocks the CLI but must not prevent cleanup.
Preflight collisions never authorize deletion. After ambiguous Docker errors,
attempt bounded read-only absence checks, retaining the original removal error even
if the resource is now absent. Never remove an unowned collision.

These artifacts are diagnostic, not new acceptance receipts or signatures. The
existing command exit and required Build and Test job remain authoritative. No
downstream gate may accept the JSON status in place of the existing checks.

## Validation and recommendation stack

1. Fault-injection tests: scenario plus cleanup failure, timeout, partial removal,
   ownership collision, missing resource, failed verification and failed persistence.
2. Adversarial projection tests: credential-bearing messages/output/paths, cyclic
   causes and oversized aggregates. CLI failure must exit nonzero.
3. Workflow contract tests: both blocking drills, fixed artifact paths, upload after
   failure, pinned action and bounded retention; no broad directory upload.
4. Rebuild local Compose without cache; run synthetic shutdown and queue drills
   against the immutable candidate ID, verify cleanup, then evaluate local health.

See the separate outcome document for executed checks and remaining limits. Next,
use the retained diagnostics to fix any reproducible lifecycle defect; do not
guess the original CI cause or weaken application recovery safeguards.
