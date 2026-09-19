# Outlier-aware library recovery

Date: 2026-09-19. Follow-up to [neighborhood backfill](neighborhood-backfill-outcome.md).

## Problem and decision

The last Compose assessment recovered missing groups for eight of ten libraries.
The remaining two had tiny discarded groups. The fit correctly omitted those
groups, but it also discarded their assignment information. Recovery then had to
reconstruct memberships from the retained centroids and reject the entire library
when those centroids did not account for every description.

Preserve the selected fit's original membership partition: supported groups and
explicitly unassigned descriptions. Validate this private partition against the
current exclusive source hashes before it can influence backfill. An unassigned
description is not necessarily bad metadata or a wrongly placed item; it simply
has no retained group in this fit. It continues through ordinary recovery.

## Implementation boundaries

- Opt in to membership capture only for background library profiles. Keep the
  ordinary geometry and held-out benchmark outputs unchanged by default.
- Produce membership in the fit worker at the same point that groups are retained
  or discarded. Retain only the selected start's hash lists, not all starts'
  assignments, source text or vectors. Account for the extra bounded cache weight.
- Version the private profile contract so older cached profiles cannot silently
  masquerade as membership-aware profiles. No product release/version change.
- Use a separate ESM validator for structure, group/support alignment, duplicate
  hashes, complete partition accounting and exclusive media/library scope.
  Verify supported centroids against their actual source members before recovery
  reference publication. Reject malformed evidence rather than repairing labels.
- Only complete, converged profiles with supported groups can establish a
  reference. Valid groups may coexist with unassigned descriptions. The unassigned
  set never contributes group support or receives group priority.
- Preserve per-library source bindings, 30-minute reference expiry, fresh snapshot
  checks, cancellation, fair fresh-work capacity, due retries and provider cooldowns.
  Invalid membership falls back to ordinary backfill and existing redacted profile
  validation/rebuild diagnostics. Do not invent destinations or raise confidence.
- No new tables, endpoints, controls, alerts or polling. Existing SWR and accessible
  status behavior remain unchanged; keep private partitions out of status/logs.

## Alternatives, pros and cons

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Reject all libraries with discarded members | Simple fail-safe behavior | Healthy groups lose targeted recovery | Retain only as malformed/unknown fallback |
| Assign every item to a surviving centroid | Easy reconstruction | Invents memberships and inflates support | Reject |
| Keep original groups plus unassigned members | Exact accounting, automatic recovery, no extra inference | Bounded private hash storage and validation work | Implement |
| Change the clustering algorithm or tune thresholds | Could change outlier behavior | Changes benchmark meaning and routing evidence | Separate measured work, not this fix |
| Persist references across restarts | Faster recovery after long outages | Retention, schema and stale-evidence complexity | Defer |

Final stack: selected fit partition → source/geometry validation → private
source-bound reference → fair priority backfill → existing checkpoint/retry flow.
The implementation should improve recovery coverage without changing group
geometry, scoring, classification or the number of model calls.

## Official research verified in September 2026

- [scikit-learn KMeans documentation](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html)
  distinguishes fitted labels from centroids and warns that early termination can
  leave them inconsistent. This supports retaining assignments and checking
  convergence. Classifarr uses its own spherical fit, not scikit-learn; these are
  design principles, not a claim that the two algorithms are identical.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports bounded, validated diagnostics, exclusion of private material and
  keeping logging failures from interrupting recovery. Reuse the existing fixed
  vocabulary and deduplicated rebuild path.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains programmatic status announcements and warns against excessive live-region
  chatter. It does not require generating extra messages. No UI expansion is needed.
- [DefinitelyTyped's Node definitions](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node)
  are the upstream development dependency selected separately through PR #535.
  Type updates do not upgrade the application's Node runtime; verify both type
  checks and runtime tests rather than treating compilation as compatibility proof.

## Verification plan

Test retained groups with singleton/two-member/degenerate groups, sparse and
unconverged fits, absent/duplicate/foreign/shared hashes, tampered support/centroids,
version mismatch, cancellation and source changes. Prove default benchmark outputs
and scoring remain unchanged. Exercise a real worker and PostgreSQL checkpoint
recovery. Run full local suites, static checks, coverage ratchets and read-only
Compose masking/restoration across movie and TV libraries. Record outcomes and
remaining limitations in a separate document; never delete live vectors to test.
