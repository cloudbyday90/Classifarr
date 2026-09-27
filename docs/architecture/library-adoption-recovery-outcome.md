# Library adoption and recovery outcome

## Scope

Implements the [adoption and recovery design](library-adoption-recovery-design.md)
without library-specific code, routing changes, music ingestion or a release.
Discovery/removal changes remain the next bounded work item.

## Local incident

The reported library had a pre-ownership `running` sync from July 25, no ownership
ledger and no current advisory owner. A newer complete source capture did not
prove that the older marker's writer could never resume.

Read-only inspection found one Classifarr container, no stopped Classifarr
containers, no other containers on its internal network and no published
PostgreSQL port. Observed database application sessions were local and idle.
Host process inspection found no matching external import script. These findings
describe this deployment, not all possible remote or future writers.

Recovery used the existing administrator workflow with the library temporarily
disabled. A scoped diagnostic token correctly could not access reconciliation;
the operation was instead completed through the authenticated administrator UI
using the computer-use skill. No authentication restriction was bypassed and no
direct SQL status rewrite was used. Audit receipt **2233** records reconciliation.
The original enabled setting was restored through the UI.

Read-back after normal scheduled replay confirmed:

- Ingestion phase `complete`, 966 processed and retained inventory items.
- No unfinished sync markers and no retry deadline.
- Library enabled; no inventory wipe, media deletion or routing change.

Only the reported library was reconciled live. Other unknown-owner records still
require their own verified review. The generalized code will adopt safe unowned
libraries after deployment; it does not silently clear unknown markers. The local
running image was not rebuilt or replaced as part of this patch.

A subsequent read-only all-library check found eight completed owned imports and
two remaining unknown-owner libraries. Their records were not rewritten. The app
page independently showed 966 synced items, the enabled setting and no blocked
import panel for the reported library.

## Validation

- Targeted PostgreSQL integration: 80 tests passed across recovery, legacy
  reconciliation, inventory progress and library API suites. This includes the
  three-source/two-content-type matrix and complete replay following an outage.
- Frontend coverage: 398 suites / 5,590 tests passed.
- Clean full backend unit rerun: 1,499 suites / 44,876 tests passed.
- Full PostgreSQL integration run: 182 suites / 2,081 tests passed; one existing
  suite/test was skipped by the repository configuration.
- Targeted backend ownership/readiness/scheduler tests: 159 passed.
- Server and client type checks, client production build, client lint, server
  lint, production/full dependency checks and static ESM checks passed. Server
  lint retains one pre-existing filename warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new lint errors.
- Ownership review now pins the read-side policy modules in addition to the
  session writer. The first full backend coverage run correctly rejected changed
  hashes (44,875 passed, one review-manifest failure). Explicit review and the
  updated manifest resolved that gate; the targeted gate rerun passed.
- Current backend/frontend coverage reports pass the existing coverage ratchet.

The initial manifest failure was resolved before the clean full-unit rerun.
No coverage baseline was weakened. All changed JavaScript remains ESM, and no
version bump, release, PR merge or container deployment was performed.

## Pull request availability

GitHub MCP open-PR searches returned no open pull requests for
`cloudbyday90/Classifarr`. No eligible random PR was available to implement.
No closed or unrelated PR was substituted and no PR was merged.
