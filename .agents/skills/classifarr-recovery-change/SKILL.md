---
name: classifarr-recovery-change
description: "Design, implement, and verify Classifarr retry, backfill, recovery, scheduler, or provider-failure changes. Use when adding self-healing or diagnosing repeated background failures. Not for unrelated UI, dependency-only updates, or permission to run live recovery."
---

# Classifarr recovery change

Turn a repeated failure into a bounded, testable recovery path. Follow the user's
requested scope: diagnosis stays read-only; implementation does not authorize
production recovery, deployment, release, or external messages.

## Establish evidence

1. Read applicable AGENTS.md, git status, relevant design/outcome documents, and
   the affected entry point. Identify the current branch without switching it.
2. Trace the trigger, admission check, durable state, external side effect, and
   completion write. Distinguish observed facts from hypotheses. A logger stack
   is not necessarily the origin of the failure.
3. Inspect existing scripts in execution/ and scripts/ before adding automation.
   For current provider behavior, find and open official documentation through
   available search tools. Record retrieval date and exact verified sources.
4. Name the smallest failing scenario and the safety property it threatens.
   Never treat record age or one visible container as proof an old writer stopped.

## Design the contract before editing

Write a short design document under docs/architecture containing:

- prerequisites and when no work is necessary;
- transient, permanent, cancelled, and unknown outcomes;
- admission scope (item, provider, installation), persisted cooldown, maximum
  concurrency, attempts, timeout, response size, and resource bounds;
- crash/restart behavior, configuration revision checks, and ownership fencing;
- evidence required to retry a write versus safely repeat a read;
- a precise completion condition, tradeoffs, and the next deferred item.

Default to no new work on fresh installs. Optional AI/embedding services must not
hold import-and-metadata recovery open. Preserve inventory until a verified full
capture. Do not fabricate ownership, reset retry budgets to hide errors, suppress
warnings without fixing their cause, or replay an uncertain add operation.

## Implement and prove

Use small ESM modules following existing factories. Keep HTTP out of database
transactions. Parameterize values; allowlist dynamic SQL identifiers. Do not
persist or log provider response bodies, raw credentials, URLs with secrets, or
untrusted error text. Update migrations and the fresh schema together, using only
an explicitly isolated database for snapshot generation.

Check these cases when applicable:

1. Empty/fresh setup, disabled feature, legacy incomplete record.
2. Failure before admission, after admission, after a remote side effect, and
   before the local completion write.
3. Restart, competing instances, expired lease, cancellation, and shutdown.
4. Credential/endpoint/intent changes and disable-during-flight.
5. Transient outage, permanent refusal, rate limit, malformed/oversized response.
6. Accurate accessible status, no network I/O from status views, and sanitized logs.

Use the repository's real HTTP and isolated PostgreSQL fixtures for behavioral
contracts; mocks alone do not prove SQL locking or transport cancellation. Add
regression tests before claiming a bug fixed. Run focused checks first, then the
affected quality gates from package.json and CI. Report exact results and skips.
Never silently refresh security/ownership baselines; review each changed entry.

For release evidence that depends on container replacement or interrupted work,
read [image rehearsal guidance](references/image-rehearsal.md). It distinguishes
real image upgrades from process restarts and fixture clock changes from elapsed
cooldowns, and identifies the existing isolated runners.

## Handoff

Keep design and outcome documents separate. Record verification, limitations,
next recommendation and high-level Unreleased changes. Report the result in a
few direct sentences, linking details. Commit/push only when requested; inspect
the full diff for user changes and secrets first. Preserve the requested branch.
No merge, release, live database mutation, or Docker replacement is implied.

If asked for an open PR, enumerate current PRs first. Review a randomly selected
eligible PR before local implementation; never claim a closed/merged PR is open.
If none exist, say so and continue the authorized primary task.
