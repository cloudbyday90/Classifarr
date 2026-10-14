# Ollama gateway generation integration outcome

Status: Unreleased, 2026-10-14. See the separate
[design and official research](ollama-gateway-generation-design.md).

## Implementation

The shared generation leaves accept a private transport dependency. A small ESM
factory binds preflight, version, buffered generation and streaming to one gateway,
upstream and exact model. The saved-verification factory accepts the same optional
dependency. No application setting, startup hook or singleton routing changed.

Strict streams cannot accept partial abort/stall results. Permissive owned streams
cancel transport when returning a partial result and do not emit complete progress.
External controllers must reject partial stalls. Client close, broken streams,
lost completion writes and hard deadlines reject rather than returning partial
success. Current model/digest reads replace cached gateway preflight success.
The existing gateway UUIDv7 ledger, cooldown, attempts and uncertainty survive;
there is no new database schema, automatic retry or lock-reset mechanism.

## Verification

Final focused checks passed: five suites, 139 tests. Real HTTP and isolated
PostgreSQL checks passed: one suite, 42 tests, including the actual generation
leaves and saved verification capability probe. They cover strict/permissive
cancellation and stalls, preflight and queue cancellation, exact model/digest
changes, duplicate names, credential rejection, close, hard timeout, broken stream
and lost completion. Earlier code-health regression passed (four suites, 35,116
tests; most are repository static assertions, not gateway scenarios).

Type checking, backend test/security lint, normal and production dependency
reachability, static imports, ESM mock shapes, copyright, Markdown, migration naming and schema
snapshot integrity passed. The inventory ownership gate passed without any
manifest changes or waiver of existing unresolved paths.

The initial full backend unit run passed 1,838 suites and 58,255 tests. The repeat
against final committed implementation `6bd4df35e` passed all 1,839 suites and
58,270 tests in 339.63 seconds, with one existing skipped test. No frontend source
changed. No live provider inference, shared
Ollama restart or Unraid write was performed. GitHub MCP enumeration found no open
Classifarr PRs, so no PR was selected, implemented or merged.

## Image and local runtime

The no-cache Compose build passed from clean implementation source
`6bd4df35e01a979449764a0793509f3f01690112`. The immutable image is
`sha256:b1f6c7c92eeb7f26848c5ab7d327d6d45972f88a6fb095205c1e18ecfec36d75`.
Later Markdown-only updates do not change packaged runtime code; the source label
identifies the implementation commit, not the later documentation commit.

The packaged rehearsal passed against that exact image with eight synthetic
compute calls, including the actual generation leaves and saved verification
capability probe. It also exercised authentication, two installations, queue
priority, a least-privilege database role and UUIDv7 identifiers. Graceful restart
preserved seven attempts. Abrupt death after the eighth request's observed partial
response preserved that same request UUID and eight attempts; another request was
blocked without a ninth dispatch. No fixture cooldown was artificially advanced.
This is same-image restart evidence, not a published-release upgrade or GPU test.
The runner verified no external network or published ports and used 2 CPUs,
2 GiB RAM and 512 PIDs. Cleanup of its exact owned container/data directory passed.

Before local replacement, a backup was created at
`data/backups/gateway-generation-before-20261014.dump`. Its 1,933-line archive index
was readable; SHA-256:
`B7BBCE5686F021E6C36DDB46394462E8B1425D84988B106CAC68F721A44B4F77`.
It remains local and was not restore-tested. The old image remains available as
`sha256:15d6c2c61c9f9aeb67d5b666f6ac921e11bc58c9af89e6801a847ee192749b4f`
under the verified rollback tag for the previous container.

Local Compose now runs the exact candidate image and returned HTTP 200 at
`/health`. Docker reported healthy, zero restarts and no OOM kill; its 2 GiB limit,
1,536 MiB V8 heap, read-only root, user `1000:1000` and `no-new-privileges` remain
unchanged. One post-start sample used about 527 MiB; this is not a load benchmark.
Evaluation retained `when_idle`, zero daily calls/tokens, zero reserved calls and
revision 2. The application database has no gateway schema and no gateway CLI
process is running. Unraid and shared Ollama configuration were not changed.

The no-cache build compiled the frontend. Frontend unit tests and the coverage
ratchet were not run because no frontend or HTTP API contract changed. The
implementation commit passed Gitleaks with no leaks. The recovery-change skill
guided the fail-closed completion/cancellation checks and isolated image rehearsal;
it did not authorize a production recovery or deployment.

## Remaining boundary

This is local-only transport integration, not deployment or whole-provider
coordination. Live classification orchestration still uses the direct singleton;
warming, embeddings and model administration are not silently proxied. Reasoning
requests cannot exceed the gateway's explicit five-minute cap. A successful
preflight does not atomically pin a mutable upstream model for the whole request.

Next: one coherent installation-level cutover design covering every provider path,
cross-host TLS, credential rotation/revocation and bypass prevention, followed by
an evidence-based procedure for uncertain execution. Do not activate production
while any of those paths can bypass the shared admission boundary.
