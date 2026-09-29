# Durable enrichment retry outcome

## Implemented behavior

Enrichment retries now persist a next-attempt timestamp. Atomic claims reject
early work and active dependency cooldowns, including requests made through the
manual processing endpoint. Recreating the service does not erase those waits.
The existing advisory-lock scheduler checks every minute and processes at most
50 items per retry type per dispatch; it does not drain until empty.

Provider readiness is checked after claiming a due item, before making its
network request, and again for the next item. Unconfigured/unavailable routes
wait without consuming item attempts. OMDb quota races wait until the next UTC
day; current web-search quota failures defer to the existing router's readiness
policy. The historical Tavily monthly reset remains a UTC calendar boundary.

Transient provider failures persist a dependency cooldown, stop that batch and
use bounded jittered backoff. A concurrent result cannot shorten an existing
cooldown. Due time, cooldown, retry outcome and derived item state commit or
roll back together inside the existing claim/source write guard. Successful
evidence and fallback handoffs retain the previous transactional guarantees.

Two related bugs were corrected:

- A monthly wait marker survived claiming the row, while last_attempt_at moved
  forward. A later non-quota failure could therefore wait another month. Claiming
  due monthly work now clears the marker; the next failure gets an ordinary delay.
- The routed Tavily quota handler read `lastError.code`, but the router exposes
  `lastError.errorCode`. The handler now recognizes the actual contract.

Queue-owned OMDb lookups perform one transport attempt per lookup rather than
multiplying transport retries by queue retries. An IMDb miss can still use a
title lookup. Other OMDb callers keep their existing behavior.

## Safety and limits

- Migration 301 adds due times, an indexed pending-work lookup and a two-key
  dependency cooldown table. It does not delete data, change attempt budgets,
  invent legacy ownership or reopen terminal records.
- Movie/TV eligibility, enabled libraries, source identity and current claim
  tokens remain mandatory. No music admission or library-specific exception was
  added. Existing reviewed legacy recovery remains necessary for unknown owners.
- Cooldowns govern this retry queue, not every provider caller in the platform.
  Already in-flight calls may finish; stale results cannot acquire new authority.
  This is not an exactly-once HTTP guarantee.
- Availability checks are local configuration/quota/router checks, not proof that
  credentials will be accepted remotely. Authentication and other permanent
  failures retain the bounded existing failure policy; automatic credential
  repair is not claimed.
- Backoff uses equal jitter, initially 30–60 seconds and capped at one hour.
  Adapter-supplied retry delays can extend that to the existing 24-hour limit.
  Readiness waits are rechecked after 60 seconds. Scheduler load can add latency;
  a due time is an earliest attempt, not a promised completion time.
- The queue's existing statistics distinguish pending waits from actionable
  pending work. No API shape, routing policy or new runtime dependency was added.

## Verification

Focused verification passed 55 PostgreSQL tests for scheduling, ownership and
reviewed legacy recovery, including UTC resets and unrelated TMDb counters. The
complete suite results and installation receipt will be appended after
completion. All provider traffic in these tests is mocked; only disposable test
databases/containers are used. No live deployment or operator attestation occurs.

## Recommendation and next component

The [design](durable-enrichment-retry-design.md) contains official September 2026
research, alternatives, pros/cons and the selected stack: modular Node ESM,
PostgreSQL, the existing scheduler/router, Jest/PostgreSQL/Vitest. Benefits are
durable progress and transactional safety without another operational service;
the costs are indexed polling and scheduler-interval latency.

Two GitHub MCP searches found no open PRs in `cloudbyday90/Classifarr` during
this round. No random open PR could be selected, implemented or merged.

Next: configuration-version-aware provider recovery. Distinguish invalid
credentials from item failures, pause the affected dependency until its
configuration changes or a controlled health check succeeds, then resume due
work without resetting item budgets. Acceptance should demonstrate one bad key
cannot consume an entire library's retry budgets, with a concise reason and
next action in the UI. Reuse existing provider configuration and diagnostics
rather than creating another general-purpose dashboard.
