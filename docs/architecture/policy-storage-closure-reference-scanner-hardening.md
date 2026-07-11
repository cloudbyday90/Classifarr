# Policy Storage Closure Reference Scanner Hardening

## Status

Implemented July 11, 2026.

## Intent

The storage-closure final-removal audit must identify real product and runtime
references to an approved removal manifest without allowing temporary
implementation naming to hide those references. The scanner is an offline,
read-only maintenance tool; it is not imported by application request paths.

## Official Guidance Reviewed

- [OpenTelemetry naming guidance](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends stable, unambiguous names. Scanner exclusions therefore identify
  their product role, not a temporary delivery label.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) recommends
  traceable secure development practices. The scanner keeps the approved
  manifest, current checkout, reference evidence, and validation as separate,
  reviewable inputs.

## Options Considered

| Option | Benefits | Risks |
| --- | --- | --- |
| Keep a broad service-prefix exception | Small change | Can hide an unrelated product reference and retains temporary vocabulary. |
| Scan every matching string | Maximum sensitivity | Control-plane evidence and tests can block their own audit. |
| Explicit control-plane allowlist with manifest self-exclusion | Bounded, reviewable, and catches ordinary service references | New evidence owners must be intentionally added. |

## Final Recommendation Stack

1. Keep the approved execution-plan manifest as the removal scope.
2. Exclude a manifest file's own reference to itself.
3. Exclude tests and the one named control-plane evidence service that stores
   manifest data.
4. Scan every other configured source path, including service modules.
5. Fail the completion audit when any scanned reference remains.
6. Keep the scanner ESM-only and side-effect-free except for bounded file
   reads.

## Implementation

- Extracted the scanner into
  `scripts/lib/policyStorageClosureReferenceScanner.mjs`.
- Replaced the broad temporary service-prefix exclusion with explicit test and
  control-plane exclusions.
- Updated the final-removal generator to consume the modular scanner.
- Added focused tests proving that self references, tests, and the named
  control-plane service are ignored while runtime and ordinary service
  references are reported.
- The naming inventory now has zero production references and zero rename
  candidates, so the regression baseline is lowered to `0/0/0`.

## Security Outcome

- The scanner cannot delete files, mutate storage, invoke Git, or execute
  commands.
- A broad exclusion can no longer suppress a live service dependency.
- Explicit exceptions are visible in one module and regression-tested.
- Manifest path comparisons are normalized before scanning.

## Verification

- Focused unit tests cover scanner exclusions and completion-audit behavior.
- The production naming inventory and regression audit validate at `0/0/0`.

## Next Step

Resume the next isolated Phase 6R component using the zero-debt naming gate;
do not add delivery labels to product paths, contracts, or diagnostics.
