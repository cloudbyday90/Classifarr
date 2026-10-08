# Knip 6.40 update design

Research date: 2026-10-08. Scope: server development tooling, not application
runtime behavior. Continue on `main`; no version bump, tag or release this round.

## Evidence and decision

The [official 6.40.0 release](https://github.com/webpro-nl/knip/releases/tag/knip%406.40.0)
includes production entry filtering, development pattern grouping, hidden package
exports, Jest name resolution and plugin-cache fixes, alongside other plugin
improvements. The
[source comparison](https://github.com/webpro-nl/knip/compare/ed30e5b7e9a53ae0158726ee7ccdecc4f9dbde07...dd6d422b129063fe8e16f176addc0744d7579987)
changes the package version without changing its dependency declarations.
Registry metadata confirms Node `^20.19.0 || >=22.12.0`, no peer requirements or
install lifecycle hook. Node 24.21.0/npm 12.2.0 remain pinned. Existing native
parser/resolver dependencies and the reviewed smol-toml override stay unchanged.

Update only Knip 6.39.0 to 6.40.0, retaining the repository's manifest range
convention and exact lock resolution. Preserve all current entry/project
patterns, ignore lists and rule severities. Do not use auto-fix or delete code
based solely on a new report. Knip is a reachability/dependency checker, not a
security scanner or proof of runtime correctness.

## Current best practices

- Keep both modes: [production analysis](https://knip.dev/features/production-mode)
  complements comprehensive analysis and should not replace it.
- Define accurate [entry/project boundaries](https://knip.dev/guides/configuring-project-files)
  before considering suppressions. Too many entries can hide unused exports.
- Verify without caching as well as through existing cached scripts. The
  [CLI guidance](https://knip.dev/reference/cli) describes metadata-based caching;
  the [known-issues guidance](https://knip.dev/reference/known-issues) warns that configuration/path changes can
  leave stale results. Do not delete shared caches just to obtain a pass.
- Exercise the installed CLI against synthetic ESM fixtures. Keep child processes
  shell-free, time/output-bounded, and limited to the existing environment
  allowlist. Config files are executable inputs: use only our local fixture
  definitions, no unreviewed downloaded configuration or live credentials.

## Recommendations and tradeoffs

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Adopt 6.40 with executable contracts | Correct entry classification without new ignores | Changed analysis needs before/after testing | First choice |
| Stay on 6.39 | Avoids tooling churn | Retains known false negatives/positives | Fallback if compatibility fails |
| Broaden ignores or disable production checks | Fewer reports | Hides real problems and weakens the gate | Reject |

1. Extend entry-boundary contracts with production/test separation and hidden
   export reachability; retain genuine missing-import and unused-export controls.
2. Reuse a small shared fixture helper rather than duplicating subprocess/cleanup
   policy or growing one test file indefinitely.
3. Review the lock diff, clean-install with strict script policy, audit all scopes,
   and verify uncached/cached analysis, lint/typecheck and backend tests.
4. Build local Compose without cache; verify the image excludes development-only
   Knip, dump/check schema in disposable databases, and observe the authorized
   local replacement. Keep Unraid and all runtime memory safeguards unchanged.
5. Per the follow-up request, move next to release preparation and blocker review
   using `.agent/workflows/release.md`, not another opportunistic update batch.
   This round does not authorize publication or choose the next release version.

## Random PR trial

Fresh enumeration returned open PRs 555 and 556. `Get-Random` selected
[PR 556](https://github.com/cloudbyday90/Classifarr/pull/556) again, head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Apply its exact two-file patch locally
and compare the existing Node-runtime gate before/after. If the Node 26 types
remain incompatible with Node 24, reverse only the trial patch and retain the
guard. Do not merge, close, or knowingly install the incompatible PR.

## Outcome boundary

Document observed tests, failures, skips, image identity and hosted CI separately.
A five-minute local observation cannot establish long-term memory retention,
published upgrade compatibility, native multi-platform acceptance or readiness
to release. No UI/API/database contract change is intended.
