# Governed native-purpose declaration provenance outcome

Status: implemented, unreleased. See the separate
[design](policy-native-purpose-declaration-provenance-design.md) for the
architecture, research, alternatives, and recommendation stack.

## Delivered

- Added an ESM service that reduces stored purpose-rule provenance to one
  fixed, configuration-agnostic state.
- Advanced the administrator purpose-change read contract to v2 and made an
  available response require a closed aggregate provenance object.
- Updated the Vue client to reject malformed provenance and to explain when
  prefilled terms are profile-derived review evidence rather than declared
  purpose.
- Kept the existing revision-checked, idempotent native-purpose write as the
  only way to create a declaration. Its existing lifecycle receipt remains the
  only input to passive held-out re-audit.
- Corrected the native policy summary from "Declared purpose" to "Current
  stored purpose" so the interface does not imply authority that has not been
  recorded.

## Verification

Focused backend tests cover all fixed provenance states, contradictory state
rejection, the v2 read contract, and the integration transition from
profile-derived stored terms to a declared native revision. Focused frontend
tests cover the closed normalizer, profile-derived presentation, explicit
declaration feedback, and the purpose-maintenance surface. The production
client build and lint pass. The full backend unit suite also passes (1,144
suites and 32,636 tests), as do the root lint, typecheck, static ESM-import,
migration-integrity, copyright, and product-language gates. A no-cache Compose
build completed and the recreated service reported a healthy connected
database.

No policy or study data was mutated during verification. The read-only private
audit in the recreated local container remains unchanged: 6,641 candidates,
zero eligible policy-only comparisons, 10 active policies with 15 excluded
inferred profile-purpose rules, and no cohort, labels, semantic selection,
provider call, policy change, or routing activity.

## Next item

Use the existing governed declaration path only where an administrator has
confirmed the destination purpose. The passive scheduler will then observe the
new aggregate lifecycle source and re-audit automatically. If a re-audit
establishes enough eligible policy-only comparisons, the next platform step is
balanced 24–32-case cohort planning, followed by independent labels and the
existing readiness and frozen-study preflight.
