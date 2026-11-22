# Retire the withdrawn deepmerge OSV exception

November 21, 2026 Eastern. Approved scope covers the expired server-only
OSV exception and verification of the existing scan.

## Evidence

The server's scanner configuration contains one exception, for
`GHSA-gcqx-w48m-w2h4`, which expired November 16 UTC. The CVE Numbering
Authority rejected `CVE-2026-93753` on November 2. GitHub and OSV record the
advisory as withdrawn on November 16.
[CNA record](https://github.com/CVEProject/cvelistV5/blob/3c07b72fc0c95e4db36a9ada8761f28c89541eba/cves/2026/93xxx/CVE-2026-93753.json)
· [GitHub advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
· [OSV record](https://osv.dev/vulnerability/GHSA-gcqx-w48m-w2h4)

The pinned OSV Scanner 2.7.1 scanned all three Classifarr lockfiles and
reported zero issues, an unused exception, and a deprecated expiry field.
Scanner configuration applies to the lockfiles in the same directory.
[OSV configuration](https://github.com/google/osv-scanner/blob/main/docs/configuration.md)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Retain the expired file | Keeps the old decision alongside the server lockfile | Keeps unused configuration and warnings in each scan |
| Update the expiry field | Uses the current field name | Leaves an unused entry for a withdrawn record |
| Remove the server-local file | Removes the obsolete exception and both warnings | Future exceptions need a new scoped review |

## Recommendation

1. Remove `server/osv-scanner.toml`. Keep the original triage record in the
   [renewal outcome](deepmerge-triage-renewal-outcome.md).
2. Preserve the tracked root scanner configuration, lockfiles, workflow
   permissions, failure handling, and SARIF reporting.
3. Check the pinned scanner against all three unchanged lockfiles. Require
   explicit discovery of each lockfile, exit 0 and the absence of the
   retired exception warnings. In a separate directory, require exit 1
   and the expected package, version and advisory for a synthetic server
   lockfile. The control runs without installing any package.
   [OSV source scanning](https://github.com/google/osv-scanner/blob/main/docs/scan-source.md)
4. Run the existing security-workflow contracts and check the hosted OSV
   run for the exact pushed commit. GitHub consumes SARIF for code scanning.
   [GitHub SARIF guidance](https://docs.github.com/en/code-security/concepts/code-scanning/sarif-files)

Astra's independent review confirmed that no executable consumer depends on
the deleted file. This batch changes scanner configuration without a user
interface change. W3C accessibility evaluation applies to the application's
user-facing surfaces. [W3C WAI evaluation guidance](https://www.w3.org/WAI/test-evaluate/)
