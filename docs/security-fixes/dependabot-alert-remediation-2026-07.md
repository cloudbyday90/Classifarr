# Dependabot Alert Remediation: July 2026

## Intent

The repository has three independently installed npm workspaces: the root
tooling workspace, `client`, and `server`. Each lockfile is an executable
supply-chain boundary, so remediation must resolve and audit all three rather
than relying on whichever `node_modules` directory happens to be installed.

This change remediates the reported Dependabot alert set across those
lockfiles. A fresh resolution also exposed a newer `js-yaml` advisory that was
not in the original local baseline; it is fixed in the same change.

## Official-Source Research

Research was verified on 2026-07-25 against official sources current for the
June 2026 design window.

- [npm audit documentation](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities)
  supports auditing resolved dependencies, not only manifest declarations.
- [GitHub Advisory GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m)
  documents the original `js-yaml` denial-of-service issue; the updated root
  resolution also fixes [GHSA-pm4m-ph32-ghv5](https://github.com/advisories/GHSA-pm4m-ph32-ghv5).
- [GitHub Advisory GHSA-v245-v573-v5vm](https://github.com/advisories/GHSA-v245-v573-v5vm)
  documents the `linkify-it` quadratic-complexity issue.
- [GitHub Advisories GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp)
  and [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg)
  document the two `brace-expansion` denial-of-service issues.
- [GitHub Advisory GHSA-r635-g3xr-vw7x](https://github.com/advisories/GHSA-r635-g3xr-vw7x)
  documents Engine.IO polling transport connection exhaustion.
- [GitHub Advisory GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6)
  documents unsafe `body-parser` limit handling.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends addressing vulnerable third-party components and retaining
  verification evidence. The regenerated lockfiles and zero-vulnerability
  workspace audits provide that evidence.

## Options Considered

### Run `npm audit fix --force`

Pros:

- minimal operator effort.

Cons:

- may introduce unreviewed major-version changes;
- does not make the chosen constraint or workspace ownership clear.

Decision: rejected.

### Upgrade Direct and Transitive Dependencies Ad Hoc

Pros:

- can fix one reported package quickly.

Cons:

- leaves independent lockfiles or transitive trees vulnerable;
- risks resolving a different graph in CI than in local development.

Decision: rejected.

### Compatible, Workspace-Scoped Overrides and Fresh Lockfiles

Pros:

- keeps the existing Express, Socket.IO, Jest, and Markdown toolchain major
  versions intact;
- records every transitive security floor in its owning workspace;
- permits deterministic per-workspace audit verification.

Cons:

- requires review when an upstream package has no patched release in its
  declared major range.

Decision: selected.

## Final Recommendation Stack

1. Regenerate every affected lockfile from reviewed manifest constraints.
2. Keep `js-yaml` on the compatible 4.x fix in the server and force the root
   Markdown tooling to patched 5.2.2.
3. Override `linkify-it` to 6.1.0 because the current Markdown parser declares
   an unpatched 5.x range.
4. Set `brace-expansion` 5.0.8 in every workspace that resolves it.
5. Keep Socket.IO 4.8.x and Express 5.2.x while resolving their patched
   Engine.IO 6.6.9 and body-parser 2.3.0 transitive releases.
6. Verify with `npm audit --package-lock-only` in root, client, and server
   before merging.

## Implementation Outcome

Implemented:

- Root tooling now resolves `markdownlint-cli2` 0.23.1, `markdown-it` 14.3.0,
  `linkify-it` 6.1.0, and `js-yaml` 5.2.2.
- Client tooling now resolves `brace-expansion` 5.0.8.
- Server runtime and tooling now resolve `js-yaml` 4.3.0, `body-parser` 2.3.0,
  Engine.IO 6.6.9, and `brace-expansion` 5.0.8. The existing `minimatch`
  10.2.5 constraint remains in place.
- Fresh root, client, and server package-lock audits report zero vulnerabilities.

Not implemented:

- no broad `npm audit fix --force` upgrade;
- no unrelated dependency modernization;
- no application behavior or policy-runtime change.

## Verification

```powershell
npm audit --package-lock-only --json
npm --prefix client audit --package-lock-only --json
npm --prefix server audit --package-lock-only --json
```

Each command reports an empty `vulnerabilities` object after this change.
