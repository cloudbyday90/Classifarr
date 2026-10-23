# Node 24.22 Security Runtime Outcome

Status: implementation prepared; final image qualification pending. Date:
October 22, 2026. Baseline main
`05f58c4c367320456ecb0552e3af9a8de3fdae1b`. No release, version bump, live
replacement, VM operation or provider request. See the
[approved design](node-24-22-security-design.md).

## Runtime identity and implementation

The downloaded Windows x64 executable matched the checksum from the signed
Node 24.22.1 checksum document, with SHA-256:

```text
d702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5
```

GPG reported a valid signature with fingerprint
`5BE8A3F6C8A5C01D106C0AD820B1A390B168D356`, matching the official release-key
lists. The official keyring's observed SHA-256 was
`610b8d249da3d5733f5a128def2dd0294dbbf5b5713e6ca2529db8db419dee00`.
No global key trust or Node installation changed. GPG's local owner-trust remains
undefined; verification used the explicitly reviewed official releaser identity,
not a claim of personal web-of-trust certification. The first GPG invocation used
Windows paths unsupported by the installed MSYS binary and failed; relative
paths inside the private directory allowed actual signature verification.

The digest-pinned amd64 base probe reported Node 24.22.1, Alpine 3.24.3,
OpenSSL 3.5.9 and bundled Undici 7.30.1. Its non-root, read-only, network-disabled
container removed itself. The registry index contains both shipped architectures;
this is not native ARM64 acceptance. The unexpected Alpine patch was separately
approved before editing the pin or actual-version assertion.

`.nvmrc`, all manifest/lock root engines, the shared Docker base and provider fault
fixture now align. Scripts-disabled lock generation and structural comparison
show only the three root Node-engine fields changed; package versions, URLs and
integrities remain unchanged. The pure guest version guard rejects the preceding
security patch and malformed/prerelease versions, with a test tied to `.nvmrc`.
Synthetic preparation tests cannot authorize or execute VM operations. Private
recovery scripts and receipts were not changed, executed or retried.

## Completed checks

Checks used private Node 24.22.1 and npm 12.2.0:

- Strict clean installs for root, server and client: passed. All three complete
  dependency trees passed `npm ls --all` with no reported problems.
- Existing dependency/toolchain/real installer-policy tests: 58 passed.
- Preparation contracts: 15 passed, including the new security-minimum boundary
  fixture. Hyper-V observations were injected synthetic data, not native calls.
- Focused runtime, HTTP/TLS, transport, migration-tree and representative failure
  suites: 111 passed across nine suites. One Linux directory-fsync test is skipped
  on Windows; Linux coverage remains to be obtained from the candidate.
- Eight additional core-runtime contracts passed: NUL-bearing DNS input rejection
  with no upstream DNS servers, IP-like DNS SAN rejection, canonical identity
  acceptance and bounded ordinary/truncated Brotli smoke. These are compatibility
  checks, not an exploit demonstration or comprehensive security certification.
- Server test/security lint, typecheck and ordinary/production Knip: passed.
  Client lint, both Vue typecheck scopes and production Vite build: passed.
- Markdown: 2,357 files, zero errors. Copyright: 1,806 files passed. npm CLI flag,
  static-import and diff-whitespace checks passed. These counts describe this checkpoint.

The first focused TLS run failed before exercising TLS because `openssl` was not
on PATH. Setting invocation-only `OPENSSL_BIN` to the installed Git OpenSSL 3.5.7
executable allowed the ephemeral certificate fixture and full focused rerun to
pass. Node itself reports OpenSSL 3.5.9. No code, assertions or deadlines were
changed to bypass this environment prerequisite. The new DNS fixture initially
assumed an asynchronous validation rejection; it now captures synchronous
validation as well, preserving the required `ERR_INVALID_ARG_VALUE` assertion.

## Remaining qualification and next work

The requested fresh dependency check found a server moderate advisory and a newer
npm patch. Root/client audits report zero; the server reports two affected
package entries for one `ip-address` advisory. See the
[separate dependency review](dependency-readiness-2026-10-outcome.md), including
npm's independently bundled affected package. Do not claim a clean server or CLI
audit from earlier results.

The user approved the recommended npm 12.2.1 / server ip-address 10.7.4 additions
for separate implementation and checks next. The no-cache frozen Compose rehearsal
has not run for this source. Neither the earlier representative-diagnostics image
nor the old runtime outcome qualifies these changes. Full frontend tests/current
two-workspace coverage, disposable database integration and ARM64 binding checks
are not yet claimed here. This checkpoint precedes the runtime implementation
commit and final image qualification; later results must identify their tested source.

After the agreed patches and final isolated image validation, prepare the release
next, including the exact-source CI and native published-image acceptance gaps.
Resume unrelated troubleshooting afterward. No release is created by this work.
