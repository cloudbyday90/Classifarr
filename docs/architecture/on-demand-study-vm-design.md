# On-demand study VM design

Agreed scope: 20 October 2026. This increment implements a local, simulated
lifecycle decision model, not a Hyper-V executor. It does not provision, start,
stop or connect to a real VM, change permissions or run the measured study.

## Recommendation and alternatives

The study VM should be off between explicitly requested jobs. Retain the agreed
4-vCPU, fixed 8 GiB RAM, fixed 64 GiB disk and host-only SSH preparation profile.
Do not add an always-on service, automatic host-boot startup or admin buttons.
The eventual administrator setup must select `AutomaticStartAction: Nothing`
and verify it, rather than relying on the host's default or saved state.
([Microsoft VM settings](https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vm?view=windowsserver2025-ps))

| Approach | Benefit | Cost or weakness |
| --- | --- | --- |
| Always running | No startup wait | Reserves memory and invites unrelated work |
| Job-owned startup and graceful shutdown | Releases resources between jobs | Requires identity, exclusive ownership and verified drain |
| Idle timer or forced power-off | Simple resource reclamation | Idle observations cannot prove safety; power loss can damage work |

Final stack: explicit job request, UUIDv7 job identity, exclusive ownership,
bounded startup/readiness, closed admission and verified drain/cleanup, final
identity check, graceful shutdown, confirmed off. Fail closed on uncertainty.

Microsoft distinguishes guest shutdown from forced shutdown and power-off;
the latter can lose unsaved data. Never use force, save-state or power-off as
a timeout fallback. Guest shutdown integration must be verified before a future
executor can claim operational readiness.
([Stop-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/stop-vm?view=windowsserver2025-ps),
[integration services](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/Manage-Hyper-V-integration-services))

## Lifecycle and safeguards

Only an initially off, explicitly selected VM may enter this model. An already
running, saved, paused or unknown VM is not adopted. A job that did not start a
VM must not shut it down. Bind every observation to the job, VM, configuration
digest, ownership token and current boot identity. Reject reordered, stale,
foreign or replayed observations. Use monotonic stage deadlines, not wall-clock
age as proof of quiescence. Cancellation requests drain; they do not prove drain.

A completed, failed or cancelled job can shut down only after admission is
closed, all its work is drained, owned resources are removed, and a fresh
pre-shutdown observation confirms the same boot and exclusive ownership. Lost
contact, cleanup failure, identity changes and deadline expiry leave power state
unconfirmed; report the reason without automatic retries or forced shutdown.

The model accepts synthetic observations only. Its outputs are decisions, never
trusted receipts or authorization for a real power operation. No CLI accepts
external proof files or enables a live adapter. In-process single-job state is
not an interprocess lock. A future executor needs a trusted host/guest channel,
durable exclusive ownership, admission fencing and independently verified drain.
The model checks deadlines when advanced or cancelled; it does not install a
background timer. A future executor must drive those deadlines even if SSH or
work stops responding. Hyper-V `Running` alone is not OS or job readiness.
([Microsoft integration services](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/integration-services))

## Weak points and verification

- Test every transition, rejected initial power state, ownership loss, boot or
  configuration change, replay, invalid observation, timeout and cancellation.
- Preserve the original job outcome even if safe cleanup permits shutdown.
- Test with no VM, Docker, SSH, network, credentials or administrator access.
- Keep `liveOperationsEnabled` and `studyReady` false in all simulation results.
- Do not equate fixture-container cleanup with whole-guest quiescence.
- A VM isolates Docker lifecycle, not physical CPU or storage contention. Real
  study readiness still requires Windows and guest interference guards.
- Future guest execution must bind the local Docker daemon explicitly: bind
  paths are resolved on the daemon host, not the client.
  ([Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/))

Next integration gate: administrator-reviewed VM/SSH handoff, trusted ownership
and guest drain protocol, explicit guest daemon binding, then native qualification.
No actual study or production deployment is authorized by this document.
