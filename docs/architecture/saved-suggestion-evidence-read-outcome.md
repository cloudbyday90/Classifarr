# Bounded saved suggestion evidence outcome

November 23, 2026 Eastern. See the
[design](saved-suggestion-evidence-read-design.md) for the alternatives and
official sources.

## Delivered behavior

`GET /api/suggestions/:id/evidence` reads one page for an authenticated
administrator. It returns up to 20 saved reference positions. When more
positions exist, pass `nextAfterPosition` back as `afterPosition`. If current
feedback is missing or belongs to a different policy or destination, the
page retains the position as unavailable. Empty support reports zero
references. An unsupported saved array reports an unavailable count and no
items.

One database statement slices the stored array before expanding it and joins
only the needed feedback fields. Title and library labels have character
limits in SQL. The compact UTF-8 response has a 48 KiB ceiling and uses
`Cache-Control: no-store`. These are expansion and response limits.
PostgreSQL may still need to read or decompress an existing array to inspect
its shape. Each page reflects the committed data visible to that statement.

The new client adapter reads one page on demand. The tuning dashboard still
uses the original member-accessible detail response. Proposal and cohort
validation still use the existing write path. The new read supplies current
feedback for an existing suggestion with no analysis invocation or saved run
result.

## Verification

The real PostgreSQL fixtures exercise bearer role and scope checks, canonical
inputs, missing suggestions, ordered continuation, cross-policy and
cross-destination refusal, null and deleted references, duplicate positions,
and the wire limit with strings that require JSON escapes. They also compare
saved suggestion state and check the existing member read. The client adapter
tests check exact request paths, continuation and input refusal.

The two focused PostgreSQL suites passed all 72 tests. The focused client
adapter and dashboard suites passed all 67 tests. The full backend run
passed 64,502 tests across 1,958 suites with one skip and 89.34% line
coverage. The full client run passed 7,661 tests across 490 files with
89.69% line coverage. Both coverage ratchets passed.

The production build and 28 Chromium checks passed. Lint, type checks,
preflight, ESM checks and the policy gates passed. The inventory check
inspects the fixed query at its call site using the existing ownership rules.
The root, server and client npm audits each reported zero findings. GitHub
listed no open pull requests for local adoption or Dependabot rebasing.

## Next recommended item

Migrate the tuning dashboard to explicit evidence pages. Settle what existing
member and external clients should receive before switching the legacy detail
contract. Give operators a clear unavailable state and announce page changes
without moving focus unexpectedly. Analysis-run retention and Linux memory
sizing remain separate decisions.
