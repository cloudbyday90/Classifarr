# Provider-aware routing checks outcome

## Delivered — 3 October 2026

- Radarr and Sonarr lookup failures now retain only safe categories and a parsed
  Retry-After delay. Authentication and configuration failures no longer look
  identical to a temporary outage. Provider bodies, credentials and URLs are not
  attached to the sanitized error.
- A durable per-configuration guard pauses background checks across items.
  Credential/endpoint revisions invalidate old guard state; frozen destination
  validation still refuses a changed destination. Explicit checks can verify
  repaired access after the cooldown. Neither path adds or moves media.
- Confirmed provider failures preserve the automatic item allowance; crash or
  uncertain persistence retains the reservation conservatively. Opt-out during
  a request remains off. Single-use reservation IDs reject old completions.
- The UI distinguishes a provider pause from item exhaustion, shows the next
  eligible or manual recheck time, and announces results through the existing
  accessible status region. Opening status performs no provider request.
- The additive migration and fresh snapshot enroll no work. Foreign keys remove
  guard rows when the corresponding provider configuration is deleted. Existing
  Compose and Unraid templates need no changes for this component.

## Verification

Full backend coverage run: **1,641 suites passed; 50,331 tests passed**, with one
Windows-only platform skip covered by the separate Linux run below. Full frontend:
**418 files; 5,951 tests passed**. Final small reservation, cancellation and display
refinements also received the focused reruns below; the full runs are not claimed
as separate image-level upgrade/restart rehearsals.

Focused backend checks passed: **143 tests across five suites**, including both
providers over real HTTP and the static ownership regression tests. Real
PostgreSQL routing suites passed **27 tests**, including shared pauses, manual
recovery, credential changes, Retry-After, third-attempt preservation,
disable-during-flight, reservation replacement, provider isolation and cascade
cleanup. Focused client/API checks passed **30 tests**.

Lint, type checks, ESM import/mock checks, dependency preflight, migration checks,
copyright compliance, production client build, Markdown lint and whitespace
checks passed. Coverage: backend lines **90.03%**, branches **85.50%**; frontend
lines **88.15%**, branches **79.02%**. The coverage ratchet passed with no regressions.

The final schema loaded successfully both as an upgrade from the previous
snapshot and as a fresh installation; the fresh dump matched and contained zero
provider guard rows. An initial varchar check-constraint deparser difference was
removed by using enumerated text before the final round-trip check.

The Linux-only migration-tree test ran in an isolated, network-disabled container:
**5 passed, zero skipped**. No live media-server requests, application database
changes or Docker service replacement were performed. The disposable schema
container and its synthetic databases were removed.

## Limits and next recommendation

This guard covers manual-routing verification, not all provider traffic. Shared
endpoints saved as separate configurations have separate guards. Local polling
revisits blocked items without HTTP, so a very large enabled backlog can delay
the one-item-per-tick scheduler. Checks remain off by default.

The ownership drift gate passes without retiring existing unresolved ingestion
writer debt; it is not a production-wide ownership guarantee. Neither tests nor
the new engineering skill authorize recovery of unknown legacy writers.

Next, add an **image-level upgrade/restart rehearsal for this routing recovery
path**: seed prior-version opt-in state, restart during a check, rotate credentials,
and verify preserved budgets and zero duplicate adds through the authenticated
API. This provides release evidence without requiring a live-provider outage.

GitHub MCP search and the saved CLI login both returned **zero open Classifarr
PRs** during this round. No PR was selected, merged, closed or represented as
implemented. Work stays on `main`; no release is created.

See the [design, alternatives and official research](manual-routing-provider-guard-design.md).
