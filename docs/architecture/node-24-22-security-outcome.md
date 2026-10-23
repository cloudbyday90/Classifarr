# Node 24.22 Security Runtime Outcome

Status: local qualification passed on October 23, 2026. Initial research:
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

## Initial runtime checkpoint

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

## Final application qualification

The separately approved npm/npx 12.2.1 and server `ip-address` 10.7.4 patches
were implemented before final qualification. See the
[dependency outcome](dependency-readiness-2026-10-outcome.md) for lock review,
bounded security regressions, the two corrected CI contracts and the remaining
CLI advisory. Final implementation source:
`a11e3d95caae4d110a1275180e4a9a4f8d183820`.

Using private Node 24.22.1 and npm 12.2.1:

| Workspace | Complete coverage run | Statements | Branches | Functions | Lines |
| --- | --- | ---: | ---: | ---: | ---: |
| Server | 1,880 suites; 60,385 passed, one Windows skip | 89.18% | 86.47% | 90.75% | 89.18% |
| Client | 477 files; 7,374 passed | 87.79% | 81.84% | 87.50% | 89.47% |

The two-workspace coverage ratchet passed without changing its baseline.
The final server run followed the corrected preflight assertion; the client
tree was unchanged by those server-only contract corrections. Eight production
browser checks passed with retries disabled. Disposable PostgreSQL/TLS integration
passed 36 tests across three suites, using synthetic data and loopback fixtures.
These tests did not connect to shared Ollama or the live application database.

The no-cache ARM64 backend-builder and actual bcrypt correct/wrong-password
checks passed under QEMU, reporting Node 24.22.1, Alpine 3.24.3, npm/npx 12.2.1
and server parser 10.7.4. Its non-root, read-only, network-disabled probe and
temporary tag were removed. This is emulated binding evidence, not native ARM64
hardware or full ARM64 application acceptance. The Linux directory-fsync unit
test remains skipped on Windows; image checks do not substitute for Linux CI.

## Frozen no-cache image qualification

The existing producer completed at `2026-10-23T04:25:05.734Z`, with a clean
unchanged checkout, build cache disabled and this one local candidate image ID:

```text
sha256:a4e07ff492b41ec13d94792c61c2eb745a5fdc3b34a781186d68f00d8cb474a4
```

The exact-image, non-root/read-only/network-disabled library probe confirmed
Node 24.22.1, Alpine 3.24.3, npm/npx 12.2.1, Node OpenSSL 3.5.9, bundled Undici
7.30.1 and server parser 10.7.4. Actual bcrypt verification passed for both correct
and wrong passwords; the zone-parser probe never invoked the legacy matcher.
The image also contains npm's affected bundled parser 10.7.2; this is not an
advisory-free image or toolchain claim.

The same image passed the 30-minute synthetic workload plus two-minute settled
idle under 2 CPUs / 2 GiB / 128 PIDs: 1,600/1,600 unique items, 20/20 pressure
cohort and 8/8 provider cohort completed, with no pending or failed final backlog.
Sampled container peak was 445.19 MiB and sampled PID peak was 60. These are
sampled diagnostic observations, not production capacity, latency guarantees,
archiving on/off comparisons or long-term leak certification.

All 12 producer checks and the resource-budget evidence passed for each saved
standard, Unraid and custom profile, including fresh install, published-baseline
upgrade, interrupted restore, rejection of unverified normal startup, explicit
verified retry and scheduler/backfill crash recovery. Database evidence matched
across profiles and saved configuration remained unchanged. The Unraid profile
is a local template rehearsal, not a real Unraid-host test.

The first attempt passed its soak but blocked at the standard profile's required
baseline attestation verification, before that profile created resources. An
immediate identical read-only check passed; the earlier cause is unconfirmed.
Its failed receipt and observations were retained, followed by one full fresh
no-cache attempt. No digest, signer, source constraint, credential identity,
acceptance rule or recovery timer was relaxed, and no retry loop was added.

The final producer receipt is retained under ignored `.tmp/release-rehearsal/`;
its SHA-256 is:

```text
7e6117114c210b4ee485fb93cea65a6309a0b7537b5aebcd891d9cc37d4c114c
```

Producer cleanup passed. Independent read-only checks confirmed absence of both
attempts' owned project containers, volumes and networks and both candidate tags.
The original live container retained its exact ID and image, remained healthy,
and had zero restarts/OOM kills. No default Compose deployment or VM operation
was performed. The subsequent outcome-recording changes are Markdown only;
the image receipt qualifies the implementation revision above, not a future
release artifact or documentation commit's image label.

## Next work

Prepare the release next, before resuming unrelated troubleshooting. Agree its
version, assess the remaining npm CLI advisory and obtain exact-source CI,
Linux-only test and native published-image acceptance evidence. Local image
qualification is not publication approval; no release, version bump, branch or
PR merge was created by this work.
