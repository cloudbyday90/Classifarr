# RE2JS tooling dependency fix design

Date: 2026-11-02 (America/New_York). Status: agreed; implemented and locally verified.
Outcome: [measured results and remaining findings](re2js-tooling-fix-outcome.md).
Predecessor: [cross-realm redirect outcome](redirect-cross-realm-fix-outcome.md).

## Evidence and scope

Root Markdownlint 0.42.0 exactly requires RE2JS 2.8.6 in its installed manifest
and lock. The latest Markdownlint registry version is still 0.42.0. The full root
audit reports two high affected package nodes, Markdownlint and RE2JS, for one
advisory propagated through the dependency chain. Both nodes are development-only.
Neither client nor server has RE2JS in its lock.

The maintainer identifies 2.8.7 as patched for GHSA-gg6h-894w-4m9c. Its required
condition is the opt-in LOOKBEHINDS flag with repeated matching. The fix carries
lookbehind state between forward searches and distinguishes main-pattern work
from lookbehind automata. The release also contains other engine/security changes;
do not assume that a patch number alone proves consumer compatibility.

The inspected Markdownlint consumer does not enable LOOKBEHINDS. Its tagged
expressions and front-matter compilation use default flags. Fixed MD011/MD013/MD039
expressions contain no lookbehind, and Classifarr's configuration enables only
MD012/MD047. The repository runner supplies files/config without custom rules or
front-matter expressions. This is installed-dependency remediation, not evidence
of an exploitable Classifarr runtime or documentation-lint path.

## Proposed change

Keep exact Markdownlint 0.42.0 and add only a root override scoped beneath
Markdownlint for exact RE2JS 2.8.7. This intentionally replaces the parent's exact
2.8.6 request; it is not a version accepted by an existing parent range. Compatibility
must be established by actual library and Markdownlint controls. Preserve every
other override, lint rule, script allowance and scanner boundary.

Generate the root lock with scripts disabled, review all deltas, then perform
the strict clean install and complete tree/audit checks. Registry metadata for
2.8.7 declares Node >=20 and no dependencies/peers or installation lifecycle
script. Keep the pinned Node 24.22.1/npm 12.2.1 toolchain. Review lock installation
flags as well as registry scripts. Do not add a production wrapper, fork, parser,
setting or operator workflow.

Extend the existing Markdownlint runner suite, already in dependency CI. Use its
native child-process pattern with fixed synthetic input, shell disabled, hidden
Windows execution, a hard timeout, heap limit and bounded captured output.

The deterministic regression observes the real library through its public
MatcherInput.utf16(charSequence) interface. Give a boxed string an own charCodeAt
that counts reads while delegating unchanged to the captured native method. No
vendor code or global prototype is modified. For fixed (?<=a)b over alternating
ASCII text, verify exact match positions/counts against ordinary-string input,
require nonzero observed reads, and enforce a generous linear read allowance
for small fixed inputs. This measures that repeated scan, not total CPU or
universal regex complexity. A bypassed observer cannot count as improvement.

An exploratory read-only probe on installed 2.8.6 returned 6,144 / 24,576 / 98,304
reads for 64 / 128 / 256 characters with correct matches. Doubling input quadrupled
observed work. Freeze a failing old-version regression before updating the package;
retain the old version assertion during that baseline. Use a source-reviewed
generous cap, rather than a tight time or benchmark-ratio gate.

Retain default-disabled lookbehind rejection, enabled positive/negative matches,
ordinary repeated matching, matcher reset/input replacement, Unicode and repeated
API correctness. Keep actual Markdownlint diagnostics/read-only behavior and the
existing math/MD011 compatibility controls. Prove scoped override/lock/installed
agreement and the consumer's resolution without requiring it to equal the original
overridden request.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Scoped exact 2.8.7 override under Markdownlint | Small maintained patch; retains current lint behavior | Intentionally supersedes an exact parent pin; needs compatibility evidence and later retirement | First choice |
| Wait for a Markdownlint dependency release | Avoids local override | Retains the affected installed dependency for an unknown interval | Defer |
| Downgrade Markdownlint as npm suggests | May remove this dependency | Discards later lint/parser behavior and earlier fixes | Reject for this batch |
| Global RE2JS override or local fork | Broad control | Wider authority or maintenance than needed | Exclude |
| Suppress the advisory or disable lint protection | Fewer findings | Retains the affected boundary or weakens checks | Reject |

Final recommendation stack: scoped upstream patch, frozen failing reproduction,
deterministic work bound with legitimate controls, reviewed lock and strict install,
actual consumer checks, then full audit and repository quality gates. Retire the
override when an assessed upstream parent release supplies the patched dependency.

## Validation and delivery

Run dependency/tooling tests, full documentation lint, npm ls --all, npm explain
and full root audit including developer dependencies. Keep the separate selected
[server-tooling PR](server-tooling-pr-578-design.md) attributable in its own document.
Its changed server installation requires fresh backend coverage. Client report
reuse is allowed only with proven source/installed-tree/report equality; this
batch obtains fresh client coverage and runs the ratchet with both runs.
Client evidence is client/coverage/index.html, as read by the existing ratchet;
the client does not configure a JSON-summary reporter. Final verification uses
the fresh client HTML report produced during this batch.

Write separate observed outcomes and Unreleased notes, inspect staged changes and
secrets, perform scoped artifact maintenance, then commit/push all changes on main.
No application version bump, release, deployment, schema, provider request, new UI,
job, operator CLI trigger, routing or learning change is included.

## Official research

Discovered through GitHub/search MCP and read on November 2, 2026:

- [Maintainer advisory](https://github.com/le0pard/re2js/security/advisories/GHSA-gg6h-894w-4m9c)
  establishes the affected condition and patched version.
- [Maintainer 2.8.7 release](https://github.com/le0pard/re2js/releases/tag/2.8.7)
  and [exact repeated-matching fix](https://github.com/le0pard/re2js/commit/dfdd947785dfa113bdc97416375c246a39458395)
  explain state reuse, reset/backward-search limits and the broader patch scope.
- [Markdownlint changelog](https://github.com/DavidAnson/markdownlint/blob/main/CHANGELOG.md)
  records 0.42.0's parser/lint protection changes; registry and installed metadata
  establish the exact current dependency, independently of cached web snippets.
- [npm overrides documentation](https://docs.npmjs.com/cli/configuring-npm/package-json/)
  supports a root-owned override scoped to a dependency's child.
- [W3C security/privacy self-review](https://www.w3.org/TR/security-privacy-questionnaire/)
  provides questions about exposure, script execution and protection downgrades.
  Applied here, the tooling change adds no web disclosure or execution surface and
  preserves protections. This Group Note is guidance, not a compliance certification
  or a reason to add unrelated UI changes.

Private metadata, audit and bounded exploration receipts remain under .tmp.
