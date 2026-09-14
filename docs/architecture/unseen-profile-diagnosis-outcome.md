# Unseen profile-comparison diagnosis outcome

Date: 2026-09-13. No release or routing-policy change.

## Implemented

The small ESM candidate-comparison module is independent of library names, genres
and content labels. The surrounding adapters still support movie/TV identities;
this does not add support for another media format.

The observer's v2 protocol separates unfinished profiles, insufficient supported
examples, inconsistent fitted views, nonpositive matches and positive ties.
All retained centroids are validated before diagnosing the comparison. The
selected view reuses bounded scalar scores instead of renormalizing its vectors.

Library learning shows unseen comparison coverage separately from known items,
duplicates, invalid inputs and changed evidence. Invalidated batches are not
counted as items. Only nonzero reasons appear inside the existing collapsed
details. No new endpoint, setting, acknowledgement or AI call was added. Existing
SWR refresh, pause, failure clearing and admin-only projection remain in place.

The user's follow-up also resulted in the
[validation and recovery service](representative-validation-recovery-outcome.md).

## Verification and limitations

Final full backend regression: 1,289 suites / 37,324 tests passed in 437.16
seconds. Coverage: 90.14% statements/lines, 82.53% branches and 92.21% functions.
The combined backend/client coverage ratchet passed without lowering thresholds.

Frontend: 368 suites / 5,114 tests passed. Coverage: 85.61% statements, 77.54%
branches, 85.08% functions and 87.66% lines. Real PostgreSQL integration passed
one suite / three tests. Focused backend and code-health checks passed 14 suites /
25,144 tests, including geometry, cause separation, API redaction and recovery.
Dependency/copyright preflight, backend/client type checks, backend test/security
lint, client lint, Markdown lint and ESM import/mock-shape checks passed.

Browser verification used the authenticated local Compose Command Center. The
default card remained compact; expanding details displayed the new denominator
explanation. Pause worked, Space resumed the focused control, and the live clock
continued updating. The disclosure was collapsed again afterward. Browser
inspection and component tests informed the accessibility verification; this is
not a claim of full WCAG conformance.

The local summary had zero natural unseen observations during inspection.
Synthetic cases test every diagnostic category; real cached movie/TV controls
test exclusion and recovery, not placement accuracy. No accuracy improvement,
ground-truth labels or new automatic-routing authority is claimed.

## Recommendations

Use the stack in the [design](unseen-profile-diagnosis-design.md): content-neutral
geometry, source-validated bounded observation, fixed aggregate projection, and
the existing quiet SWR view. Benefit: actionable causes without another form or
inference cost. Tradeoff: comparison disagreement remains a diagnostic, not proof
that either destination is correct.

The next matching component remains bounded independent outcome attribution for
genuinely unseen items, so metadata/profile fusion can be evaluated against
verified outcomes rather than its own predictions. This is separate from the
next ingestion-recovery recommendation in the validation-service outcome.

## PR and delivery

Both GitHub MCP selection checks returned zero open Classifarr PRs. No random PR
was available to implement locally; no closed or unrelated PR was substituted,
and nothing was merged. The previous commit's six workflows were all successful.
Changes are recorded under Unreleased; package versions and release tags are unchanged.
