# Express 5.3 runtime compatibility — outcome

## Change and evidence

Work performed on `main` on 2026-10-11, without an application version bump or
release. The [design](express-530-design.md) records official-source research,
tradeoffs and acceptance criteria. Express is locked to 5.3.0, content-disposition
to 2.0.1 and content-type to 2.1.0. Two nested content-type 2.0.0 copies are
deduplicated. No unrelated package, security override or installer policy changed.

Before upgrading, the new six-test real HTTP suite failed one test under Express
5.2.1: chunked `res.send()` also emitted Content-Length, and the client rejected
the ambiguous framing. The other five tests passed. With 5.3.0, all seven focused
suites / 80 tests passed. A separate final application-suite check passed 32
tests, including newly added production async-error sanitization and the default
JSON body-size limit. These are synthetic HTTP checks, not evidence of a reported
production framing incident.

The script-disabled review install and normal policy-controlled server install
passed. `npm ls --all` is clean and the full server npm audit (including development
dependencies) reports zero advisories on 2026-10-11. A zero audit is not a complete
security assessment. The application keeps its existing custom error middleware,
CSRF/CORS controls, generic API 404, backup-name validation and memory/ownership
safeguards. All new application-owned JavaScript is ESM test code; upstream
transitive package module formats are not rewritten.

## Random open PR trial

The fresh random selection from open PRs #555 and #556 chose
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Its exact client manifest and lockfile
changes were applied locally: `@types/node` 24.19.2 to 26.6.4 and `undici-types`
7.24.6 to 8.9.0. Registry integrity values matched and no install hooks were added.

Both install modes, dependency-tree validation, full audit and client typecheck
passed. The tooling suite passed 39/40 checks: the sole failure correctly rejected
Node 26 declarations against deployed Node 24. The exact trial was restored, not
merged; restored install, tree, audit and client typecheck pass. The client manifest
and lockfile are unchanged. Newer registry declarations are not a reason to widen
runtime support or weaken the alignment guard.

## Identity investigation

The [separate fresh identity audit](source-scope-audit-20261011.md) explains all
eleven local unresolved records: seven complete single-series episode proposals,
two single-episode gaps and two incomplete grouped-source mappings. Catalog
membership is not identity approval. Following separate explicit user approval,
the seven complete proposals were freshly revalidated and approved locally through
the existing service, with seven durable audit records and a fresh verified backup.
They await normal owned sync; approval is not completed inventory backfill. The
other four remain unapproved. No source metadata was changed and no fresh Unraid
count is claimed. See the audit's subsequent-operation section for the boundary.

## Quality and local image checks

Lint, both workspace typechecks, development/production Knip checks, all 40
tooling checks, ownership and ESM gates, copyright and Markdown validation passed.
The four production naming, language, delivery-boundary and runtime-maintenance
audits passed. The full frontend coverage run passed 454 files / 6,716 tests:
87.18% statements, 80.79% branches, 86.78% functions and 88.96% lines. The full
backend unit coverage run passed all 1,786 suites / 55,906 tests, with one existing
skipped test: 89.69% lines/statements, 86.07% branches and 91.09% functions. The
coverage ratchet passed using these current reports, without a baseline change.
No database-driver/schema change was made; a full PostgreSQL integration matrix
was not rerun for this HTTP-only batch. The exact-image fresh-schema check below
is separate from unit coverage.

The no-cache Compose build succeeded from clean source commit
`e40cd652753d4dd12d7ac0b6c4a6831c83c46457`. The immutable local image ID is
`sha256:0cca616a90a433f243d5edd5af66a94ba938f8c44160660732f2ab58cad6ef50`, with
that commit in its OCI revision label. This is a local image identity, not a
published registry digest or release provenance claim. Later verification notes
change only Markdown excluded from the image context.

A checksum-verified, readable 76,913,614-byte local database archive and exact
old-image rollback tag were retained before replacing only the local Classifarr
service. The replacement runs Node 24.21.0 and Express 5.3.0, is healthy, returns
HTTP 200 with database connected, and preserves generic JSON 404 and security
headers. It runs as `1000:1000` with a read-only root filesystem, unchanged 2 GiB
limit, zero initial restarts and no OOM kill.

Health is not a claim that every optional background task is clean. The post-start
log check found a comparison-context invalidation warning and an OMDb connection
timeout, logged as one provider error and one integrity warning
(`UND_ERR_CONNECT_TIMEOUT`). These remain visible for follow-up; no provider
credentials, deadlines or safeguards were changed to suppress them.

After building, `dumpSchema()` ran against a fresh network-isolated container of
the exact new image, bounded to 1 GiB, two CPUs and 256 PIDs. The tracked schema
is unchanged through `20261010_220000_source_catalog_mappings.sql`. Fresh-install
checks found no invented pending work or unresolved identities. The owned test
container and temporary data directory were removed and their absence verified.

A read-only local check at 09:36:03 UTC still found eleven unresolved identities
(nine source-review, two retry-wait) and ten current library captures. No mapping
approval had been performed at that point. After the separately authorized seven
approvals, the count still remained eleven pending materialization. No provider
write or forced sync was performed. Unraid and shared provider configuration are
unchanged.

## Recommendation stack

Retain the tested bounded Express upgrade. For identities,
observe the seven approved mappings through normal owned sync, then investigate
the two episode gaps and grouped-season worksets separately.
For tooling, the next small batch is Knip 6.40.0 to 6.41.0; client Playwright,
Vue tooling/router and the TypeScript major belong in separate compatibility
reviews. Do not bundle those updates or a release into this change.
