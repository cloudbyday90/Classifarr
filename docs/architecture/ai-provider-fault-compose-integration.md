# Disposable AI Provider-Fault Compose Integration

## Outcome

Classifarr now has a narrowly scoped, locally runnable integration test for a
transient local-AI provider outage. The test starts a disposable Docker Compose
stub, validates the real queue's availability check and provider HTTP call,
persists the resulting `queued_for_retry` outcome, and proves that the routing
decision is blocked.

Run it with:

```powershell
npm run test:integration:ai-provider-fault-compose
```

The command does not accept arguments. It only targets the checked-in
`docker-compose.ai-provider-fault-integration.yml`, creates a randomized
project name, and removes that project (including its volumes) whether the test
passes or fails.

## Scope and Design

```text
fixed, loopback-only Compose provider stub
                 |
                 | GET /api/tags => 200
                 | POST /api/generate => 503
                 v
actual Ollama service + AI router HTTP boundary
                 |
                 v
policy classification path -> queued_for_retry result
                 |
                 v
actual QueueService dequeue / completion persistence
                 |
                 v
actual route-decision guard -> no route attempted
```

The integration database is created by the existing Testcontainers setup. The
test writes its provider configuration and queue task only to that isolated
database, which is dropped during Jest teardown. The Compose fixture runs only
the provider stub; it does not start Classifarr, mount local media, mount
`./data`, read `.env`, receive credentials, or join the normal Compose network.

The fixed stub returns a successful `/api/tags` response so that the queue
worker performs its normal availability admission. It returns HTTP 503 only for
the subsequent `/api/generate` request. This distinguishes a generation outage
from a provider that is simply unreachable. The stub exposes a test-only metric
endpoint that returns only two capped counters: availability requests and
generation requests. It never parses, stores, or logs a prompt, header, token,
provider output, or error body.

The test deliberately supplies fixture metadata and policy scoring dependencies
to the classification path. Full production metadata acquisition is not part of
this failure experiment because it would introduce media-server and external
metadata targets. The provider transport, queue dequeue, task completion
persistence, retry projection, and route-decision code remain production code.

## Security Boundary and Stop Conditions

- The runner refuses any Compose file other than the fixed test fixture.
- The Compose project name is generated from a process ID and cryptographic
  random suffix; it cannot overlap the normal `classifarr` project.
- `docker compose config --quiet` runs before startup. The runner asks the host
  OS for a currently free loopback port and supplies that exact value only to
  the fixed Compose file; Jest receives only `127.0.0.1:<port>`. A port
  allocation or bounded Compose startup failure fails closed before the test
  can contact any provider.
- The stub container runs as UID/GID 1000 with a read-only filesystem,
  `no-new-privileges`, all Linux capabilities dropped, a `noexec` tmpfs, no
  mounts, no secrets, no restart policy, and its own project-scoped bridge
  network. Docker Desktop requires that network to publish the loopback-only
  test port to the host; the fixture never joins the normal Compose network,
  and the stub has no outbound request path.
- Startup has a 60-second bound. The runner always invokes
  `docker compose down --volumes --remove-orphans` on its unique project after
  startup has begun, even if the targeted Jest test fails.
- The persistence assertion requires `library: null`, `needs_retry: true`,
  `method: queued_for_retry`, `provider_recovery.mode: retry_queued`, and a
  `routingOutcome` whose `shouldRoute` is false. The mocked media route function
  must not be called.

The test therefore validates safe recovery behavior, not successful
classification quality or real media-server routing.

## Research and Recommendation

Current official guidance supports bounded, isolated fault injection:

- [AWS Fault Injection Service stop conditions](https://docs.aws.amazon.com/fis/latest/userguide/stop-conditions.html)
  recommends automatic stopping based on defined steady-state thresholds.
- [AWS Well-Architected Reliability Pillar: failure injection](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_failure_injection_resiliency.html)
  recommends beginning in non-production, minimizing scope, instrumenting the
  experiment, and defining guardrails.
- [Docker Compose: merge multiple files](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)
  explains why an independent Compose file avoids inheriting normal-stack
  volumes and service configuration.
- [Docker Compose profiles reference](https://docs.docker.com/reference/compose-file/profiles/)
  documents profile service activation. A separate file is selected here over a
  profile because the normal stack already carries user data and host mounts.
- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  recommends task-specific evals, automated scoring, and representative edge
  and adversarial cases. This test adds a specific operational fault case; it
  complements rather than replaces the deterministic evaluation harness.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends excluding sensitive data and using strict, bounded logging. The
  stub follows that rule by exposing only named counter values.

### Options Considered

#### Fault the normal local Compose installation

Pros:

- closest to a full production-like stack.

Cons:

- can touch local data, media mounts, existing queues, settings, or providers;
- makes cleanup and target verification materially harder.

Decision: rejected.

#### Add a mutable failure flag to the normal local sweep

Pros:

- fewer commands and files.

Cons:

- puts a destructive-looking fault mode beside a live operator workflow;
- risks making no-route and fallback guardrails optional.

Decision: rejected.

#### Selected: fixed disposable Compose fixture plus isolated integration DB

Pros:

- proves the real HTTP provider boundary, queue persistence, retry projection,
  and route guard;
- has a fixed loopback-only target, explicit timeout, test-only counters, and
  unconditional cleanup;
- cannot inherit normal Compose data or media mounts.

Cons:

- does not cover full ingress, production persistence, real media-server
  routing, or an actual model;
- requires Docker and the integration-test PostgreSQL image locally.

Decision: selected. It is the smallest safe next layer after the deterministic
fault-scenario harness.

## Final Recommendation Stack

1. Keep the deterministic offline fault-scenario harness as the fast,
   no-side-effect contract check.
2. Run this Compose provider-fault integration before a release that changes AI
   provider recovery, queue dispatch, retry persistence, or route admission.
3. Run the reviewed local policy-to-AI sweep separately for model quality; it
   remains the only layer that exercises intentional local-model behavior.
4. Before a broader release, run the normal Docker smoke suite and full server
   tests. Do not substitute this narrowly scoped fault test for either.
5. Require the clean-host release-candidate receipt gate for every version tag;
   it confirms this exact boundary without uploading local-model or provider
   content.

## Next Recommended Item

The clean-host receipt gate is now implemented; see
[Clean-Host AI Provider-Fault Release-Candidate Receipt](ai-provider-fault-release-candidate-receipt.md).

Next, bind a validated SHA-256 fingerprint of that receipt into the release
candidate evidence schema. Preserve only the fixed receipt contract or its
fingerprint, never raw provider, fixture, or test data.
