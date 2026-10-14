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

The full backend run and packaged image evaluation are recorded below when done.

## Local protection

Private ignored backup: `data/backups/gateway-completion-before-20261014.dump`.
SHA-256: `1F603B2B7797E57AC97BAEE85C95224BCF50CD428D46F48D03D9CB112A8070CC`.
`pg_restore -l` read 1,933 lines; this verifies readability, not a restore.
Before replacement the local image was
`sha256:1a75706182ba3b0518b3badf1ef3df841f61dce8c3e662c6cdf00d3c7018018a`,
healthy with zero restarts and no OOM kill. Saved evaluation consent was
`when_idle`, zero daily calls/tokens/reservations, revision 2, next check
`2026-10-09 16:50:11.617278-04`. No gateway schema exists in the application DB.

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
