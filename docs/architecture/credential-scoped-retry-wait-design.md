# Credential-scoped retry wait design

Decision: September 29, 2026. Unreleased; no deployment or release.

## Root cause

Provider admission already tracks credential generations, but enrichment retry
cooldowns were written by dependency alone. An item also retained its own future
deadline. Changing a rejected key therefore left two gates that could still
postpone recovery, despite admission recognizing the replacement credentials.
Deleting all waits on settings changes would discard valid quota and pacing
evidence and could reopen an unrelated provider.

## Design and invariants

Reuse existing provider pacing stores and the claim-fenced retry transaction.
Three small ESM modules separate request evidence, wait persistence and read-only
due-time policy. No new daemon, broker, polling loop or external service is added.

1. Capture the selected provider, configuration ID and opaque credential
   generation at admission/request time. A private WeakMap carries evidence
   through errors and retry results; upstream error properties cannot forge it.
   Multi-provider failures are attributable only when every attempt is known.
2. Persist at most four contexts, bounded to 1 KiB, and the exact item deadline
   they explain. No key, key hash, response body, title or external URL is stored.
   Transient/authentication cooldowns use the existing generation-scoped pacing
   stores. Admission waits do not extend those stores again.
3. On reads, an item deadline becomes effectively due only when an enabled,
   key-present, unrejected configuration for a previously attempted provider
   differs from the recorded context. Exact deadline equality is required: old
   evidence cannot waive a newer deadline written by another component.
4. Claims, dispatch, statistics and readiness share that read-only expression.
   This merely permits reconsideration. Fresh provider admission still enforces
   pacing, credits and current credentials before every outbound request. Existing
   item eligibility, source checks, leases and attempt limits remain authoritative.
5. A late old-key response cannot establish a replacement-key cooldown. Verified
   same-key recovery transfers existing web-search pacing to the new generation,
   as OMDb already does. Saving the same key does not itself reset the generation.
6. Clear context on each committed result before recording a new wait. Day/month
   resets and unknown legacy dependency cooldowns remain unscoped and expire
   normally. The migration does not guess historical credential ownership.

Configuration/provider locks follow the existing ordering; multi-provider results
sort configuration contexts before locking. Result persistence inherits the
current transaction's lock, statement and transaction timeouts. No lock spans
HTTP or sleep. The read-only configuration view exposes no secrets. Existing
Vue/SWR observers and API shapes remain unchanged.

## Official sources and tradeoffs

Sources were discovered and opened through search/MCP during September 2026.

- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines Retry-After timing.
  Retain bounded header parsing and meaningful provider waits; credential changes
  are not authority to clear all waits.
- [PostgreSQL locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  supports short, consistently ordered transactions. Reuse the selected
  configuration locks instead of adding a second coordination mechanism.
- [AWS retry/backoff guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  emphasizes transient failures and retry safety. Preserve bounded backoff,
  attempts and durable admission instead of draining a newly eligible backlog.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  supports concise status updates without moving focus. Reuse the existing
  pausable status presentation; do not announce every provider attempt. This
  change is not a new accessibility-conformance audit.

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Existing pacing plus bounded request context | Durable recovery; provider isolation; no new service | Small context per waiting item and due-query work | Adopt |
| Clear waits whenever settings are saved | Simple immediate retry | Discards valid limits and uncertain history | Reject |
| Keep dependency-wide waits only | Conservative and simple | Repaired credentials still wait unnecessarily | Legacy fallback only |
| Add a broker or workflow engine | Dedicated scheduling infrastructure | New deployment and recovery boundaries | Not warranted here |

Recommended stack: small Node ESM services, PostgreSQL transactions and
generation-scoped admission, the existing bounded scheduler, Express APIs and
Vue/SWR read-only observers. This is cooperative recovery, not exactly-once
upstream execution or an account-wide limit across external applications.

## Verification and rollback

Use disposable PostgreSQL with mocked HTTP to exercise the actual lookup,
router, admission and retry paths. Cover restart, replacement keys, same-key
saves, rejected replacements, stale responses, independent providers, changed
deadlines, legacy waits, quota, library eligibility and read-only summaries.
Keep existing claim/source/maintenance regressions. No paid requests are needed.

Apply the additive migration before starting new code. An application rollback
can leave the nullable columns and view in place; older code conservatively
waits until stored deadlines. Never delete live wait records to force recovery.
Existing unfenced writers and external provider clients remain outside this
coordination boundary.
