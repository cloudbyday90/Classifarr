# Automatic classification recovery

## Goal and boundary

After an AI outage, eligible exhausted classifications should resume without an
operator repeatedly pressing Retry. Recovery queues classification; it does not
select a library, increase confidence, bypass review, or authorize routing.

The previous change restored manual recovery but left exhausted jobs terminal.
The existing health indicator is insufficient: some cloud providers appear
available when credentials exist, without proving that generation works.

## Design

1. Persist a server-selected transient failure code alongside the history row,
   derived from structured HTTP/network codes, not exception text.
   Unknown, legacy, configuration, authentication and cancellation failures are
   not automatically replayed.
2. After exhaustion, wait at least 15 minutes. Select at most five unrouted jobs
   with a canonical identity and no newer decision for that item.
3. Claim a database-backed probe cooldown before network work. Restarts and
   competing schedulers cannot bypass the 15-minute interval; jitter spreads
   retries between installations.
4. Check actual generation against the configured provider/model. Cloud probes
   use existing budget checks and usage accounting, a synthetic prompt and a
   small output limit. They can incur provider charges. No library content is
   sent in a probe. Local probes require a completed generation request with
   nonempty output in either the response or thinking channel. A four-token probe
   may end during thinking; it proves generation availability, not answer quality.
   Neither channel's text is retained.
5. Recheck configuration revision, proof age, job status and budget under the
   existing transactional retry path. Queue insertion and budget consumption
   commit together. No database transaction waits for provider I/O.
6. Permit one automatic recovery cycle of at most three retries. Carry its consumed budget in dedicated
   database columns from history to queue to replacement history, never in
   caller-controlled metadata. Normal scheduled retries preserve it. Explicit
   manual retry starts a new cycle. Missing queue provenance consumes rather than
   renews this budget. Snapshot-based fresh installs initialize the probe singleton
   atomically, so they do not depend on migration seed data.

The retry scheduler runs every five minutes, so eligibility and jitter can add
up to one scheduler interval to the cooldown. Proof expires after 60 seconds.
The legacy Ollama endpoint is included in the configuration fingerprint and
briefly locked with the AI configuration during admission. Provider checks run
outside these locks. Queueing is atomic; provider availability can still change
after admission, and the normal bounded retry path handles that race.

## Alternatives and tradeoffs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Retry all failed jobs when health turns green | Simple | Weak health evidence; duplicate side effects; loops | Reject |
| Require manual retry forever | No background inference cost | Outages leave users doing recovery work | Keep only as fallback |
| Bounded generation check plus durable retry budget | Self-healing, restart-safe, existing queue | Probe cost; delayed recovery; conservative exclusions | Implement |
| Add a separate workflow engine | Durable orchestration features | Another service and migration; duplicate queue responsibilities | Defer |

## Security and usability

Only the scheduler's internal recovery source admits exhausted jobs automatically.
The public retry endpoint retains its existing authenticated manual behavior.
Configuration changes invalidate readiness; a readiness result never grants AI
authority. Logs contain counts/reason codes, not prompts, keys or provider bodies.
Existing History actions and inline status remain the user escape hatch. This
backend change adds no dense panels or acknowledgement requirements.

## Official research reviewed September 20, 2026

- [Microsoft transient-fault guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults): classify failures, bound attempts and delays, avoid retrying permanent errors.
- [Microsoft circuit-breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker): limit requests during recovery instead of flooding a recovering dependency.
- [PostgreSQL 17 locking](https://www.postgresql.org/docs/17/explicit-locking.html): transactional row locks serialize state transitions; keep lock ordering consistent.
- [Ollama generation API](https://github.com/ollama/ollama/blob/main/docs/api.md): distinguish completed generation from mere HTTP connectivity.
- [Ollama thinking support](https://ollama.com/blog/thinking): thinking output is separate from the final answer; a short probe must not mistake that distinction for a provider outage.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): retain programmatic inline status without forcing focus changes or interrupting users.

URLs were discovered through research tools, then opened and reviewed. These
sources support the patterns; the numeric limits above are Classifarr design
choices, not standards requirements.

## Recommendation stack

Keep PostgreSQL and the existing queue; add focused ESM policy, readiness and
recovery orchestration modules; persist budget provenance; verify with isolated
database concurrency, rollback and replacement-history tests. Measure actual
recovery outcomes before increasing batch size or relaxing failure eligibility.
