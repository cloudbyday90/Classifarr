# Shared-catalog study outcome

Date: 2026-10-06. [Design and official research](comparison-catalog-study-design.md).

## Implementation

The new `--comparison-catalog` profile uses one fresh migrated application database.
Real import ownership, metadata completion, catalog queries, vector SQL, readiness
gates, revision hints and refresh schedules replace the extra private catalog.
Synthetic transports and vectors remain explicit fixture boundaries. Small ESM
modules separate fixture preparation, orchestration and result validation.

The load's drain is now single-flight and shutdown joins an in-flight drain before
stopping its consumer. Dedicated tests cover this ordering, environment/nonempty
database refusal, bounded pages/vector writes, cache-key reuse, incomplete receipts,
sanitized traces and cleanup after failure. Existing comparison/recovery result
contracts remain unchanged. No production service, admission limit, schema or
garbage-collection behavior changed.

Verification before the image run: 161 backend suites / 2253 tests passed; the final
four-suite focused rerun passed 78 tests, including two additional drain regressions.
All 40 tooling tests, server typecheck/lint, both dependency-analysis modes,
static ESM and copyright checks passed. Ownership review inspected the complete
three changed launchers and new callees before updating their reviewed hashes;
the gate then passed, without declaring existing unresolved writer debt resolved.
The preceding main commit's seven CI/security workflows also passed; those are
baseline results, not verification of this new image.

## PR trial

Fresh random selection chose open #555 at
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact two-file diff was applied
locally. Seven runtime-policy tests passed and the client runtime-major test
failed: Node 26 declarations do not match deployed Node 24. Only the trial changes
were reverted; the restored eight policy tests passed in the 40-test tooling run.
No install, retained dependency change or merge. `npm outdated` also identified
PostCSS 8.5.29 and Vite 8.3.3 as later patch candidates; neither was mixed into
this memory experiment. The typings decision follows
[DefinitelyTyped version alignment](https://github.com/DefinitelyTyped/DefinitelyTyped).

## Image and local evaluation

Pending the clean-source no-cache build and bounded shared-catalog measurement.
Before rebuilding, a private 75,643,924-byte local database archive passed checksum
and archive-list verification, and the exact previous image was retained as
`classifarr:pre-memory-1ca81666-fac4-4e6f-b32a-c5233c228d8a`:
`sha256:6604eb9bf2c2df8b9909092cfc91ff709ed1f88a6404da9e4642c888eb599069`.
An archive check is not a restore rehearsal. Unraid was not accessed.

## Recommendation

Keep memory safeguards unchanged. Use this run's complete-cycle measurements to
choose the next allocation experiment only if they identify a contribution worth
testing. Workload completion without a pressure refusal does not establish recovery
after pressure; failed or incomplete evidence must remain visible.
