# Product-Language Audit

## Intent

Classifarr should describe current behavior in product terms that operators
understand: evidence, destination intent, readiness, learning, migration,
storage, and automation. Temporary delivery labels are useful in historical
records, but they are not a product vocabulary and must not appear in current
runtime or release-facing surfaces.

This document defines the static audit that enforces that boundary. It does not
rename persisted fields or public contracts automatically. Any compatibility
change needs its own versioned migration and deprecation plan.

## Scope

`npm run policy:product-language-audit` requires all of these current surfaces
to be present and non-empty:

- runtime UI: non-test files in `client/src`
- runtime server: non-test files in `server/src`
- operator commands: root, client, and server `package.json`
- public API documentation: `docs/api`
- product documentation: `README.md`
- current release notes: only the newest release section in `RELEASE_NOTES.md`
- Unreleased changelog: only the `## [Unreleased]` section in `CHANGELOG.md`

The audit deliberately excludes tests, architecture roadmaps, migration files,
generated output, dependency trees, data, and historical changelog or release
note sections. Those files preserve useful migration evidence and should remain
searchable without blocking a product release.

## Design

The pure audit accepts named surface files and detects only explicit temporary
delivery labels, such as `Phase 9R`, `phase8r`, or `R6`. It does not treat
domain values such as `DeepSeek-R1` or `R18+` as temporary delivery language.

The repository scanner supplies the bounded files and marks that it read them.
The audit itself reports no side effects. A blocked result contains only:

- surface identifier
- repository path
- line number
- matcher identifier
- matched temporary token

It never prints the scanned source line. This keeps the CI artifact useful for
repairing terminology while avoiding accidental disclosure of values present in
the scanned content.

The same check runs before type checking in `npm run test:ci`.

## Recommendations

### Option A: Manual Review Only

Review terminology as part of code review and release preparation.

Pros:

- No maintenance code or CI cost.
- Reviewers can apply nuanced judgment.

Cons:

- Easy to miss labels in diagnostics, package commands, and documents.
- Cannot prove that the current product is free of temporary delivery terms.

### Option B: Whole-Repository Text Ban

Reject every historical delivery label anywhere in the repository.

Pros:

- Simple rule and maximal removal pressure.

Cons:

- Destroys useful migration and test evidence or requires broad exemptions.
- Creates noisy failures unrelated to current product behavior.

### Option C: Bounded Current-Surface Audit

Audit only runtime and present-tense operator surfaces while retaining historical
records outside the gate.

Pros:

- Protects the terminology users, operators, API consumers, and support staff
  encounter.
- Preserves historic migration evidence without a hidden exemption list.
- Produces deterministic, small, source-safe CI output.

Cons:

- The surface list must be maintained when a new operator-facing entry point is
  added.
- Does not replace a compatibility plan for a persisted or public field rename.

## Final Recommendation Stack

Adopt Option C with the following controls:

1. Keep the surface list explicit, required, and fail-closed when a surface is
   missing or empty.
2. Keep matching narrow and test semantic exceptions so model names and content
   ratings are not blocked.
3. Report locations and tokens only; never report scanned source excerpts.
4. Keep historic documentation, tests, migrations, and old release records
   outside the gate.
5. Treat a public or persisted vocabulary change as a separately documented
   compatibility migration, not a mechanical text replacement.

This follows OpenTelemetry's guidance that operational names be precise,
unambiguous, and concise. It also aligns with OpenAPI's explicit deprecation
model for public API evolution and OWASP's recommendation to protect sensitive
information in logs and diagnostic output.

## Outcome

The initial run audited seven required surfaces and 1,003 files with zero
temporary delivery-language findings. The audit is side-effect-free except for
reading the bounded repository files, and it is enforced by CI.

## Sources

- [OpenTelemetry semantic convention naming guidance](https://opentelemetry.io/docs/specs/semconv/general/naming/)
- [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
