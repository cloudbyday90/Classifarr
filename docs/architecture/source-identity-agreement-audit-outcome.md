# Source identity agreement audit outcome

## Implementation — 2026-10-11

Implemented the [read-only audit design](source-identity-agreement-audit-design.md)
on `main`, starting from `6f47422ae5c2baadca395d9f96f62c3702b08f1f`.
The existing candidate lookup now projects catalog agreement and fixed blockers
from its already-validated evidence. It adds no provider reads, database writes,
background jobs, schema changes or approval capability. The UI checks the additive
contract, announces the result and explains why parent-ID agreement is not full
scope verification. Old responses without the audit remain supported.

In the rebuilt local UI: **Command Center → Metadata issues → See items & recovery
→ Draft a catalog mapping (admin) → Find candidate IDs**. The identifier audit
appears with the existing candidates and per-ID lookup details. Opening the draft
alone does not call providers. Unraid will not receive this UI until a separately
authorized release/deployment.

The seven earlier local approvals were explicit operator decisions backed by
complete episode membership; conflicting parent declarations were not independently
proven equivalent. This change does not replace that missing proof with a vote,
title match or administrator identity. Positive screening still returns both
`completeScopeVerified: false` and `automaticRecoveryEligible: false`.

## Validation

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
  Final screenshot capture used a taller viewport to show the entire narrow panel;
  that run also passed (11.3 seconds). Visual inspection passed. This is not a
  full assistive-technology accessibility audit.
- Both typecheck paths, full lint, tooling 40/40, copyright, ownership, both knip
  modes, four policy gates, ESM import/mock-shape checks and Markdown passed.
- Full frontend coverage: **454 files / 6,757 tests passed** (284.35 seconds).
  The first attempt passed 453 files but hit the existing 10-second ESLint setup
  hook deadline, skipping its 21 cases. After the concurrent full lint scan ended,
  an unchanged full rerun passed every case; no tests or deadlines were weakened.
- Full backend coverage: **1,788 suites / 55,964 tests passed, one existing skip**
  (1,074.993 seconds). The new audit module has 100% statement, branch, function
  and line coverage.
- Current backend and frontend reports passed the unchanged coverage ratchet.
  Server statement/branch coverage: 89.70% / 86.08%; client: 87.19% / 80.86%.
  No coverage baseline was refreshed. Final Markdown and whitespace checks passed.

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

## Local image and retained-data evaluation

Runtime source: `14d7141cad4a08404dfbb33ec965f2148ec46adf` (clean checkout).
The requested Compose build used `--no-cache --require-provenance` and produced
local image ID
`sha256:031facafb3197da11c8168210436a47d58ec2e5e49613fb8d4beed3adff77c59`.
Its OCI revision equals that runtime source. Replaced only the local test service
using `--no-build --pull never --no-deps --force-recreate --wait`; health passed.
This is a local image ID, not a published registry digest or signed attestation.

Before replacement, a 56,565,504-byte custom-format database backup passed local
versus container checksum comparison and `pg_restore --list`. An exact rollback
tag preserves the prior local image
`sha256:cf90825e0952a7f0178bd53ef5f6bbcf79f0d5f67d25732daf135694f50679e1`.
This checks archive readability, not a full restore rehearsal.

At **2026-10-11 07:31 EDT**, ran four serial audits through the real candidate
service and installed provider adapters. Database sessions enforced read-only
transactions with 10-second statement and 1-second lock timeouts. This direct
service probe is not an authenticated-browser session test. The existing endpoint
and transport guards are covered separately by regression tests.

| Parent conflict | Available candidates | Blocking evidence | Lookup reference |
| --- | --- | --- | --- |
| Multiple TVDB IDs | 1 | Missing catalog match; another scope also matched | `7fe488bc-4185-4117-ba98-ab2781e5a751` |
| Multiple TMDb IDs | 2 | Multiple works; external lookup matched only another scope | `ac402fc2-4206-4d68-bf47-ebb94fed45ca` |
| Multiple TVDB IDs | 1 | Missing catalog match | `15e5097d-c3f6-49de-8740-d437078f6683` |
| Multiple TMDb IDs | 3 | Multiple works; no external confirmation; missing matches | `8d6e6130-cc8a-4291-a463-2aefcf365a51` |

All four returned `review_required`; all retained false scope/recovery flags.
Unresolved count stayed **4 before / 4 after**, with zero mapping approvals and
zero provider writes. These screening results do not prove which absent ID is
obsolete, repair incomplete episode metadata, or verify independent equivalence.
No titles, raw source IDs, credentials or provider payloads are committed here.

The startup aggregate probe found ten covered active libraries, consistent pending
embedding counts and one existing `LibraryComparisonContext` warning with
`cached_vectors_incomplete`. This audit does not fix or suppress that separate
vector-coverage warning. Memory and ownership safeguards are unchanged.

After normal startup sync began, a second read-only probe verified all seven
previously approved mappings remained materialized with historical application
dates and no pending recheck status. Four items still remained unresolved. The
five saved-status reads took 250.56 ms initially and 6.57–8.37 ms thereafter;
these are spot measurements, not a sustained performance benchmark.

Ran `dumpSchema()` after rebuilding, against the exact image in a fresh isolated
container: network disabled, 1 GiB memory, two CPUs and 256 PIDs, no live appdata.
The snapshot through `20261010_220000_source_catalog_mappings.sql` and 22 seed
migrations was unchanged. Fresh setup had zero invented classification/embedding
work and zero unresolved identities. The runner verified its exact temporary
container and data directory were absent after cleanup. No published-release,
ARM64 or Unraid upgrade claim follows from this local x64 check.

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
