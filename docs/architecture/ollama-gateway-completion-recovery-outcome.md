# Gateway completion recovery outcome

Date: 2026-10-14. Work on `main`; no release or live gateway activation.

## Change

Implemented the [design](ollama-gateway-completion-recovery-design.md) in a small
ESM execution module used by all gateway compute routes. Cancellation during the
claim can now finish a provably undispatched request without refunding its attempt.
A fully validated provider response is persisted before checking cancellation
again. Revoked or cancelled callers still receive no successful final answer.

Completion now checks provider identity as well as owner and active request.
Transport requires a complete HTTP message in addition to its existing bounded
semantic validation. No expiry-based recovery, detached generation, schema change,
new dependency, public reset endpoint, automatic retry or changed consent.

Genuinely uncertain requests remain blocked, including after restart. Failed claim
or completion writes are not retried. Existing UUIDv7 references, attempt counts,
five-second overload cooldowns, memory limits and cancellation remain intact.

## Checks before image build

- 16 focused execution tests passed, including cancellation after the transport
  promise resolves but before completion bookkeeping.
- 92 real HTTP/PostgreSQL integration tests passed across gateway, application
  routing and TLS. New cases cover undispatched revocation, failed cleanup,
  buffered/streaming/embedding/warming completion, overload and stale identities.
- Backend type checking, ESLint, normal/production dependency checks, ESM imports
  and mock shapes, migration/schema integrity, ownership review, Markdown and
  copyright checks passed. No coverage or ownership classifications were reset.
- The ownership gate first flagged the modified ledger source. Its added
  parameterized provider predicate was reviewed; only that file's digest and its
  existing group's explicit review note changed. Historical writer debt remains.
- The first focused test run used an unsupported assertion matcher; replacing it
  with Jest's call-count and argument assertions fixed the test harness.
- The initial full backend invocation omitted `OPENSSL_BIN` on Windows. TLS
  startup fixtures failed with `openssl ENOENT`; the corrected focused rerun
  passed 33 startup/execution tests. No runtime change was needed for this.
- GitHub MCP and authenticated CLI both returned zero open PRs. None could be
  randomly selected; none was merged.

The corrected full backend run passed **1,845 suites and 58,526 tests**, with one
existing skip, in 330.293 seconds. The initial invocation had 17 TLS-fixture setup
failures and 58,509 passes; all failures were the missing OpenSSL executable noted
above. Final Markdown checks covered 2,217 files with zero errors; copyright
checks covered 1,646 files. No coverage baseline was regenerated.

## Local protection

Private ignored backup: `data/backups/gateway-completion-before-20261014.dump`.
SHA-256: `1F603B2B7797E57AC97BAEE85C95224BCF50CD428D46F48D03D9CB112A8070CC`.
`pg_restore -l` read 1,933 lines; this verifies readability, not a restore.
Before replacement the local image was
`sha256:1a75706182ba3b0518b3badf1ef3df841f61dce8c3e662c6cdf00d3c7018018a`,
healthy with zero restarts and no OOM kill. Saved evaluation consent was
`when_idle`, zero daily calls/tokens/reservations, revision 2, next check
`2026-10-09 16:50:11.617278-04`. No gateway schema exists in the application DB.

The no-cache Compose build used clean commit
`127807a62a74cf583d41af0965ece37f0eec9c68`. Its immutable image is
`sha256:0fb56cf9a526ce78823e19095387310200899fc8f8d15c9a0a16030c0357f9f0`,
with a matching OCI source revision. Frontend compilation passed during the build.
The old image is retained as
`classifarr-local-rollback:8aa97f07f4bdd405c09c6025323ecd887f6bbbcf029930fdde585fcb0491ed7a`.
Gitleaks found no secrets in the implementation commit.

## Packaged evaluation

The network-none rehearsal passed with the normal image entrypoint, fresh isolated
databases, least-privilege gateway role, no published ports, two CPUs, 2 GiB memory
and 512 PIDs. The new recovery fixture imported packaged server/ledger modules and
used real HTTP with hooks to place credential revocation exactly at claim and
completion boundaries. It verified **five attempts but only four provider calls**,
no answer to a revoked caller, a real elapsed five-second cooldown (no database
clock adjustment), and unchanged uncertainty across ledger-session replacement.

The existing standalone-CLI rehearsal also passed **19 synthetic compute calls**,
including abrupt process death and restart, credential rotation, scoped application
routing, embeddings and streaming. Cleanup verified removal of
`classifarr-schema-check-181a5693-0ace-498d-853b-815ec3630ac8` and its owned data
directory. Only generated test resources were deleted, not user data or images.
These are same-image synthetic recovery tests, not a published-release upgrade
or evidence of real GPU cancellation.

The separate TLS/network rehearsal passed against the same immutable image:
one synthetic compute call through the gateway and blocked direct provider TCP
access from the application network. Cleanup verified reference
`183a967a-2ba3-40d7-87a6-28725505e666`, including both internal networks and owned
containers. The application fixture uses packaged startup with injected no-op
database admission/runtime; this does not attest the existing Unraid/LAN firewall.

Local Compose was recreated with `--no-build --no-deps --pull never`, using that
exact image. It became healthy and `/health` returned HTTP 200, with zero restarts
and no OOM kill. User `1000:1000`, read-only root and the 2 GiB limit remained.
Initial startup sample: 414.8 MiB / 2 GiB and 127.76% CPU; a later settled sample
was 324.6 MiB and 0.66% CPU. These are spot checks, not a load benchmark.
The saved consent values above were unchanged. `no-new-privileges` remained set.
No gateway environment setting or
gateway schema was introduced into the local application. The unrelated
Harmoniarr container was not replaced.

Frontend unit/coverage and the full unrelated database integration matrix were
not rerun; the frontend build and scoped HTTP/database integration were run.

## Recommendation

Keep native Node HTTPS/private CA, modular ESM, strict response validation,
PostgreSQL 18 UUIDv7 state and independent provider network isolation. Proven
completion recovery improves availability without continuing unwanted inference;
its deliberate cost is that evidence lost during a crash cannot be reconstructed.
The design document records official October 2026 research and alternatives.

Next: an operator-verified quiescence protocol and durable recovery receipts for
unknown requests, before live cutover. Loaded-model listings and timeouts are not
request completion proof. Shared Ollama and Unraid remain unchanged. The
recovery-change skill guided the explicit uncertainty contract, restricted SQL
review, real transport/database tests and isolated packaged rehearsal.
