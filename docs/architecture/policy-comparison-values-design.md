# Policy comparison values design

Date: 2026-09-07. Research cutoff: August 2026.

## Problem and verified contract

Following `e813153e`, policy detail comparisons have accurate period labels but
incorrect rate-change units. The statistics route returns accuracy as a nullable
0–1 fraction and auto rate as a nullable 0–100 percentage. The modal subtracts
both directly and appends `%`. Accuracy rising from 0.5 to 1 consequently displays
`+0.5%`; the intended absolute change is `+50.0 percentage points`. Dividing
`null` auto rate by 100 also converts unavailable evidence to a displayed zero.

`server/src/routes/statsRoutePolicies.mjs` is the contract source. PostgreSQL
numeric results can arrive as decimal strings; counts can be numbers or strings.
The comparison covers rolling last-seven-day and previous-seven-day periods.
The API and canonical evaluation rules do not need to change for this fix.

## Design

Create a pure ESM `policyStatsComparison.js` presentation utility with named
exports and explicit input scales. Accept finite numbers and nonempty decimal
strings. Reject booleans, objects, blanks, nonfinite numbers, out-of-range rates
and counts that are negative, fractional or outside the safe integer range.
Validation precedes arithmetic, so coercion cannot create evidence.

| Metric | Valid input | Period display | Change |
| --- | --- | --- | --- |
| Decisions | Nonnegative safe integer | Count | Signed count difference |
| Accuracy | Fraction from 0 to 1 | Percentage with one decimal | Signed percentage-point difference |
| Auto rate | Percentage from 0 to 100 | Percentage with one decimal | Signed percentage-point difference |
| Unavailable or invalid | Missing/invalid operand or period | N/A | N/A when either operand is unavailable |

Normalize each operand before subtracting. Round only at the display boundary.
Suppress positive/negative signs when a change rounds to zero. Use full unit
names, including singular `percentage point` for a displayed magnitude of one.
An increase in activity or auto rate is descriptive, not automatically good;
show signed changes in neutral text rather than success/error colors.

Extract `PolicyStatsComparison.vue` from the modal. Use a native table with a
caption, column and row headers, and a keyboard-scrollable wrapper on narrow
screens. Include a visible explanation of change units and N/A. The modal keeps
request ownership and passes the response through props. Reuse the validated
fraction formatter for its overall and breakdown accuracy displays.

## Official research

URLs were discovered through web search/GitHub MCP and read on 2026-09-07.
W3C table guidance is dated July 2019; ECMAScript 2026 is dated June 2026. The
ONS page is live guidance without an archived August snapshot claim. These are
established rules applicable by the requested cutoff.

- [ONS percentages and percentage points](https://service-manual.ons.gov.uk/content/numbers/percentages)
  distinguishes subtraction of percentages from relative percentage change.
  Apply percentage points to rate differences and keep count changes unitless.
- [W3C tables with two headers](https://www.w3.org/WAI/tutorials/tables/two-headers/)
  recommends table captions and explicit row/column header scope. Apply these
  relationships to the comparison rather than relying on visual grid positions.
- [ECMA-262 publication](https://ecma-international.org/publications-and-standards/standards/ecma-262/?source=:ow:lp:cpo::::RC_CORP231202P00004:DMO400323615)
  identifies the June 2026 specification. The established
  [TC39 numeric conversion rules](https://tc39.es/ecma262/2023/multipage/abstract-operations.html)
  turn null into zero. Apply finite-number checks and explicit input validation
  before scaling. The single-page 2026 HTML exceeded the web tool's size limit;
  the earlier published algorithm and local Node 24 behavior confirm this rule.

## Alternatives and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Explicit client presentation utility and table component | Small, testable, preserves existing clients, accessible tabular relationships | Must retain awareness of two API scales | Implement |
| Normalize all API rates now | Consistent future wire format | Requires coordinated client migration and affects consumers beyond this bug | Defer to a versioned contract change |
| Inline conditional fixes in the modal | Few initial edits | Leaves mixed-scale arithmetic and repeated validation in a large component | Reject |

Recommended stack: existing read-only statistics API → validated ESM presentation
utility → small semantic Vue table → boundary tests and keyboard/mobile browser
checks. No new setting, operator input, provider request or routing authority.
Use normal Vue interpolation; do not execute or render raw input as HTML.

## Random open PR trial

GitHub MCP listed open PRs 526–530. One uniform random selection chose
[PR #529](https://github.com/cloudbyday90/Classifarr/pull/529), head
`1ebd60db884e9646166e90ff791af785552b2125`. Apply only its two manifest/lockfile
changes locally, preserving the exact lockfile and existing nested overrides.
Do not invoke a GitHub PR merge.

| Dependency | Update | Official review |
| --- | --- | --- |
| express-rate-limit | 8.6.2 → 8.7.0 | [Changelog](https://express-rate-limit.mintlify.app/reference/changelog): adds an optional Retry-After override; existing configuration stays unchanged. |
| undici | 8.10.0 → 8.10.1 | [Release](https://github.com/nodejs/undici/releases/tag/v8.10.1): includes abort/retry and response-size handling fixes. Exercise the actual package against a local server. |
| zod | 4.4.3 → 4.5.4 | [Release](https://github.com/colinhacks/zod/releases/tag/v4.5.4): fixes default-factory execution during cycle walking. Exercise existing schema/parser consumers. |

These releases were published 29–31 August 2026. The advantage is adopting
upstream fixes with reproducible versions; the cost is regression risk in
runtime dependencies. Accept the local adaptation only after targeted server
tests, direct dependency smoke tests and a fresh local container build/startup.
Record the result independently of the original PR's merge state.

The trial found an existing npm/bundled Undici dispatcher incompatibility. The
separate [transport design](runtime-dependency-transport-design.md) describes the
required compatibility fix before accepting the dependency adaptation.
