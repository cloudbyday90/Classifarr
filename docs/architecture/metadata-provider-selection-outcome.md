# Metadata provider selection outcome

Date: 2026-09-07. See the separate
[design, alternatives and official research](metadata-provider-selection-design.md).

## Result

TMDb, OMDb and legacy Tavily now share fixed, deterministic configuration reads
and serialized writes in small ESM modules. Explicit settings saves and restores
reuse the selected row, retain other credential rows and deactivate other active
rows in the same transaction. Repeated TMDb/OMDb restores no longer accumulate
active rows. OMDb saves preserve the selected identity and current usage; TMDb
resolves the current active key on each request so rotations take effect.

The data-only migration consolidates exactly equivalent active settings without
deleting rows or changing any credential bytes. Distinct legacy settings remain
unchanged and continue to produce integrity diagnostics. The application writer
protocol prevents new conflicting active rows from its settings and restore
paths; direct SQL writers can still create drift because no universal unique
active-row index is imposed on unresolved legacy configurations.

There is no new operator workflow, endpoint, dependency or client contract. This
supports reliable automatic observation of existing library content. It does not
establish independent labels, a classifier error profile or permission to route
ambiguous content. Readiness and frozen-study preflight remain required before
review-only semantic counter-evidence can be considered.

## Validation

- Complete backend unit run: **31,176 tests across 1,092 suites passed** in
  194.860 seconds, using two workers and 512 MB idle worker recycling.
- Real PostgreSQL configuration, consolidation and backup integration:
  **79 tests across four suites passed** in 7.399 seconds. Coverage includes
  concurrent empty-table saves, masked saves following rotation, nonblocking
  reads, counter preservation, rollback, repeated restore, disabled states,
  migration idempotence, distinct credentials/settings and counter saturation.
- Existing client provider API contract: **41 tests passed** in 2.81 seconds.
- Server typecheck, scoped ESLint, production dependency checks, ESM static-import
  and mock-shape checks, migration naming and snapshot integrity checks passed.
- A disposable fresh-install container built from the new image passed the full
  schema snapshot comparison through migration 250. Its database and container
  were removed after validation; the existing local volume was not used.

The complete run exposed an existing AI-settings caller of the generic provider
helper; its allowlisted query was preserved. It also rejected generated SQL under
the project's code-health rules, so each provider now owns complete literal
statements. The final full unit run above includes those corrections.

The real local database held three active TMDb rows, two active OMDb rows and no
Tavily rows. Each configured provider had one distinct credential and one distinct
set of operational settings. A transaction preview completed in **69 ms**, reducing
the active counts to one each. It verified all row identities and credential
bytes in memory, then rolled back. No keys or key hashes were printed or committed.

The no-cache Compose build passed from clean source revision
`c7ab2e9255cdb5314c1ebe082e0ce6f4e74b6a00`. Both dependency installs reported zero
audit vulnerabilities. Before recreation, a 44,519,824-byte custom-format database
backup was copied to ignored local storage, checksum-verified and checked with
`pg_restore --list`. The previous image remains available locally for rollback.

The rebuilt container is healthy and reports that source revision. Startup
applied migration 250. All three TMDb rows and both OMDb rows remain, with exactly
one active configuration each; Tavily remains unconfigured. The existing provider
integrity audit now reports **zero invalid providers**, so the measured duplicate
warning is resolved. This outcome update changes documentation only.

All **ten authenticated read-only smoke requests returned 200**, including three
provider settings reads. Their selected IDs/activation and masked keys matched
the shared storage reader, and TMDb runtime selected the same key in memory.
Anonymous settings, overview, health and overlap requests returned 401. Health
and overlap rejected unexpected parameters with 400 and retained `no-store`.
They remained available with 6,692 inventory rows and ten selected libraries,
taking 905 ms and 865 ms in this sample. History remained at 6,775 records, with
ten libraries and zero feedback records. The smoke helper requested zero writes.

The startup/smoke log sample contained **315 informational records, seven
slow-query warnings, zero provider-drift warnings and zero error/fatal records**.
This verifies the local configuration repair; it does not establish external
provider health or eliminate the separate inventory performance warnings.

No client source or endpoint changed, so the full client suite and combined
coverage ratchet were not rerun. Provider probes requiring external calls were
not used for this configuration-only verification.

## Open PR availability

GitHub MCP returned no open pull requests at task start and final readback. There
was no population from which to randomly select a PR; no closed PR was substituted
or merged.

## Recommendation stack and next item

Keep fixed ordered reads, caller-owned transactions, table locks before fallback
reads, stable-ID upserts, masked responses and existing integrity diagnostics.
This removes routine duplicate repair and stale-key handling from the operator.
The tradeoffs are one small credential lookup per TMDb request, brief writer/quota
blocking, retained inactive credentials, and conservative OMDb usage aggregation.
Do not introduce cache invalidation or a unique active-row index without evidence
that their additional state or upgrade constraints are needed.

Next, make **OMDb quota admission atomic**. `omdbQuota.mjs` currently checks usage
and returns a key/row ID; `incrementUsageCounter` runs later. Concurrent requests
can all pass the same remaining-quota check. Day-reset writes can also race with
increments. Use a database-side reservation tied to the selected row, define the
existing day boundary and failed-request accounting explicitly, and validate
parallel admission and midnight rollover with real PostgreSQL tests. The current
change preserves the existing quota policy rather than asserting it is race-free.

No release or tag is created for this work.
