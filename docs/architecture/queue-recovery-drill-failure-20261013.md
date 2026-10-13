# Queue recovery drill failure: 13 October 2026

## Observed failure

[GitHub Actions run 38434714401](https://github.com/cloudbyday90/Classifarr/actions/runs/38434714401)
tested main commit `7bd5ca51843042f429f96f915e801cb1106dc6a5`, a documentation
follow-up. The failing Build and Test step was **Queue claim recovery across
graceful stop and forced host kill**, invoking `test:local:queue-recovery-drill`.
The release-acceptance readout then failed because this required job failed.
The unit, database, fresh-install and published-upgrade checks passed in that run.

The retained log reports only:

```text
shutdown_drill_cleanup_failed:classifarr-stop-drill-591d5e3e3f0a9878e59f3e16f697b04b
```

The step ran from approximately 17:22:17 to 17:23:00 UTC. The four retained
artifacts contain ESM reports, runtime installation evidence and the acceptance
readout, but no shutdown diagnostic artifact. This was not the earlier release
tag's successful workflow and does not establish that Classifarr crashed in use.

## Why the exact cause is missing

`scripts/lib/embeddedShutdownDocker.mjs` cleans up exact generated containers and
their volume only after checking ownership labels. It bundles cleanup exceptions
and any earlier drill exception into an `AggregateError`. The top-level runner
prints only `error.message`, hiding the nested errors.

Consequently the evidence identifies a cleanup-stage failure, but cannot tell
whether Docker timed out, removal failed, a volume remained in use, or an earlier
scenario failure was also present. Calling this an application regression or a
harmless flaky test would exceed the available evidence.

## Recommendation

Keep cleanup failures blocking. Add bounded, sanitized child-error reporting and
an always-uploaded diagnostic receipt containing the failing phase, exact owned
resource names, command outcome and cleanup verification. Preserve the original
scenario failure separately from cleanup failure. Test timeout/partial-cleanup
paths without weakening ownership checks or pruning Docker resources.

Pros: failures become actionable and cleanup cannot silently pass. Cost: another
small diagnostic contract and fault-injection tests. A blind rerun may pass but
would not explain this failure; swallowing cleanup errors hides leaked resources.

This investigation made no workflow changes and did not rerun or alter the
referenced GitHub run. Diagnostic improvements remain the next CI task.
