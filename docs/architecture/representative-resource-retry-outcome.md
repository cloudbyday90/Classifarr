# Representative resource retry outcome

Date: 2026-10-06. [Design, tradeoffs and official sources](representative-resource-retry-design.md).

## Implementation

The ESM `representativeRefreshRetry` factory separates resource eligibility from
genuine failure backoff. Typed discovery deferrals impose a fixed 60-second minimum
without increasing or clearing the failure counter. Real failures retain the
existing exponential backoff and one-hour cap. Existing successful/configuration
reset points, cache behavior, cancellation, readiness, single-flight execution,
memory thresholds/hysteresis and publication checks are unchanged. No new timer,
migration, persistent state, dependency, operator setting or forced GC.

## Verification

Against the previous refresher, the final new behavioral suite failed seven tests
and passed three. With the change, all four focused suites / 59 tests passed.
These exercise repeated pressure/unknown-memory/contention deferrals using the real
admission policy and a fixture lease, exact and late eligibility, retained genuine
failure history, readiness pauses, the unchanged scheduler registration,
cancellation and pressure at the publication checkpoint. Separate policy tests
verify the one-hour cap and ephemeral restart behavior. Fixture clocks prove logic,
not elapsed production cooldowns; the image study remains required.

Broader validation passed 178 suites / 2480 tests. Server typecheck, lint, normal
and production dependency analysis, all 40 tooling tests, static imports,
copyright, ownership and Markdown checks passed. Ownership review hashes were
not refreshed; this does not claim existing unresolved writer paths are fixed.
Image/local evaluation is pending.

## Random PR trial

Fresh enumeration found two open PRs; random selection chose
[server typings #556](https://github.com/cloudbyday90/Classifarr/pull/556) at
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact two-file manifest/lockfile
change was applied locally. The runtime-major policy rejected Node 26 declarations
for the pinned Node 24 deployment. Those trial changes alone were reverted before
installation; no merge, retained dependency change or runtime-major upgrade.
Registry metadata confirmed 26.6.4 depends on undici-types ~8.9.0. The restored
policy checks are included in broader validation.

The server outdated check also found dotenv 18.0.6, express-rate-limit 8.7.1,
js-yaml 5.4.3 and knip 6.40.0 available. These were not installed or assessed as a
security batch here. They remain separate from this retry behavior change.

## Image preparation

The local testing database backup is 75,625,484 bytes and passed checksum and
archive-list verification (not a restore rehearsal). The previous image
`sha256:da153c1df913cc06976ac134d2b1505940fafd3bc1d3b20cc9c327b9e5eb019f`
was retained as `classifarr:pre-memory-3b711508-67d5-4800-983d-efa677ff01cc`.
No Unraid or unrelated container access.

## Recommendation

Evaluate the unchanged shared-catalog workload before claiming natural recovery.
Keep the previous failure trace; do not raise limits, force GC or relax completion.
The remaining comparison build/fresh-read allocation peak is the next candidate
after retry behavior is measured. No release, tag, new branch or Unraid access.
