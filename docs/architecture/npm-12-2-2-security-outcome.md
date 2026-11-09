# npm 12.2.2 security assessment outcome

Date: November 9, 2026 Eastern. Baseline main 76599f4de. Implementation and local
qualification completed below; frozen image and delivery evidence follow in a
separate update. See the [design](npm-12-2-2-security-design.md).

## Change and scope

Exact npm/npx 12.2.2 replaces 12.2.1 in Docker, CI, all three manifest/lock roots,
executing-version tests and the provider-fault workflow validator. Active setup
and maintenance guidance agrees. Node 24.22.1, Alpine, base digest, PostgreSQL,
pgvector, every override and install-script decision remain unchanged. The host's
global toolchain was not changed. The published beta's exception remains historical.

The archive's computed SHA-512/SHA-1 matches registry metadata. That is artifact
integrity, not independent registry-signature verification. Its 188 package.json
files contain 148 name/version instances, representing 145 unique components.
Seven bundled versions change, without added manifests or lifecycle hooks.

## Real controls

The three modular Node test suites exercise the actual executing CLI's bundle,
resolved through socks and node-gyp. All ten candidate controls pass. Old-copy
counterfactuals reproduce the parser, TLS callback, excessive-encoding, signed
manifest mismatch, cached-bin selection and literal shell-execution failures.
Old ordinary bin/peer/exit controls also pass. The parser test intercepts the
dangerous matcher before executing it; it does not consume unbounded CPU.

The controls retain string/object bins, exact argv/output, exit-13 propagation,
same-cache usability, neighboring sentinel files, valid peers and direct-conflict
refusal. Public exec/view calls demonstrate metadata refresh and offline cached
bin selection. Windows cmd and real PowerShell handle literal names/arguments;
forbidden percent/exclamation names refuse before execution. Signature-enabled
pacote accepts a real ephemeral signature and refuses name/id/version substitution
after its loopback registry closes. This is an opt-in verification API, not a
claim about ordinary npm install/view. Private patch-workdir cleanup is untested.

## Installation and application evidence

- Script-disabled npm-only lock generation changes only the three root engine
  fields. The independent Vue graph is reviewed in its own outcome.
- All three strict clean installs and complete npm ls trees pass using the real
  reviewed CLI. No peer, lifecycle-script, TLS or scanner bypass is added.
- Full development-inclusive audits: root zero, client zero, server five existing
  low findings. Those entries remain visible and unchanged.
- Dependency/tooling suite: 107 passing controls, including installer admission,
  exact npm/npx and rejection of the old executing CLI.
- Fresh backend coverage: 1,933 suites; 62,791 passing tests, one existing skip.
  All 5,319 frozen backend input hashes remain unchanged through completion.
- Fresh client coverage: 485 files, 7,547 passing tests. The combined ratchet
  passes: server statements/branches/functions/lines 89.28/86.72/90.81/89.28%;
  client 87.93/82.17/87.72/89.60%.
- Root/server/client lint and type checks, ownership review, both Knip modes,
  policy, ESM import/mock-shape and copyright gates pass. Provider workflow
  validator: nine passing controls, including rejection of npm 12.2.1.
- Client production build and eight production-browser checks pass. Broader
  browser results and unchanged baseline failures are disclosed in the
  [Vue outcome](vue-pr-583-outcome.md).

## Independent bundle scanner and remaining issues

Trivy 0.76.2 scans both installed CLI distributions against the same database,
detecting all 148 package instances/145 unique components. Its release artifact's
digest matches GitHub asset metadata and the published checksum listing; no
independent Sigstore verification is claimed. npm sbom cannot produce a valid
complete bill for the published distribution because its development/workspace
dependencies are absent. No vendor manifest or synthetic lock was added to hide
that failure; the actual installed package scan supplies the inventory instead.

The old copy reports eight findings: three high and five medium. The new copy
reports two medium findings, both also present in the old copy:

| Installed npm component | Scanner finding | Remaining assessment |
| --- | --- | --- |
| glob 13.0.6 | CVE-2026-118773 | Maintainer lists the installed version as affected; fixed in 14.0.2 or newer |
| minimatch 10.2.5 | CVE-2026-118764 | Scanner flags 10.2.5; maintainer names 10.2.6 and patch 11.0.1 |

The [Glob advisory](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4)
describes work continuing after cancellation. The
[Minimatch advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)
describes pattern amplification. The latter version-range discrepancy remains
explicit; a database hit is not proof of an exploitable application path.
Workspace overrides do not repair npm's independent bundle. No vendor patch,
scanner exception or publication acceptance is introduced.

Node's separately embedded Undici 7.30.1 remains unchanged and affected by the
six newer November 5 advisories requiring 7.30.2. This batch removes the reproduced
older defects from npm's 6.x copy; it cannot fix Node's built-in fetch or an
already published/running image. No all-transport or advisory-free claim is made.

## Delivery and next recommendation

Frozen candidate image identity, controls, scan, isolated installation/recovery,
maintenance and exact-source CI results are pending at this source freeze.
No release, tag, deployment, provider call or live configuration write is made.

Recommendation stack: qualify the coordinated npm patch, assess a supported Node
24 toolchain carrying the corrected newer Undici, then assess a supported npm
artifact resolving its residual bundle findings. Return afterward to the queued
category-neutral compatibility-purpose prompt projection. Keep publication
qualification separate from these local development improvements.
