# Classification queue admission diagnostics design

## Decision

Project a small, identity-free diagnostic through the existing `GET
/api/queue/live-stats` response whenever classification work is queued. It
reports two independent facts:

1. whether a worker can currently take the queued classification; and
2. whether the saved primary Ollama configuration has changed since its last
   strict-verification test.

These facts must not be conflated. A changed Ollama model prevents only
strict candidate verification from calling AI; it does not itself pause task
routing, requeue work, or prove why a worker has not yet acquired a task.

## Architecture

```text
QueueService runtime state + queue blockers
             │
             ▼
QueueReadModel ──► classificationQueueAdmissionDiagnosticsService
                              │ cached, read-only saved capability state
                              ▼
               identity-free live-stats projection
                              │
                              ▼
useCommandCenterData ──► ProcessingPanel ──► QueueAdmissionDiagnostics
                                                    │
                                                    ▼
                                         explicit Settings → AI navigation
```

The service is an ESM factory, not a singleton. It keeps a short in-memory
cache of the configuration read, uses the existing capability repository, and
returns only fixed status identifiers and fixed side-effect assertions. It
never returns host, port, model, digest, error, credential, item, policy, or
library values.

## Research and principles

Reviewed on 2026-08-29:

- [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends explicit property selection and minimal response structures. The
  new response uses fixed status IDs rather than configuration values.
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends limiting resource consumption and interaction frequency. The
  diagnostic has no provider call and bounds configuration reads with a
  five-second cache.
- [Vue Security](https://vuejs.org/guide/best-practices/security) recommends
  treating non-template data as untrusted. The Vue component accepts only
  recognized status IDs and renders fixed local copy through normal text
  interpolation.
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
  recommends full-length commit-SHA action pins. The locally applied PR #518
  preserves that immutable pinning strategy while updating CodeQL action
  references to the reviewed `cdf488f…` revision.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| Client derives state from saved Settings data | No queue response change | Can be stale, duplicates server authority, and cannot explain worker eligibility. |
| Expose full provider/configuration state with queue stats | Easy to render | Leaks operational configuration and violates response minimization. |
| Trigger an AI re-test from the queue | Feels immediate | Adds hidden provider traffic and incorrectly repairs a separate concern. |
| **Server-owned, fixed-ID diagnostic plus explicit Settings action** | Accurate ownership, bounded reads, no configuration disclosure, no automatic side effects | Status is a point-in-time snapshot; the operator still performs an explicit re-test. |

## Recommended stack

1. Calculate worker eligibility from current worker state, queue blockers, and
   configured general-worker capacity.
2. Read existing saved Ollama capability only when classification work is
   pending; map it only to `model_changed` or `not_blocked`.
3. Return both independent status families in `live-stats`, with an explicit
   side-effect-free contract.
4. Render only allow-listed status IDs in a small presentational component.
5. Link model-change remediation to **Settings → AI**; retain the existing
   administrator-authorized manual test as the only provider-contact path.
6. Keep the CodeQL Action update from PR #518 pinned to the reviewed full SHA;
   do not merge the PR or create a release.

## Security properties and non-goals

- This does not invoke AI, probe a provider, test a model, requeue work,
  persist configuration, or change policy/routing decisions.
- Server authorization remains authoritative for the existing Settings test.
- An unknown server status renders no message or action in the browser.
- The queue read never carries a model identity, endpoint, digest, raw error,
  media record, or policy record.
- This does not claim that a model change is the cause of worker delay; it is a
  separately labeled strict-verification advisory.
