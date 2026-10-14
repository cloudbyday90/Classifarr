# Ollama gateway streaming: implementation outcome

Status: Unreleased, local-only, 2026-10-14. See the separate
[design and research](ollama-gateway-streaming-design.md) and
[operator guide](../operations/ollama-gateway.md).

## Implemented

Small ESM modules now provide an authenticated, provider-bound client and a
bounded NDJSON parser/relay. Partial records stream with backpressure. The final
record is withheld until upstream EOF and successful durable completion. A broken
stream never fabricates success or clears the outstanding UUIDv7 request.

The description and embedding study factories accept explicit private gateway
dependencies. Their direct behavior, installed-model/digest checks and attempt
hook remain intact. No settings migration, database table, environment activation,
production routing, automatic retry or reset endpoint was added. Existing UUIDv7,
cooldown, consent and memory safeguards remain unchanged.

## Verification

Focused unit and real HTTP/PostgreSQL tests cover split UTF-8, record boundaries,
backpressure, response/line/count limits, malformed and trailing records, clean
completion ordering, stalled callbacks, cancellation, restart, lost completion,
credential rejection, target mismatch, redirect refusal and actual study adapters.
Focused unit/code-health checks passed: five suites, 35,174 tests (the majority
are repository code-health assertions, not gateway scenarios). Gateway/workload
PostgreSQL integration passed: two suites, 38 tests. Existing Ollama/study-client
regressions passed: three suites, 142 tests. Type checking, backend lint, normal
and production dependency reachability, static imports, copyright, Markdown,
migration naming and snapshot integrity checks passed. The inventory ownership
gate passed without changing its review manifest or waiving existing debt.

The full backend unit run (1,838 suites) reported 58,244 passing tests, one skipped
test and one failure. It exposed an omitted standalone variable in the existing
environment-coverage test. Its explicit deferred list now includes
`CLASSIFARR_GATEWAY_CONFIG_FILE` and verifies that application configuration
continues to reject it. No application environment allowlist was expanded.
The corrected configuration suite and both gateway unit suites passed together
on rerun: three suites, 131 tests. The entire six-minute unit run was not repeated
after this test-only correction. No frontend tests or coverage ratchet were run;
no frontend code changed, and the no-cache image build compiled the frontend.

A legacy live-schema helper ignored `--help` and regenerated the
tracked schema snapshot; that generated file was restored byte-for-byte to its
unchanged Git version. No database schema change or snapshot update is included.

GitHub MCP enumeration returned no open Classifarr pull requests, so no PR was
selected, implemented or merged. All provider activity in these tests is synthetic.

## Image and local runtime

The no-cache image build passed from clean implementation source
`bb08874ec2c18c4a34db6a977cc4290712349a73`. Its immutable ID is
`sha256:15d6c2c61c9f9aeb67d5b666f6ac921e11bc58c9af89e6801a847ee192749b4f`.
The later outcome and test-only corrections are excluded by `.dockerignore` and
do not change packaged application code; the image source label remains the
implementation revision above, not the later commit.

The network-isolated packaged CLI/client rehearsal passed with six synthetic
compute calls. It verified streaming completion, authentication, two installations,
foreground precedence, UUIDv7, a least-privilege database role, graceful restart
and abrupt death during an observed partial stream. Restart retained the same
request and six attempts, and another request caused no seventh dispatch. Cleanup
of its exact owned container and data directory was verified. This is same-image
restart evidence, not published-release upgrade or shared-GPU evidence.

Before local replacement, `data/backups/gateway-stream-before-20261014.dump` was
created and its 1,933-line archive index read successfully. SHA-256:
`F83A29748221AC30035B696AE22B1D7C8339FF81FC7762CE545BAA29BFF9F0E8`.
It remains local and was not restore-tested. The previous image is preserved under
a rollback tag: `sha256:d196409b60f16b95135a675de268003fc998a1bd260a894050bfbf5521ddbc58`.

Local Compose runs the exact candidate ID above and returned HTTP 200 at `/health`.
Docker reported healthy, zero restarts and no OOM kill. The 2 GiB container limit,
1,536 MiB V8 heap ceiling, read-only root, user `1000:1000` and
`no-new-privileges` remain unchanged. Evaluation retained `when_idle`, zero daily
calls/tokens, zero reserved calls and revision 2. The application database has no
gateway schema and no gateway CLI process is running. No live inference was
requested for validation. The implementation commit passed Gitleaks with no leaks.

## Limits and next recommendation

This is not production shared-provider coordination. The main classification,
verification, warming and model-administration call sites remain direct. The new
client is loopback-only; there is no cross-host credential deployment or live
recovery action. No Unraid/shared Ollama setting or service was changed.

Next: integrate the primary generation and verification paths through the common
transport, explicitly testing existing strict versus partial-result policies and
configuration invalidation. Then establish authenticated cross-host deployment,
credential revocation, bypass prevention and verified uncertainty recovery before
enabling either installation. Do not treat this prototype as a drop-in proxy.
