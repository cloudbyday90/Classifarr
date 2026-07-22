# Policy Production Naming Matcher Hardening

## Status

Implemented on July 22, 2026 as a Phase 9R durable naming-gate correction.

## Problem

The production naming gate correctly enforced a zero-debt baseline, but its
historic-token matcher had two gaps:

- it only recognized three exact letter cases of `phase` and a fixed list of
  roadmap codes; and
- it inspected file contents but not artifact paths.

That could miss a newly introduced mixed-case marker or a phase-coded service
file whose contents already used durable names. A broad match for every
`R<number>` form is not safe either: local model identifiers such as `r1` and
certification values such as `R18` are valid product data, not roadmap terms.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating traceable secure-development practices into the
  lifecycle. The gate therefore has deterministic, focused regression tests
  and continues to fail closed rather than silently changing its baseline.
- [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/)
  provides a repeatable basis for verifying technical controls. The matcher is
  treated as a control with both detection and false-positive coverage.
- [OpenTelemetry naming guidance](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends stable, unambiguous names and advises against ambiguous
  abbreviations. Product-domain identifiers must not be confused with temporary
  delivery markers.
- [W3C URI persistence guidance](https://www.w3.org/Provider/Style/URI)
  reinforces choosing identifiers that remain meaningful as implementation
  details change. The same discipline applies to paths, exports, commands,
  payloads, and diagnostics.

## Options Considered

### 1. Keep the fixed token list and content-only scan

Pros:

- Smallest matcher surface.
- No change to inventory counts.

Cons:

- Misses path-only and mixed-case delivery terminology.
- Requires a code update every time a new roadmap number is introduced.

### 2. Match every `R<number>` or `<number>R` string

Pros:

- Broad detection of numeric labels.

Cons:

- Incorrectly flags valid model names and content ratings.
- Produces noisy failures that train maintainers to distrust the gate.

### 3. Scan paths and contents with a narrow historic-marker grammar

Pros:

- Detects `phase` in any case and phase-coded artifact paths.
- Detects bounded `<number>R` roadmap markers without an enumerated ceiling.
- Preserves the historical standalone `R6` marker.
- Excludes generic `r<number>` product identifiers such as `deepseek-r1` and
  certification values such as `R18`.

Cons:

- The inventory count includes additional allowed path references in docs,
  tests, migrations, and maintenance tooling.
- A genuinely new reverse form other than historical `R6` needs an explicit
  matcher decision rather than implicit broad matching.

## Final Recommendation Stack

1. Scan both repository-relative artifact paths and text contents.
2. Normalize any case variation of `phase` to the canonical inventory token.
3. Detect bounded `<number>R` markers generically; preserve only the known
   historical standalone `R6` reverse form.
4. Keep generic `r<number>` identifiers outside the grammar unless they occur
   with the `phase` marker.
5. Keep the zero-debt regression baseline unchanged. A new detected production
   reference must be renamed or explicitly adapter-gated; it must not be added
   to the baseline for convenience.
6. When the valid inventory has no rename candidates, report the next
   product-domain component instead of incorrectly requesting a rename batch.

## Implementation Outcome

- `scripts/lib/policyProductionNamingInventory.mjs` now reports whether a
  finding came from an artifact `path` or `content` line.
- The maintenance-only matcher handles mixed-case `phase`, bounded numeric
  `<number>R` markers, and the historical `R6` form.
- Focused tests prove path-only detection, mixed-case detection, future numeric
  marker detection, and exclusion of `deepseek-r1` and `R18` values.
- `policyProductionNamingRegressionAudit` now recommends a durable rename
  batch only when valid rename candidates remain. A zero-debt gate advances to
  the next product-domain component.

## Validation

- `npm run policy:production-naming-gate`
- focused server naming tests
- full repository naming scan remains side-effect-free and reports zero
  production references, zero rename candidates, and zero obsolete tooling
  references.

## Next Step

Continue with the destination-first operator workflow in Phase 3R.2. The
naming gate remains a required CI precondition for every subsequent component.
