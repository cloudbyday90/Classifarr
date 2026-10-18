# Gateway catalog scheduling — design

Date: 2026-10-17. The user approved preserving historical verification records
while retaining only currently required recovery bundles in new catalogs.

## Scope and safeguards

Implement a versioned catalog contract, independent UUIDv7 capture jobs and a
single lock-owning orchestration boundary. Keep legacy v5 snapshots readable with
their original dependency requirements. New catalogs select the latest two
verified inference bundles plus every permanently protected bundle. Historical
rows remain exact; an old `verified` row is not a promise that its files are part
of every later recovery set. No protection expiry or live history deletion is
authorized by this change.

An archive omitted from a new set still cannot be retired while an older retained
or retiring catalog references it. Recheck two replacement catalogs before
retiring an old catalog. Check old catalogs against their recorded immutable file
index, not today's protection metadata. Allow only the existing validated,
monotonic protection promotion on a pinned inference job; identity, manifest,
receipt and original file bytes stay immutable.

The optional worker captures initially, then daily when source maintenance or
inference history changes, or hourly near the existing resident-history threshold.
It establishes a second recovery copy when possible. One job is admitted at a
time. Exact snapshot digests are integrity evidence; scheduling fingerprints
exclude the catalog worker's own successful publication and acknowledgment.
Inference/protection/cleanup changes remain visible. No page visit or new admin
button is required. Normal installations without optional gateway setup do no work.

## Budgets, failures and publication

Keep the original policy hash, three combined attempts per compatible inference
revision, and persisted five-/30-minute cooldowns. Existing successful attempts,
failed attempts and second copies count. Maintenance-only changes do not mint a
fresh budget. Exhaustion can therefore prevent a second catalog copy; report it
and stop, never reset or raise limits. Existing unfinished jobs remain unknown.

Capture uses the same read-only PostgreSQL snapshot for rows, hashes and dump.
Only the maintenance session owns exclusion. SQL admission requires that lock,
checks both job ledgers, and fences inference maintenance during pending catalog
publication/verification. Inference requests continue. A confirmed child failure
may consume another attempt after cooldown; abrupt death remains interrupted.
Published bytes, verifier result and registration are separate durable steps.
Repeated acknowledgment must reuse the same job and result, not create a copy.

Keep the combined 1 GiB managed-storage budget, 256 MiB dump ceiling, bounded
row/batch reads, 120-second coordinator work and isolated verifier resource limits.
Keep two retained catalog roots plus a replacement; fixed files only are retired.
Missing files, identity/schema drift, unexpected permissions, uncertain writes or
insufficient capacity refuse work. No automatic retry of ambiguous side effects.
The verifier has no live DB credentials, provider access or Docker socket. Restores
are inert and do not authorize worker activation or replay.

## Research, alternatives and recommendation

Official sources were discovered and opened through MCP on 2026-10-17:

- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html?trk=article-ssr-frontend-pulse_little-text-block)
  supports a synchronized snapshot for concurrent readers. We use it to bind
  metadata and dump contents without pausing inference.
- [Restic retention](https://restic.readthedocs.io/en/stable/060_forget.html?highlight=%22keep-tag%22)
  separates removing snapshots from pruning data no retained snapshot needs.
  We apply that distinction to catalog roots and shared inference bundles.
- [AWS retry guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  calls for idempotent operations and bounded backoff, with permanent errors
  failing fast. Our durable job identity preserves attempts across restarts.

Recommended stack: modular ESM, PostgreSQL 18/native UUIDv7, SQL-enforced admission,
restricted reader/maintenance roles, fixed-file publication and isolated native
restore. No added npm package or AI decision. Benefits are repeatable progress and
auditable recovery; costs are extra SQL state, I/O and conservative refusal when
budgets are exhausted. Keeping every historically verified file forever is simpler
but prevents rotation. Dropping old references immediately is unsafe and rejected.

## Verification and completion

Use unit/model tests for stable scheduling and shared attempts; real PostgreSQL
for admission races, protection promotion and durable state; native isolated
rehearsals for v5 compatibility, new captures, restore, delayed/duplicate results,
interruption and dependency handoff. Preserve original attempt values during
tests. Distinguish fixture clock advancement from elapsed cooldowns. Rebuild local
Compose without cache only after the affected gates pass; record exact image and
limitations in a separate outcome. No production rollout, release or tag.

## Optional installation contract

This is not an application migration or an enabled-by-default service. Keep the
existing optional inference/archive/cleanup schemas. For a fresh catalog schema,
apply `database/ollama-gateway-catalog/current.sql`; for catalog v1 apply
`20261017_235000_catalog_jobs.sql`, then `20261018_130000_frozen_snapshot.sql`.
For catalog v2 apply only the latter migration. See the
[frozen-snapshot contract](gateway-frozen-snapshot-design.md). Stop maintenance workers first. The migration
refuses competing locks and unfinished inference jobs; do not mark an unknown
legacy export complete merely to get past that check.

Use the existing SELECT-only source role, adding schema usage for the catalog and
SELECT on `gateway_catalog.job`, and SELECT on the original archive/cleanup
tables. It must have no write privileges, ownership, elevated role memberships or
executable functions in these schemas. The maintenance role needs schema usage,
SELECT/INSERT/UPDATE on `gateway_catalog.job` and `gateway_catalog.snapshot`,
SELECT/INSERT on `gateway_catalog.dependency`, and EXECUTE on
`gateway_catalog.require_lock()` and `gateway_catalog.capture_format()`, in addition to the existing restricted archive
and protection permissions. It cannot write inference or cleanup history. Startup
validates these restrictions; use dedicated roles, not the database owner.

Add `"catalogs": "/catalogs"` to the private worker configuration and a private,
UID/GID-1000 managed directory. Explicitly combine
`docker-compose.gateway-archives.yml` and `docker-compose.gateway-catalogs.yml`.
The overlay adds the separate no-network catalog verifier and mounts; it does not
alter the normal application Compose file. All source/receipt/catalog directories
must be distinct, non-nested and unavailable to untrusted users. Provisioning and
activation are a separate deployment decision, not performed by this change.
