# npm 12.2.2 security update design

Research: November 9, 2026 Eastern. Baseline main 76599f4de, clean at intake.
Status: implemented and qualified; see the separate outcome. No release/deployment.

## Recommended boundary

Conditionally move npm and its bundled npx from exact 12.2.1 to 12.2.2 across
Docker, CI, root/server/client package-manager and npm-engine declarations, lock
roots, executing-version tests, and the provider-fault workflow validator/test.
Update active maintenance/setup documentation. Preserve Node 24.22.1, Alpine,
base digest, PostgreSQL, pgvector and application behavior. Do not update the
unrelated testcontainers packages merely because they are also version 12.2.1.

Use an integrity-verified private CLI, not the host-global installation. Preserve
every override and exact install-script decision. All three .npmrc files retain
strict-allow-scripts=true. Preserve existing peer defaults; strict-peer-deps is
not currently enabled and legacy-peer-deps remains false. Add no force, peer,
script or scanner bypass. Keep the independent Vue PR assessment separate.

## Verified artifact and actual security boundary

The [official release](https://github.com/npm/cli/releases/tag/v12.2.2), retrieved
through the MCP release collection, lists ip-address 10.7.5 and Undici 6.29.1.
It was published November 4; the changelog heading is dated November 3. Both
npm versions' engines admit the existing Node executable. Both new npm/npx
entry points execute successfully in an ignored extraction.

The archive SHA-512 matches registry metadata:

```text
sha512-KglgbZyacf7jH+FHuNRqVuCzQi8VhI2a7J87Ix43FsPTuZoGWmIXXGdZtBUOA79vwL+IJREqURVzupA7PsQTcA==
```

This is byte-integrity verification against registry metadata, not independent
signature verification. Both copies contain 188 package.json files: 148
name/version package instances (145 unique components) and 40 format/metadata
markers. No package manifests are added/removed. Seven bundled versions change:

| Bundle package | Old | New |
| --- | --- | --- |
| ip-address | 10.7.2 | 10.7.5 |
| undici | 6.29.0 | 6.29.1 |
| @npmcli/promise-spawn | 10.0.0 | 10.0.1 |
| bin-links | 7.0.0 | 7.0.1 |
| libnpmexec | 11.0.4 | 11.0.5 |
| pacote | 22.0.0 | 22.0.1 |
| semver | 7.8.5 | 7.8.6 |

Changed packages add no install hooks or engine/peer changes. Read-only old/new
probes establish these distinctions, without workspace installation:

- Across eight IPv6 entry paths and four terminators, old npm's parser enters an
  intercepted dangerous matcher 32 times; new enters it zero times and refuses
  the input. The old expensive matcher is never executed. Reverse-IPv4 rejection
  also precedes splitting in the new copy. Legitimate zone/CIDR controls pass.
- Old bundled Undici drops Agent.tls.checkServerIdentity: a rejecting callback is
  never invoked and protected HTTP is reached. The new copy invokes it and
  preserves the refusal before HTTP. Ordinary TLS and connect controls pass.
- Excessive encodings terminate the old child with an unhandled stream error;
  the new copy refuses safely and remains usable. These are library boundaries,
  not proof of an exploitable Classifarr or whole-npm path.

Resolve the actual npm parser through its socks consumer and transport through
its bundled node-gyp consumer. Workspace audits/overrides do not attest those
copies. Keep the application parser 10.7.4 and Discord Undici overrides unchanged.

Node 24.22.1 separately embeds Undici 7.30.1. It fixes the older TLS/encoding
advisories but remains affected by the six newer November 5 advisories requiring
7.30.2. This npm update cannot replace Node's built-in fetch implementation.
Preserve that residual as a high-priority separate runtime assessment.

The actual installed-bundle scan finds the same medium Glob 13.0.6 and Minimatch
10.2.5 advisories in both old and new npm. Application overrides do not affect
these copies. Retain these findings without vendor modifications, new exceptions
or release acceptance. The targeted parser/transport remediation is not a claim
that the entire npm distribution is advisory-free.

## Meaningful verification

Reuse existing execution entry points and small test/fixture leaves; add no
singleton service, runtime workflow, operator CLI requirement or UI.

1. Freeze old failures and legitimate controls against the real bundled parser
   and Undici. Use bounded children, synthetic loopback HTTP/TLS, exact callback
   refusal and ordinary success. Keep tls and connect option controls distinct.
2. Execute the real CLI's existing unknown/denied/allowed installer fixtures.
   Require exact npm/npx alignment and rejection of the old executing CLI.
3. Test script-free local tarball bins, exact argv/stdout, shim removal with
   adjacent sentinels preserved, legitimate/direct-conflicting peers, exit-13
   propagation and usable same-cache recovery. Preserve current peer policy.
4. Exercise cached-bin selection through public npm exec/view commands and a
   bounded loopback registry. After metadata changes and the registry closes,
   offline execution must select the installed package's bin, not a decoy.
5. Exercise actual cmd/PowerShell literal-executable handling on Windows and a
   separate POSIX control. Do not describe npm exec --call as literal execution.
6. Test bundled pacote's documented signature-enabled manifest API with an
   ephemeral signed matching control and name/id/version mismatch refusal.
   This guard is opt-in to signature/attestation verification, not ordinary
   npm install/view. Do not invent flags or mock private cache methods.

The upstream npm patch-workdir cleanup change has no repository consumer.
Ordinary exec recovery does not certify that private command path. Do not add
filesystem monkeypatches merely to claim complete npm coverage.

Generate locks with scripts disabled and compare full structures: npm-only
changes must affect root engine metadata only. Review the separate Vue graph
independently. Then strict clean installs, complete trees and development-inclusive
audits in all three workspaces; inspect/scan the separate actual npm bundle too.
Run fresh backend/client coverage, both type/lint checks, dependency/ownership/
ESM/policy gates, client build and browser checks without weakening assertions.

Qualify a frozen source candidate through existing isolated image/install runners.
Check its actual npm/npx, bundled graph, bcrypt, TLS/encoding/parser controls and
scanner output. Keep image IDs distinct from registry digests. Preserve source,
cleanup and same-run receipt checks. Do not claim native ARM64 or an active
deployment from a local AMD64 rehearsal. Report all remaining findings unchanged;
add no scanner exception or release approval.

The published v0.49.4-beta remains historical: its accepted residual is not
retroactively fixed by source or an unpublished candidate. Clarify future-build
remediation only after evidence; preserve historical release decisions.

## Options and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Exact npm 12.2.2 with real controls | Removes reproduced bundled parser/transport defects; consistent npm/npx | CLI execution/cache/verification changes need proof | First batch |
| Keep 12.2.1 | No tooling drift | Retains demonstrated old bundled defects | Only if candidate gates fail |
| Patch npm vendor files or override its tree from the app | Superficially small diff | Does not produce a supported, reproducible CLI artifact | Reject |
| Combine Node/Alpine and all dependencies | Wider potential updates | Hides failure attribution and broadens native/runtime scope | Separate assessments |

Recommendation: qualify npm 12.2.2 first, assess the corrected Node runtime next,
then return to category-neutral compatibility-purpose prompt projection. The
random Vue PR is an independently gated client batch, not a prerequisite.

## Official guidance

Sources discovered/retrieved through MCP on November 9:

- [Parser advisory](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-rxp7-6hxx-x8q5)
  and [Undici TLS](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx)/
  [encoding advisory](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c)
  distinguish affected copies and actual failure conditions.
- [npm install policy](https://docs.npmjs.com/cli/v12/commands/npm-install/)
  documents project allowScripts/strict-mode behavior. Preserve those controls.
- [OWASP dependency management](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html)
  supports tracing the real transitive consumer and verifying fixes with feature
  controls rather than version strings alone. Publication remains out of scope.
- [W3C writing guidance](https://www.w3.org/WAI/tips/writing/) informs concise
  setup/maintenance instructions. This tooling change adds no accessibility
  surface and makes no WCAG conformance claim.
