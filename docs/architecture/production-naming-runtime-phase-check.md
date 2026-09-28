# Production naming: runtime-state false positives

Date: 2026-09-27. Status: Unreleased.

## Finding and design

The broader validation run found 98 rename candidates: 97 production references
and one script reference. Inspection showed the naming inventory was matching any
line or filename containing the substring `phase`. These were ordinary workflow
states, SQL columns, diagnostic stages and a historical migration reference, not
temporary numbered roadmap names. The separate product-language and delivery-term
checks already distinguished numbered delivery labels from runtime domain terms.

Renaming persisted state columns and public fields to satisfy a substring check
would introduce unnecessary compatibility risk. Raising the allowed-debt baseline
would conceal real regressions. Instead, reuse the existing delivery-term matcher
for numbered labels and identifiers; retain the inventory's standalone historic
code detection, including future numbered codes. Do not add file allowlists.
The shared matcher also recognizes roadmap identifiers that start directly with
the numbered label, not only identifiers with a domain prefix.

## Outcome and verification

The inventory no longer flags `phase: 'running'`, `recoveryPhase`, SQL state fields,
or ordinary prose about a two-stage operation. Numbered labels, mixed-case roadmap
identifiers and standalone historic codes remain detectable, including when they
appear on the same line as a legitimate runtime phase. Positive and negative tests
cover both sides of this distinction.

The zero-debt regression baseline is unchanged. No application state, migration,
API field or persisted record is renamed. This is a validation-tool correction
found while verifying [library discovery diagnostics](library-discovery-diagnostics-outcome.md),
not a repository-wide renaming project.
