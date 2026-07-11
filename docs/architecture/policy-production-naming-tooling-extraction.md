# Policy Production Naming Tooling Extraction

## Status

Implemented as the first scoped durable-naming cutover.

## Problem

The production naming inventory intentionally contains historic roadmap tokens
so it can find temporary delivery terminology. Keeping that scanner under
`server/src/services` made normal application source carry the very vocabulary
the cutover is intended to remove. The regression audit also accepted raw files
and could invoke the scanner from the application service layer.

## Official Guidance Reviewed

- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
  recommends clear, descriptive identifiers that remain understandable to new
  readers.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports maintaining verification practices as controlled development
  activities.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  recommends combining human review with focused automated checks at trust and
  business-logic boundaries.

## Recommendation

Move the historic-token matcher to `scripts/lib`, keep it side-effect free, and
make the server regression audit validate an already generated inventory only.
The tooling module may contain historic lookup tokens because it is a
maintenance-only scanner; application services, routes, and client code may
not import it.

## Pros And Cons

Pros:

- Removes a historic roadmap vocabulary from normal server imports.
- Makes the scan-versus-validate boundary explicit and easier to test.
- Lowers the measured production naming debt without hiding it from the
  maintenance report.

Cons:

- CI or maintainers must run the inventory generator before supplying an audit
  input outside focused tests.
- The scanner still contains historic tokens by design, but only in maintenance
  tooling.

## Final Recommendation Stack

- Maintenance scanner: `scripts/lib/policyProductionNamingInventory.mjs`
- Scan command: `scripts/generate-policy-builder-production-name-inventory.mjs`
- Server validator: `server/src/services/policyProductionNamingRegressionAudit.mjs`
- Focused tests prove the scanner classification and the validator's generated
  inventory requirement.

## Outcome

Historic roadmap-token matching is no longer part of the normal application
service tree. The server validator receives explicit generated evidence, while
the naming regression baseline is ratcheted to the lower current production
inventory.
