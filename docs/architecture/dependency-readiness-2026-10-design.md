# October Dependency Readiness Review Design

Reviewed: October 22, 2026. The user requested checks for other updates, including
npm, alongside the approved Node 24.22.1 / Alpine 3.24.3 change. This review is
not blanket authority to upgrade application dependencies, publish or deploy.

## Recommended bounded batches

| Batch | Benefits | Costs and limitations | Recommendation |
| --- | --- | --- | --- |
| Server `ip-address` 10.7.3 to exact 10.7.4 | Fixes the newly reported IPv6 parsing advisory within the parent's supported range | Requires malformed-input, address/rate-limit and fresh audit checks | Approved; apply before release |
| npm/npx 12.2.0 to exact 12.2.1 | Current patch fixes linked-install `allowScripts` bookkeeping | Installer behavior needs real tests; bundled advisory remains | Approved; keep separate from application graph changes |
| All compatible direct updates at once | More packages become current | Runtime, bundler and lint changes lose clear attribution | Defer |
| Node 26 declarations or client TypeScript 7 | New type/compiler surface | Existing runtime/Vue compatibility contracts do not authorize these majors | Separate migration, not this batch |

The [npm 12.2.1 release](https://github.com/npm/cli/releases/tag/v12.2.1)
does not establish that the npm CLI is advisory-free. Its verified archive
contains `ip-address` 10.7.2, within the affected range of the newly reviewed
[advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5). Workspace audits
do not scan this separately installed tool. Do not patch vendor files, silently
replace bundled dependencies or suppress the advisory. Track upstream remediation
and assess the CLI's distinct input/proxy boundary separately before release claims.

## Proposed implementation and verification

For the server patch, change only its exact override and resolved package, using
the [maintainer's fixed release](https://github.com/beaugunderson/ip-address/releases/tag/v10.7.4).
`express-rate-limit` 8.7.1 requests `^10.2.0`, which admits 10.7.4. Preserve every
other override and lifecycle decision. Generate the lock with scripts disabled,
review graph/source/integrity changes, then use strict `npm ci`. Verify ordinary
IPv4, mapped IPv4 and IPv6/rate-limit behavior and bounded hostile-input rejection.
Do not send malicious input to the running service or claim a reachable exploit
from an audit entry alone.

For npm, align Docker, CI, all package-manager/engine declarations and lock roots,
installer-policy tests and active setup documentation. Install the exact npm
archive into ignored private tooling after checking registry integrity; do not
change the user's global installation or download a moving `latest` candidate.
Keep npm and npx from the same distribution. Run real unknown/denied/allowed
installer fixtures and verify no approvals or strict-mode settings changed.

For any approved additions, rerun dependency trees and development-inclusive
audits for all three roots, relevant runtime/lint/type/dependency checks and
client build/tests on the new runtime. Complete the final no-cache same-image
isolated Compose rehearsal only after agreeing the final dependency state, so
evidence describes the candidate actually intended for the next release review.

Keep design and [observations](dependency-readiness-2026-10-outcome.md) separate.
No automatic fixes, scanner bypass, PR merge, release, VM operation or live-data
mutation is authorized by this review. Release preparation comes next, before
resuming unrelated troubleshooting.
