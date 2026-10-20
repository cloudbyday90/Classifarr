# Redirect dependency fix design

Research date: 20 October 2026. Scope: root developer tooling and client build
dependency trees. No server transport change or release.

## Cause and reachability

The OSV full-scan reporter for source `70ea16cedb6f1ed639da8df610fd0f05700dd95e`
failed on two advisories, each repeated across the root and client lockfiles.
Both trees resolve Axios 1.20.0 to follow-redirects 1.16.0. Upstream identifies
1.16.1 as the fix for custom sensitive-header regex escaping and raw-array
header filtering during redirects.
([custom-header advisory](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-8r9p-f939-6h3c),
[array-header advisory](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-q3jh-wrc6-jgq8))

This is a dependency finding, not evidence that Classifarr leaked credentials.
The server uses native fetch/Undici and has neither dependency. Root Axios
scripts do not demonstrate the advisory's custom-header or raw-array inputs.
The client uses browser transport; Axios's Node adapter also normalizes headers
and has its own sensitive-header filtering. Test the direct library boundary
without claiming that its reproduction demonstrates an Axios application leak.

## Alternatives and final recommendation

| Choice | Benefit | Cost |
| --- | --- | --- |
| Exact transitive override to 1.16.1 | Minimal compatible security patch in both trees | Must maintain and revalidate the override |
| Replace Axios or application transport | Removes this dependency path | Broad behavioral and API risk without demonstrated need |
| Suppress the scanner findings | No code churn | Leaves the vulnerable dependency and weakens the gate |

Use exact 1.16.1 overrides and reviewed lockfile regeneration under the pinned
Node/npm toolchain. Axios's existing `^1.16.0` dependency accepts this patch.
Keep install-script policy and scanner thresholds unchanged. Upstream's tagged
[1.16.1 release](https://github.com/follow-redirects/follow-redirects/releases/tag/v1.16.1)
and registry integrity metadata provide the version boundary.

Final stack: exact patch, both lockfiles, strict clean installs, installed-tree
inspection, direct dependency regression tests, Axios integration controls,
full-scope audits, CI scan and an unchanged server transport.

## Verification plan

Use only synthetic headers and loopback servers. Demonstrate vulnerable behavior
before updating; then require stripping or explicit rejection of raw-array
credentials and correct handling of custom `^`/`|` names. Preserve ordinary
headers, same-origin credentials and ordinary Axios GET behavior. Test both
independent installed copies. Wire these tests into dependency tooling CI.

The patched upstream conversion of raw arrays to objects retains only the last
value for duplicate, identically cased header names. Do not promise preservation
of arbitrary duplicate raw-array input. No existing Classifarr caller was found
using that representation; Axios normalizes headers to objects. Keep this
compatibility limitation explicit rather than adding a custom transport patch.

No external service, actual credential, Ollama request or production mutation is
needed. A separate outcome document records actual results and limitations.
