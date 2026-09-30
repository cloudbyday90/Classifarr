# September 29 CI dependency maintenance

## Cause and decision

[Run 36650059387](https://github.com/cloudbyday90/Classifarr/actions/runs/36650059387)
scanned revision `523c83419cc519c9bb93b43cdcebbdbe6aa01e67`. OSV completed its
scan; the vulnerability-report gate failed with nine finding occurrences: six
unique advisories affecting four package instances. This was not an application
test crash or a missing scanner result.

Update the affected transitive packages through the existing npm overrides and
regenerate lockfiles with npm. Preserve the scanner, severities and empty ignore
configuration. Do not use a forced broad dependency upgrade or suppress findings.

| Package | Previous | Patched | Workspace |
| --- | --- | --- | --- |
| brace-expansion | 5.0.9 | 5.0.12 | Server and client lockfiles |
| engine.io | 6.6.9 | 6.6.10 | Server |
| ip-address | 10.5.1 | 10.7.1 | Server |

The root brace-expansion override is aligned to 5.0.12; that package is not
currently present in the root lockfile. Engine.IO's updated dependency graph
removes its obsolete base64id dependency. No application version changes.

## Static exposure triage

The triage-finding skill was used before dependency edits or dynamic validation.
It distinguishes vulnerable package presence from demonstrated application
exploitability. These are pre-upgrade, claim-specific verdicts, not scanner
suppressions or an exhaustive security assessment. The repository's SECURITY.md
supports the latest release and private vulnerability reporting; it does not
establish a trust boundary for arbitrary developer-supplied glob patterns.

One verdict is retained per reported occurrence, including repeated advisories
in different lockfiles. Review ranks are within the unresolved queue; equal
exposure is ordered by input order.

| Finding / lockfile | Verdict | Confidence | Review rank |
| --- | --- | --- | --- |
| GHSA-6j4f-fj2g-mc7p / client | needs_review | Medium | 1 |
| GHSA-q2hr-2g5m-vwhr / client | needs_review | Medium | 2 |
| GHSA-qhr7-859c-m2p7 / client | needs_review | Medium | 3 |
| GHSA-6j4f-fj2g-mc7p / server | needs_review | Medium | 4 |
| GHSA-q2hr-2g5m-vwhr / server | needs_review | Medium | 5 |
| GHSA-qhr7-859c-m2p7 / server | needs_review | Medium | 6 |
| GHSA-2gc4-cqfq-p2gv / server | not_actionable on shipped paths | High | — |
| GHSA-h3mg-xc3c-68pw / server | not_actionable on shipped paths | High | — |
| GHSA-j6r3-76f7-8jcv / server | not_actionable on shipped paths | High | — |

Brace expansion is reachable through development tooling such as minimatch and
ESLint. The server's production install omits development dependencies; the
client ships built assets, not this tooling. No application runtime import or
less-trusted source of malicious glob patterns was established. The unresolved
fact is whether supported CI/tooling inputs can carry attacker-controlled
patterns into expansion. Updating is prudent without claiming a proven remote
application denial of service.

Engine.IO is installed through Socket.IO. The inspected production entry point
does not initialize `webSocketService.mjs`; the classification progress service
treats its socket publisher as optional. No shipped alternate initialization
path was found. The reported protocol-upgrade mismatch therefore lacks a live
application endpoint in the inspected revision. This does not make the affected
package generally safe; update it before any future runtime activation.

The shipped ip-address caller is express-rate-limit's `ipKeyGenerator`. It uses
Node's native `isIPv6` check before constructing Address6, so arbitrarily long
invalid text does not reach the diagnostic-building path. Its subnet comparison
is IPv6-to-IPv6; no shipped cross-family allowlist caller was found. These controls
defeat the specific reported paths, not every hypothetical use of the library.

Recommended action for all occurrences: use the patched compatible packages and
retain regression coverage. No application exploit was classified as confirmed.

## Official sources

Maintainer advisories and their fixed-version ranges were discovered through
the CI findings, search and official OSV records, then checked against npm's
package metadata. They describe package-level defects, not Classifarr exposure.

- [Brace comma-list recursion](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p)
  was fixed in 5.0.10.
- [Brace rewrite cost](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr)
  was fixed in 5.0.12.
- [Brace nesting recursion](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7)
  was fixed in 5.0.11.
- [Engine.IO upgrade protocol mismatch](https://github.com/socketio/socket.io/security/advisories/GHSA-2gc4-cqfq-p2gv)
  was fixed in 6.6.10.
- [IPv6 invalid-input diagnostic cost](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-h3mg-xc3c-68pw)
  and [cross-family subnet checks](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-j6r3-76f7-8jcv)
  were fixed in 10.7.1.

## Validation and outcome

After static triage, implementation returned to the authorized maintenance task.
Three targeted suites passed 35 tests: normal and hostile brace patterns in
both workspaces, Socket.IO compatibility and malformed upgrade rejection, and
IPv4/IPv6 diagnostics, subnet comparisons and rate-limiter compatibility. The
upgrade test includes an accepted EIO=4 control with a valid WebSocket key, so
rejection cannot pass merely because the handshake fixture is malformed.
Brace fixtures run in child processes with a five-second timeout, 128 MiB heap
limit and bounded captured output.

OSV Scanner 2.6.0, pinned to the same container digest used in the failed run,
rescanned all three updated lockfiles: 132 root, 727 server and 338 client package
records. Result: **No issues found, exit 0**, with no ignores added. The
containerized production install and frontend build also passed. The historical
GitHub run is unchanged; a new push must obtain its own CI result.

Scanner image: `ghcr.io/google/osv-scanner-action@sha256:71ad04ab2f8798be47870f9b18817ad317c2f8f2f97aa6726ba10d5578bc174a`.
The repository was mounted read-only and the scan explicitly selected the root,
server and client `package-lock.json` files with the existing `osv-scanner.toml`.

Benefits: removes known vulnerable versions with a small lockfile diff and no
new runtime dependencies. Costs: maintaining transitive overrides and regression
fixtures. Final recommendation: retain these patched versions, the unsuppressed
OSV gate and bounded tests; periodically retire overrides only when upstream
dependency ranges consistently select safe versions.
