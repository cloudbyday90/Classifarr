# Cross-library inventory overlap outcome

Date: 2026-09-05. Implementation and local verification complete.

## Delivered behavior

The Libraries page automatically reads a bounded comparison of active libraries.
The new authenticated, rate-limited `GET /api/libraries/overlap` endpoint returns
movie/TV identity intersections, both directional denominators, and common traits
with coverage. Duplicate placements count once per typed identity and library.
Conflicting duplicate observations remain unknown for that trait, with explicit
counts. Missing identities and traits do not establish negative evidence.

The implementation uses separate ESM query, cohort, comparison, service and route
modules. It reuses existing observation normalization and TMDb provenance without
changing row-based profile distributions. The client uses its named GET API helper
and separate summary/trait components. No schema or dependency changes, provider
calls, new worker, classification writes, semantic routing or release are included.
README, Unreleased and the prior design/outcome chain link to this work.

## Real local Compose assessment

The current service was executed inside the existing Compose container against
its actual inventory. That running image predates the observation migration, so
the current metadata projection was created only in a transaction-local scratch
schema; the service query used that function with unchanged projection semantics.
Source queries ran under repeatable-read and read-only settings. The private DDL
was rolled back and scratch relation cleanup verified. No live migrations or
application deployment were performed.

| Measurement | Observed result |
| --- | --- |
| Active / selected / excluded libraries | 10 / 10 / 0 |
| Inventory rows | 6,692: 5,030 movie and 1,662 TV |
| Identified / missing-identity rows | 6,659 / 33 |
| Distinct identities summed across library cohorts | 6,659; this is not a globally deduplicated catalog size |
| Repeated placements within a library/type | 0 |
| Same-type library pairs / pairs with shared identities | 20 / 2 |
| Pairs with insufficient identity coverage | 0; partial coverage still limits some comparisons |
| Oversized trait rows withheld | 0 |
| Rating / genre / studio observed identities | 6,494 / 6,657 / 6,594 out of 6,659 cohort identities |
| Attributable keywords / original language | 0 / 0; insufficient coverage in this older running image |
| Conflicting duplicate observations | 0 |
| Service source reads / elapsed time / response size | 1 / 1,675 ms / 73,524 bytes |
| Independent SQL comparison | Every per-library identity count and pair intersection matched |
| Provider requests / live source writes | 0 / 0 |

This is an inventory measurement and deterministic correctness check, not an
independently human-labelled classification study. The existing readiness and
frozen-study preflight gates remain unchanged. No claim about measured semantic
classification accuracy follows from these counts.

## Verification

- Focused backend tests cover typed IDs, asymmetric overlap, duplicate consensus,
  conflict stability under row reordering, missing and malformed identities,
  provenance, bounded common values, aggregate-only responses, routing order,
  authentication, parameter rejection, rate limits and database failure.
- Seven PostgreSQL integration tests exercise the real query and projection,
  inactive/empty libraries, deterministic library selection, 20,000 versus 20,001
  rows, oversized traits, and execution in a read-only transaction.
- Client tests exercise the API helper, coverage tables, unknown/conflict states,
  escaped source text, automatic loading, errors/retry, empty/capped responses and
  late responses after unmount.
- Chromium checks automatic loading, semantic captions, keyboard disclosures,
  mobile page overflow, text contrast of at least 4.5:1, and zero mutation requests.
  Screenshot inspection identified crowded mobile headers; a minimum table width
  and cell padding retain readability inside a labelled, keyboard-focusable scroll
  region. This is scoped verification, not a complete WCAG conformance audit.

The full client coverage run passed **320 suites / 4,339 tests**; final focused
client checks passed **52 tests**, and the Chromium check passed after the layout
fix. Client coverage measured 87.71% lines and 77.23% branches. The final focused
backend run passed **23 tests**, including the actual rate-limit boundary.

The full backend coverage run passed **1,054 suites / 29,714 tests**. Backend
coverage measured 90.08% lines, 80.44% branches and 92.57% functions. The final root
coverage ratchet passed for both packages. The final `classifarr:test` Docker image
built successfully, including the production client build. The running Compose
application was not redeployed.

Lint (without warnings), server/client type checks, static ESM imports, strict
ESM mock shapes, Knip and production dependency checks, all 992 Markdown files,
and migration naming/schema snapshot integrity passed. The client API instructions
reference a ratchet script under `client/scripts` that no longer exists; the
repository's current root `npm run coverage:ratchet:check` command is used instead.

## Recommendations and limits

The [design](library-overlap-design.md) records official W3C, PostgreSQL and OWASP
sources, August 2026 date qualification, API details and alternative tradeoffs.

| Approach | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Current bounded snapshot | Real observations with explicit coverage; no routine operator setup | Up to 12 active libraries and 20,000 selected inventory rows | Recommended current layer |
| Stored incremental overlap index | Could serve larger inventories cheaply | Adds invalidation, synchronization and recovery complexity | Defer until measured size/latency warrants |
| Automatic observation health summary | Explains unknown traits and stalled acquisition without item-by-item review | Needs careful state and freshness definitions | Next product item |
| Semantic counter-evidence | May identify ambiguous placements | Requires the existing independent evaluation and readiness gates | Continue to defer; review-only if justified |

Recommended stack: source sync → guarded typed identity and attributable metadata
→ automatic profiles → bounded overlap → automatic coverage/freshness health →
evaluated classification assistance.

Implemented subsequently in the
[observation-health design](library-observation-health-design.md) and
[measured outcome](library-observation-health-outcome.md).

**Next item at this assessment:** expose bounded, read-only observation health by library: identity
gaps, never-observed/due/backoff states, attributable keyword/language coverage,
and last successful observation time using existing inventory clocks and queue
state. Verify automatic acquisition convergence after the current build is deployed;
an older image lacking the new metadata is not itself evidence of a new enrichment
bug. Keep this an automatic summary, without a per-item operational workflow.

## PR selection and delivery

The GitHub MCP open-PR listing was empty at task start and on the delivery recheck.
No open PR could be selected randomly for local implementation, and no closed PR
was substituted. The user authorized committing and integrating all repository
changes into `origin/main`; no release will be created.
