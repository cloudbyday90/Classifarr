# Rejected deepmerge advisory: bounded CI triage renewal

Date: 2026-11-08 Eastern / 2026-11-09 UTC. Status: agreed; the operator confirmed one renewal to November 16
UTC before the scanner-policy change. No release or deployment.

## Verified trigger and sources

The [OSV push run](https://github.com/cloudbyday90/Classifarr/actions/runs/42545540311)
failed at attempt 1 for source 2245535c9d89ae6a8ab8e5bd3461690a6da76b4e.
It reports only GHSA-gcqx-w48m-w2h4, deepmerge 4.3.1 in the server development
lock, with no patched version. The server-local exclusion expired November 9 UTC.
OSV reports medium/CVSS 5.3; GitHub's advisory and open alert 126 report low.
Neither severity is silently changed by this proposal.

Fresh primary-source checks on November 9 UTC establish:

- The [current official CVE record](https://github.com/CVEProject/cvelistV5/blob/main/cves/2026/93xxx/CVE-2026-93753.json)
  remains REJECTED by CNA VulnCheck, with the November 2 rejection unchanged.
- The [immutable rejection record](https://github.com/CVEProject/cvelistV5/blob/3c07b72fc0c95e4db36a9ada8761f28c89541eba/cves/2026/93xxx/CVE-2026-93753.json)
  preserves the source used for the earlier decision.
- The [GitHub advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
  remains unwithdrawn, with no patched version; its recorded update predates
  the CNA rejection. Downstream convergence has not completed.
- Fresh npm registry metadata still publishes deepmerge 4.3.1. The installed
  server graph reaches it through jest-config 30.5.2 as a development dependency.
  This graph fact does not establish absence from every production image.
- The [pinned OSV 2.7 configuration](https://github.com/google/osv-scanner/blob/v2.7.0/docs/configuration.md)
  uses ignoreUntil and directory-local scope. Preserve this supported format.

## Proposed exact boundary

Change only the existing server/osv-scanner.toml entry for this exact GHSA ID:

```toml
id = "GHSA-gcqx-w48m-w2h4"
ignoreUntil = 2026-11-16
```

Refresh its reason with the November 9 recheck and these design/outcome records;
retain the immutable CNA citation and explicit statement that no package
remediation is claimed. This is one seven-day data-quality triage renewal,
not a recurring waiver, a package-wide exclusion or a dismissal of alert 126.
No automatic extension is authorized.

Preserve scanner version, severities, fail-on-vuln, permissions, root/client
coverage and every other finding. Add no continue-on-error, skipped scan,
application dependency, runtime source, UI, endpoint, job or release change.
The separately accepted v0.49.4-beta npm/ip-address residual does not gain
another release's acceptance through this proposal.

## Alternatives and recommendation

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep the expired entry | No policy change | CI remains red on downstream rejected-record lag |
| Renew this exact server ID for seven days | Restores a bounded gate while retaining other findings and an expiry | Requires fresh validation and another review if databases still lag |
| Permanent exclusion or severity reduction | Avoids repeated expiry handling | Hides future drift without a review deadline; exclude |
| Replace Jest or force another dependency graph | Could remove the named package | No published deepmerge patch is available; broad unrelated tooling risk |

Recommend one bounded renewal after planning agreement. Then retain
provenance-aware policy scoring as the next substantive product refactor.

## Verification and delivery

Before publishing the policy change, verify the real pinned scanner: current
expired policy fails, the proposed exact server scope works, moving the same
finding outside server remains detectable, a separate known finding still
fails, and an expired fixture resumes failure. Reuse existing scanner helpers
and isolated fixtures; never downgrade application lockfiles for a control.
Run the relevant policy/Markdown checks and verify frozen runtime/installed-tree
hashes before reusing existing full application coverage. Commit/push the scoped
configuration and documents on main, then inspect the exact new push's OSV
run. An old failed run is not repaired by a later green run. No release or
production deployment is authorized.
