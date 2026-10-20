# Quiet-window archiver qualification — design

Approved through grill-me on 2026-10-20: prepare first, then reserve approximately
30 minutes on the existing Docker host for the four matched pressure runs. Keep
normal applications running; coordinate no unrelated builds, tests or deployments.
Add bounded read-only checks before the study and after each arm's verified cleanup.
On interference or an unavailable check, retain completed correctness evidence,
mark timing inconclusive and stop remaining arms without automatic retry.

## Contract and limits

Reuse the [pressure study](gateway-archiver-pressure-design.md), its fixed
unsampled/sampled/sampled/unsampled order and two real captures/restores per arm.
The new explicit `--archiver-quiet-study` mode adds host-runner observations only.
The existing unguarded mode remains available, without a quiet-window claim.
No runtime services, admin functions, settings, database tables or identities are
added. Production schedules, inference, retry budgets and resource limits stay
unchanged; nothing targets Unraid or shared Ollama.

Each observation has a five-second monotonic deadline, at most five fixed Docker
CLI reads, at most 128 containers and 64 KiB per command. Read daemon ID, all
container IDs, a minimal lifecycle projection, all IDs again, and daemon ID again.
Inspect only validated full IDs with a fixed template and no shell. Refuse list
races, daemon changes, duplicate IDs, malformed/oversized output, timeouts and
partial failures. Include running and stopped containers; do not exclude broad
fixture labels that might hide another concurrent study. Empty inventory is valid
only when both lists agree and daemon identity is available.

Canonicalize ID, status, start/finish timestamps and restart count, sort by ID,
and hash together with daemon identity. Publish only count and SHA-256, never
names, environment, labels, mounts, commands, credentials or raw CLI errors.
This fingerprint is an observation, not a signature or proof of host idleness.
The initial digest remains the baseline for every comparison.

The pressure runner returns an arm only after its existing restore, history,
attempt-limit, refusal and exhaustive exact-owned cleanup checks succeed. Report
that completed result before the next host observation. A changed or failed
observation stops subsequent fixture work with a nonzero exit and fixed reason.
Initial failure starts no fixtures. Underlying fixture or cleanup failure retains
its original failure and never becomes a successful arm. No retries, sleeps to
hide changes, budget resets, container restarts or foreign cleanup are added.
There is no persisted cooldown: this is a single explicit local study invocation.
Cancellation/restart is not resumable; incomplete work is not timing evidence.

Successful completion means four correctness-qualified arms and five matching
endpoint observations. It does **not** mean continuous monitoring. Short-lived
containers, pause/resume between observations, exec work, builds, host activity,
hypervisor contention and cache evolution can remain invisible. Coordination is
still required. Two repetitions per mode support exploratory comparison only,
not statistical significance, a causal sampling-cost estimate or production
latency acceptance. No cache flush, forced GC or resource-limit increase.

## Research, alternatives and recommendation

Official sources discovered with MCP search and opened on 2026-10-20:

- [Docker container listing](https://docs.docker.com/reference/cli/docker/container/ls):
  all/quiet/no-trunc provide full IDs including stopped containers.
- [Docker inspect](https://docs.docker.com/reference/cli/docker/inspect/) and
  [restart inspection](https://docs.docker.com/reference/cli/docker/container/run):
  fixed templates can project lifecycle state rather than whole configurations.
- [Docker system info](https://docs.docker.com/reference/cli/docker/system/info/):
  exposes daemon identity for an additional endpoint consistency check.
- [Docker events](https://docs.docker.com/reference/cli/docker/system/events/):
  event streaming is possible, but retrospective history is limited to 256 events.
  An event stream alone is not CPU/disk-idleness evidence (our inference).
- [Docker socket protection](https://docs.docker.com/engine/security/protect-access/):
  daemon access is security-sensitive. Use the existing host CLI; add no socket
  mounts, remote listeners or new permissions to workers.
- [NIST blocking guidance](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm):
  control nuisance factors where possible; our balanced exploratory order does
  not remove every shared-host nuisance factor.

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Coordinated window plus endpoint checks | Small bounded change; catches persistent lifecycle interference | Gaps remain; selected for this local qualification |
| Dedicated test host | Stronger control of interference | Requires another environment; not selected now |
| Continuous lifecycle stream | Can observe some short-lived activity | More failure/coverage complexity; still not an idle-host proof; deferred |
| Ignore interference or restart other apps | Convenient rerun | Invalid timing claim or unauthorized disruption; rejected |

Recommended stack: source-bound unchanged fixtures → clean immutable no-cache
image → native regressions → coordinated window → minimal endpoint guard →
four sequential real-restore arms → verified cleanup → cautious interpretation.
Consider sustained co-load only after this qualification; predeclare comparative
latency criteria before calling any later study a latency acceptance gate.

## Verification and delivery

Test fixed commands and output projection; empty/reordered inventories; changed
IDs, status, timestamps, counters and daemon; races, bounds and timeouts; privacy;
preflight refusal; report-before-stop; no retry; failure/cleanup preservation; and
legacy sequencing. Run gateway tooling and affected quality gates, then native
image regressions before measurements. No concurrent owned tests/builds during
the window. Preserve completed evidence even if the window is interrupted.

The initial refreshed GitHub MCP search returned none; #566 was already adopted
and is closed/unmerged. A later search found newly opened #568. The dependency
batch is separately scoped in the [ESLint design](server-eslint-10-13-design.md).
Record results in a separate outcome document, update Unreleased, back up local
appdata before Compose replacement, commit/push on main. No release or version bump.
