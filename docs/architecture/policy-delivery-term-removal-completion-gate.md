# Delivery-Term Removal Completion Gate

## Outcome

Classifarr now has a required, read-only CI gate that proves current production
source does not teach internal delivery terminology. The gate also verifies that
the remaining legacy compatibility readers are intentional, attributable, and
covered by a deletion condition and test.

Run it with:

```bash
npm run policy:delivery-term-removal-gate
```

The gate is part of `npm run test:ci`.

## Scope

The repository scan reads only current production source in `client/src` and
`server/src`; test files are excluded. It detects delivery labels, compact codes,
and roadmap-shaped identifiers in source names, exports, diagnostics, telemetry,
and API-payload construction. It also rejects imports from the maintenance-only
parsers that recognize those historical tokens.

The gate does not scan release history or roadmap documents. Historical records
remain searchable and are deliberately separate from active product behavior.

## Compatibility Evidence

Every reader in `policyBuilderLegacyCompatibilityBoundary.mjs` must declare:

- one responsible owner;
- the `native_intent_storage_authoritative` removal condition;
- every required deletion gate; and
- the focused deletion-test path.

The completion scan confirms each declared reader source and deletion test
exists. The registry audit confirms its owner, removal condition, and deletion
gates. This found and removed stale declarations for already-deleted
compatibility components; four live readers remain.

The resulting report contains only repository paths, line numbers, matcher IDs,
and matched terms. It does not include source excerpts, credentials, request
data, or provider payloads.

## Current Result

The initial completion result is complete:

- 0 production delivery-term matches;
- 0 production imports of maintenance parsers;
- 4 live compatibility readers; and
- 0 compatibility-boundary issues.

## Design Options

### Manual Review Only

Pros:

- No maintenance code.
- Supports nuanced decisions during refactors.

Cons:

- Easy to miss an export, diagnostic label, or stale registry record.
- Does not prevent a later change from reintroducing delivery terminology.

### Text Scan Only

Pros:

- Fast and deterministic.
- Detects obvious terminology regressions.

Cons:

- Cannot prove that compatibility readers have a bounded removal plan.
- Cannot distinguish a maintenance parser from an application import.

### Chosen: Source Scan, Import Boundary, And Compatibility Evidence

Pros:

- Keeps historical-token matching out of runtime code.
- Makes every remaining compatibility reader attributable and removable.
- Produces source-safe evidence suitable for required CI checks.

Cons:

- New compatibility readers must be deliberately registered with their removal
  evidence.
- The matcher needs maintenance when a genuinely new historical token format is
  discovered.

## Recommendation Stack

1. Keep this gate required in CI and fail closed on new production terminology.
2. Keep token matchers in `scripts/lib` and prohibit imports from `client/src`
   and `server/src`.
3. Require a registered owner, migration condition, deletion gates, and a live
   deletion test before adding any compatibility reader.
4. Use the resulting report for review; do not log source excerpts or runtime
   data from the scan.

## Research Basis

- [GitHub Actions continuous integration guidance](https://docs.github.com/en/actions/get-started/continuous-integration)
  recommends building and testing every change with linting, security checks,
  coverage, and custom checks before integration.
- [GitHub required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
  establishes that required checks must pass before protected-branch merge.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrated verification practices to reduce vulnerabilities and
  prevent recurrence.
- [OpenTelemetry event semantic conventions](https://opentelemetry.io/docs/specs/semconv/general/events/)
  require uniquely identifiable, documented event names without dynamic values;
  durable product-domain labels keep telemetry and diagnostics understandable.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports minimizing sensitive data in logs. The gate therefore reports only
  structural metadata instead of source excerpts.
