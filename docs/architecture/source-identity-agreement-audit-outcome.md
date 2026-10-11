# Source identity agreement audit outcome

## Implementation — 2026-10-11

Implemented the [read-only audit design](source-identity-agreement-audit-design.md)
on `main`, starting from `6f47422ae5c2baadca395d9f96f62c3702b08f1f`.
The existing candidate lookup now projects catalog agreement and fixed blockers
from its already-validated evidence. It adds no provider reads, database writes,
background jobs, schema changes or approval capability. The UI checks the additive
contract, announces the result and explains why parent-ID agreement is not full
scope verification. Old responses without the audit remain supported.

The seven earlier local approvals were explicit operator decisions backed by
complete episode membership; conflicting parent declarations were not independently
proven equivalent. This change does not replace that missing proof with a vote,
title match or administrator identity. Positive screening still returns both
`completeScopeVerified: false` and `automaticRecoveryEligible: false`.

## Validation so far

- Focused backend: 5 suites, 89 tests passed, including all eight blocker classes,
  no extra provider reads, stale source/config/actor and cancellation rejection.
- Focused client: 58 tests passed, including backward compatibility, malformed or
  contradictory claims, fixed blocker guidance and no added selection/approval.
- Real isolated PostgreSQL: 15 tests passed, including shared advisory admission
  and unchanged retained observations after positive catalog agreement.
- Browser: the first attempt timed out scrolling to the existing overview button,
  before reaching the audit. An unchanged retry passed in 11.4 seconds, including
  keyboard operation, status text, 320/390 px reflow, unchanged unresolved count
  and zero implicit approvals. No timeout or assertion was weakened.
- Both typecheck paths, full lint, tooling 40/40, copyright, ownership, both knip
  modes, four policy gates, ESM import/mock-shape checks and Markdown passed.
- Full coverage, image evaluation and final quality results are recorded below
  after completion; this initial record does not claim those checks passed.

## Random open PR trial

Fresh open-PR enumeration returned #555 and #556. Random selection chose
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Applied its exact server dependency diff:
`@types/node` 24.19.2 to 26.6.4, `undici-types` 7.24.6 to 8.9.0.
Script-disabled and reviewed normal installs passed; `npm ls --all` and the
all-dependency npm audit passed. Typechecking failed in `discordDeliveryWriter`:
Discord's bundled Undici `FormData`/`File` types are incompatible with the Node 26
declarations. Tooling passed 39/40; the remaining runtime-major guard correctly
rejected Node 26 declarations for the deployed Node 24 runtime.

Restored the exact manifest/lockfile and reinstalled. Server typechecking passed
again. The trial is not retained or merged, and no compatibility/security guard
was weakened. The registry reports a newer Node 26 declaration release, not a
required Node 24 update. A clean audit is not a claim of universal safety.

## Recommendation stack

1. Ship explicit read-only screening now: low cost, explainable abstention, no
   additional provider load; it intentionally does not clear unresolved items.
2. Next, combine positive screening with fresh complete episode/group evidence
   under one revision. Advantage: a foundation for provable self-healing;
   limitation: same-catalog agreement alone cannot prove independent equivalence.
3. Only then add durable system-verification provenance and bounded upgrade
   backfill through existing owned sync. Keep genuine conflicts/incomplete groups
   unresolved, and honor revoked intent. Never copy local human approvals into
   deployed installations.

No release, version bump, Unraid mutation or shared Plex/Ollama change is part of
this batch. Official sources and design alternatives are in the linked design.
