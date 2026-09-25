# Automatic destination evaluation: design

Status: Unreleased, September 24, 2026. Results belong in the separate outcome
document. This is the first bounded increment of change-triggered evaluation.

## Scope and decision

Existing saved-decision evaluation is a private CLI. Calling its entry point in
the scheduler would mutate process-wide logging/database settings and close the
shared pool. Reuse its bounded reader and pure evaluator through an injected
service instead. No user acknowledgement, manual label collection or UI is added.

Automatically check retained evidence every five minutes through the existing
scheduler. Fingerprint the complete bounded projection, including the evaluator
revision, and evaluate only changed inputs. Read-time expiry, repaired captures,
new feedback, queue states and destination availability participate. This is
poll-based change detection, not an event broker or exactly-once execution.
Changes to grading semantics or the report contract must bump the worker's
evaluation revision so an unchanged source snapshot is evaluated again.

This increment grades saved movie/TV decisions against genuine retained feedback
and reports coverage/deferrals separately. It does not run a new model, sample
inventory placements as truth, train weights, compare candidate models, or promote
routing. Music remains outside the existing evaluator's supported media.

## Reliability and privacy

- Reuse the scheduler lifecycle and a database-wide advisory lock; coalesce local
  calls and release ownership only after work settles. Stop prevents new work.
- Read one repeatable, read-only snapshot with statement/lock/transaction bounds.
  Keep independent 5,000-row outcome and intake limits. Overflow is failure,
  never a partial accuracy number. No shared pool shutdown or environment writes.
- Store one checkpoint: fingerprint, fixed state, timestamps, bounded aggregate
  report and retry counter. Never persist source identities, names, content,
  prompts, vectors, credentials or arbitrary error text in this checkpoint.
- Persist a five-minute next check; failures retry after 5, 10, 20, 40 then 60
  minutes. Restart resumes from that checkpoint. No backlog or per-item jobs.
  When the database cannot store retry state, use a five-minute process-local
  cooldown; that fallback alone does not survive a restart.
- Preserve the database timestamp's precision and reject publication older than
  the current observation. A future checkpoint caused by clock movement may heal.
- Failed evaluation clears the report and fingerprint. A database outage may
  prevent that write; readers therefore withhold results older than 15 minutes.
  Freshness is observation time, not an accuracy guarantee. Successful unchanged
  checks refresh observation time but preserve the original evaluation time.
- Query through the existing private CLI's automatic-status mode. It reports
  never-run, failed and stale states explicitly. No new public endpoint or card.
- This single bounded aggregate is replaced, not an accumulating evidence archive.
  Source retention is unchanged; the next successful scan incorporates expiry.

## Alternatives and recommendation stack

| Approach | Benefit | Tradeoff / decision |
| --- | --- | --- |
| Existing scheduler plus durable checkpoint | Small integration, restart recovery, no additional infrastructure | Bounded polling and eventual detection; selected |
| Trigger on every source write | Lower latency | Cross-cutting hooks, missed expiry/deletion paths; defer |
| Invoke the private CLI in-process | Reuses an entry point | Unsafe global settings/pool ownership; reject |
| Add a workflow engine or queue | Rich durable orchestration | More operational surface than this bounded observer needs; defer |
| Immediately automate model comparisons | Closer to candidate promotion | Separate resource, sample and evidence contracts need an adapter; next increment |

Stack: retained original decisions → existing recovery → scheduled coherent
evidence read → change-keyed evaluation → durable fresh aggregate → cached paired
candidate evaluation. Unknown labels never become correct decisions.

## Official research

Sources discovered and opened through search tools September 24, 2026:

- [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html)
  distinguishes session ownership from transaction ownership. Use existing checked
  connection lifecycle handling rather than claiming cron prevents replica overlap.
- [node-cron documentation](https://github.com/node-cron/node-cron)
  distinguishes scheduling/overlap prevention from durable execution. Persist the
  checkpoint in PostgreSQL; do not add an unverified distributed-cron option.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  recommends ongoing evaluation and feedback integration. Preserve measurement
  limitations and separate explicit agreement from overall accuracy.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  supports provenance, quality and version information. Apply these principles
  internally through versioned reports and observation/evaluation timestamps;
  this is not public data publication or a WCAG conformance claim.

## Acceptance and next boundary

Test automatic registration, unchanged checks, changed/expired evidence, movie/TV
grading, malformed/over-budget input, restart/backoff, concurrent workers, stop,
read-only isolation and safe private status. No routing/provider writes allowed.
Next, adapt the existing cached source-pair evaluator to this lifecycle, preserving
its frozen cases and leakage exclusions. Do not infer candidate improvement from
the aggregate saved-decision report alone.
