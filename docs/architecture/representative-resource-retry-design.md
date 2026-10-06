# Representative resource retry design

Date: 2026-10-06. Follows the
[snapshot lifetime study](representative-snapshot-lifetime-outcome.md).

## Evidence and contract

The representative refresher currently counts `DiscoveryDeferredError` as a fitting
failure. Four pressure refusals in the previous image study produced increasing
cooldowns; after import/metadata drained, comparison recovered and revalidated but
the representative fit started too late to finish before the unchanged deadline.
This is retry accounting, not permission to lower memory requirements.

Introduce a small process-local ESM retry-policy factory. Keep independent resource
and failure eligibility deadlines. A typed discovery deferral (`busy`,
`memory_pressure`, `memory_unknown`) delays the next admission attempt by 60 seconds
without incrementing or clearing genuine failure history. Unknown errors, provider
errors, corrupt evidence and timeouts keep the existing 60-second exponential
backoff, capped at one hour and seven counter increments. A successful admitted
refresh or configuration change resets both histories, exactly where resets occur
today. Cancellation neither spends nor clears retry history.

No new timers, persisted records, public settings, migrations or HTTP actions.
The existing minute schedule and one initial attempt remain; a late tick runs at
most one attempt and never catches up missed ticks in a burst. Eligibility is a
minimum delay, not a promise of exact-minute execution. Restart loses ephemeral
retry state as before, but must pass all normal admission and consistency checks.
The recurring worker still has no lifetime attempt cap; this bounds frequency,
concurrency and each run's duration, not the installation's total future retries.

## Safety and completion

- Fresh/empty/disabled/unsupported configurations start no additional work.
- Readiness stays outside the refresher; ingesting/backfilling states neither
  allocate a model nor alter the retained failure history.
- Preserve one active refresh, the database advisory lock, shared reservations,
  memory telemetry checks, hysteresis, cancellation monitor and final checkpoint.
  Unknown memory remains a refusal. No extra fit occurs before admission.
- Retain the 120-second run deadline, five-minute cache revalidation, cache limits,
  source/configuration/revision validation and atomic publication. No forced GC.
- Preserve existing cache clearing on pressure/unknown failures and cache handling
  on contention. A pressure interruption after admission must settle and release
  ownership without publishing a partial model before a retry becomes possible.
- Retry only the existing read/fit/verified in-memory publication path, not uncertain
  remote writes. Optional profiles never hold import/metadata completion open.
- Keep fixed sanitized status/reason codes and existing diagnostics. Do not add
  provider messages, payloads, credentials or raw URLs to logs.

Completion requires regression evidence for repeated deferrals, exact/late timing,
mixed true failures and deferrals, readiness pauses, configuration changes,
cancellation and real admission recovery. Re-run the original shared-catalog image
study with its unchanged workload/deadline/assertions, then recreate local testing
Compose and run isolated schema dump/check and health observation. A failed study
remains failed; neither unit clocks nor local health substitute for it.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Separate bounded resource deferrals from fitting failures | Faster reconsideration after capacity recovers; retains real failure history | More lightweight admission checks during sustained pressure; recommended |
| Reset all failures on a deferral or readiness pause | Simpler state | Can erase real provider/corruption failures; reject |
| Retry immediately or change memory thresholds | Faster visible progress | Can amplify load or weaken safety; reject |
| Add durable retry state or global scheduler jitter now | Broader cross-process controls | Schema/behavior expansion beyond the measured defect; defer |

First prove retry classification and bounded timing. Next measure natural recovery.
Then revisit the remaining comparison build/fresh-read allocation peak; do not mix
that optimization into this retry-policy change.

## Official research and PR trial

Discovered/retrieved with web tools on October 6, 2026:

- [AWS retry guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  distinguishes transient failures, bounded retries and idempotency; excessive retries
  can worsen overload. Our local admission refusal is not a failed remote operation:
  the fixed delay is a project-specific choice, not an AWS-prescribed duration.
- [Node 24 timers](https://r2.nodejs.org/docs/latest-v24.x/api/timers.html) do not
  guarantee exact callback timing. Test just-before/at/after eligibility and late
  ticks, without subtracting tolerance from a safety deadline.
- [DefinitelyTyped version policy](https://github.com/Definitelytyped/DefinitelyTyped)
  relates declaration versions to the corresponding runtime/library version.

Fresh open-PR enumeration contained #555 and #556. Random selection chose
[server typings #556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Trial the exact two-file change from
Node 24 declarations to 26.6.4 and undici-types 8.9.0, before installation. Revert
if runtime alignment fails; no merge or Node-major expansion. Other available
server patches are a separate dependency batch, not part of this behavior change.
