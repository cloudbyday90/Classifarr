# Policy comparison values outcome

Date: 2026-09-07.

## Delivered

Implemented the [comparison design](policy-comparison-values-design.md). Accuracy
increasing from 50% to 100% now displays `+50.0 percentage points`. Auto rate uses
its existing 0–100 scale. Both valid zeroes and unavailable values survive the
presentation boundary, and differences remain N/A when either period is missing.

The pure ESM utility accepts bounded finite numbers and decimal strings from the
API. Blank strings, booleans, objects, unsafe/fractional counts, out-of-range rates
and nonfinite values cannot become evidence through coercion. Changes are
calculated before display rounding; changes rounding to zero have no sign.
Overall modal accuracy and breakdown accuracy reuse the fraction formatter.

`PolicyStatsComparison.vue` owns a native table with scoped headers and caption.
A visible description explains units and N/A. The table has a focusable scrolling
wrapper for narrow screens. Signed neutral text reports change without implying
that more automatic routing or more activity is inherently better. The parent
modal retains its two existing reads and passes comparison data through props.

No endpoint, database schema, operator input, classification authority or frozen
study rule changed. Dynamic values use normal escaped Vue interpolation.

## Validation

| Check | Result |
| --- | --- |
| Focused client tests | 61 tests across 5 files passed, including mixed scales, numeric strings, zero baselines, absent periods, invalid inputs, rounding, semantic table updates and modal/API regressions. |
| Browser regression | Passed exact percentage-point values and N/A, native headers, keyboard opening/scrolling, desktop and 320-pixel comparison layout, and GET-only API activity. |
| Visual/contrast review | Desktop and narrow comparison screenshots inspected; table text, units and descriptions passed 4.5:1 contrast checks. |
| Server/client type checks and ESM gates | Passed. |
| Scoped client/server ESLint | Passed. |
| Markdown and whitespace checks | Passed. |
| Local container build/startup | `classifarr:comparison-values-local` built successfully; disposable fresh-container startup/schema verification passed without schema changes. |

The browser uses deterministic fixtures, not a newly labeled real cohort. The
whole application was not audited for WCAG conformance. This task ran focused
tests, not a full repository coverage ratchet. Existing detail breakdown content
outside the new comparison table can still need horizontal space on narrow
screens; the comparison has its own bounded scroll region.

## Recommendation and follow-up

Keep the read-only API → validated presentation utility → semantic component →
automated regression stack. Its benefit is accurate interpretation without user
configuration; its cost is maintaining the explicit API scale mapping. A future
unified API scale should be versioned rather than silently changing these fields.
The design document records official ONS, W3C and ECMAScript sources and the
alternatives matrix.

**Next: add passive lifecycle counts to the evidence breakdown.** Separate
completed history from pending/retry observations within each library/method
group. Keep imported membership distinct from evaluated feedback, reconcile
groups with retained totals, and continue loading automatically. This will show
what evidence is already usable for classification research without adding an
operator workflow or treating activity as independently reviewed correctness.

PR #529 was randomly selected from five open PRs and adapted locally. Its runtime
validation found an earlier custom TLS compatibility defect; the separate
[transport outcome](runtime-dependency-transport-outcome.md) records the fix,
dependency versions and checks. The original PR was not merged through GitHub.
README and Unreleased were updated. No release/version bump is included.
