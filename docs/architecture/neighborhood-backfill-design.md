# Neighborhood-aware automatic backfill

## Decision and scope

Date: 2026-09-19. Follow-up to the [coverage benchmark](library-coverage-robustness-outcome.md).
The previous benchmark showed that a small content group can disappear while
overall vector coverage remains above 99%. Global coverage is not evidence that
every kind of content is represented, and neither measure is classification confidence.

Keep a private, expiring reference from a fully covered, validated library profile.
When cached descriptions disappear, prioritize the missing members of its least
covered groups. Learn groups from description vectors, never library names, genres,
titles or hand-authored categories. This improves recovery, not routing authority.

## Architecture and safety boundaries

- A scheduler-owned ESM service is shared by the profile and backfill workers.
  It retains only private description hashes, group memberships and source digests;
  no extra model calls, database tables, HTTP endpoints or UI controls.
- Prepare references from complete libraries with a converged selected fit whose
  retained groups account for every exclusive description. Reconstruct assignments
  and check support counts; ambiguous/inconsistent geometry remains unknown.
  Shared descriptions and duplicate copies never become extra library votes.
- Publish only after the existing fresh snapshot, representation, configuration,
  revision and cache-budget checks pass. Bind each reference to media type,
  distinct description hashes and full cross-library memberships. Changed text,
  membership, provider configuration or model digest invalidates affected evidence.
- Retain the last complete reference across partial-cache refreshes for at most
  30 minutes. Partial fits cannot renew its lifetime. Restart, stop and configuration
  changes clear it. Unknown/expired evidence uses ordinary backfill immediately.
- Less than 90% coverage or fewer than three remaining members identifies a group
  for repair priority. These are operational recovery thresholds, not correctness
  claims. Lowest coverage groups go first; half of each fresh batch remains available
  for ordinary missing descriptions, borrowing unused capacity in either direction.
- Preserve eight calls per pass, batches of eight, oldest due singleton retries,
  per-description jitter/backoff, provider-wide cooldown, cancellation, admission
  checks and validated cache checkpoints. Priority never bypasses isolation.
- Only fixed aggregate counts enter existing scheduler reports. No titles, hashes,
  vectors, endpoints or model responses enter logs. Priority failure falls back to
  ordinary recovery; it must not make otherwise recoverable descriptions fail.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Existing FIFO backfill | Simple, no reference needed | Cannot identify a lost minority group | Keep as fallback |
| Fresh global coverage only | Cheap availability check | Can hide concentrated loss | Insufficient alone |
| Last-complete group reference | Content-agnostic, automatic, bounded | Cold starts and expired/changed sources are unknown | Implement |
| Persist all group references | Survives restart and long outages | Schema, retention and stale-evidence complexity | Defer pending operational evidence |
| Increase confidence / auto-route now | Fewer reviews | No independently verified correctness evidence | Reject |

Final stack: validated cache checkpoints → source-bound complete reference → fair
priority planning → existing isolation and provider recovery → scheduled profile
reconciliation. Keep the interface quiet; no new acknowledgements or manual jobs.
Evaluate remaining unknown coverage before adding persistence or routing changes.

## Official research, verified September 2026

- [AWS retry with backoff](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  supports bounded retries and idempotency rather than retry storms. Preserve the
  existing checkpoint and cooldown contracts; priority only changes fresh work order.
- [NIST AI RMF 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10)
  provides the risk-management context for measured, documented evaluation. The
  numeric recovery thresholds here are project choices, not NIST requirements.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  informs fixed, sanitized diagnostics and exclusion of private source content.
- [W3C WCAG 2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  addresses automatically updating information. This backend-only change adds no
  auto-updating UI or alerts and preserves existing refresh/pause behavior.
- [GitHub secure Actions guidance](https://docs.github.com/en/actions/reference/security/secure-use)
  supports immutable full-SHA action pins and least privilege for the separately
  selected PR #531. No workflow permission or trigger expansion is needed.

## Verification plan

Cover minority-group loss, recovery, movie/TV separation, shared and duplicate
descriptions, stale sources, configuration/model changes, TTL, cancellation,
invalid geometry, atomic publication, restart fallback, fair budgets and isolation.
Run focused/full suites, existing database integration tests, static checks and
coverage ratchets. Rebuild local Compose without deleting data or injecting live
faults. Record results separately in the outcome document.
