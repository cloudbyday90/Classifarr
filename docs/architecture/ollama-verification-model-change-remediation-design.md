# Ollama verification model-change remediation design

## Decision

When the already-saved strict Ollama verification capability reports exactly
`model_changed`, show an in-context **Recommended next step** in **Settings →
AI**. The control invokes the existing administrator-authorized verification
test only after an administrator clicks it. It sends no new parameters, never
retries automatically, never routes media, and does not change policy or
routing state.

The same card may show the existing identity-free aggregate mismatch count and
last-observed time. It rejects malformed aggregate values locally and never
renders extra response properties.

## Research and principles

Reviewed on 2026-08-29:

- [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends returning only explicitly selected properties and keeping
  response structures to the business minimum. The UI consumes only the
  already allow-listed mismatch count and timestamp, not provider identity or
  error data.
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends limits on costly API interaction. A user gesture remains required
  for each bounded provider test; no client-side retry loop is introduced.
- [Vue Security](https://vuejs.org/guide/best-practices/security)
  cautions against treating data from any non-template source as trusted. The
  component uses normal text interpolation and derives its display state from
  exact status and normalized aggregate values.
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
  confirms that a failed `needs` dependency skips later jobs. The failed run
  was therefore correctly blocked by the preceding Knip error rather than by a
  release-acceptance defect.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| Automatically re-test after every detected mismatch | Minimal operator effort | Generates unbounded provider calls, hides the decision point, and can repeatedly test an unintended local model. |
| Documentation-only instruction | No implementation cost | The exact next action remains easy to miss when strict verification is blocked. |
| New remediation endpoint | Isolates an action-specific contract | Duplicates existing authorization, bounded-test, and failure-handling logic. |
| **Conditional UI control using the existing test action** | Clear decision point, no new server capability, preserves existing administrator checks, and is straightforward to test | Requires an administrator to act deliberately. |

## Recommended stack

1. Treat only the exact server-projected `model_changed` status as requiring
   this remediation; no model name, digest, host, endpoint, error, or prompt
   participates in the decision or UI.
2. Reuse the current `testAIVerificationCapability` action instead of creating
   a second endpoint or test path. The existing server-side administrator
   authorization and bounded media-free test remain authoritative.
3. Keep the action user-initiated, one-shot, and disabled while a test is in
   flight. A successful response replaces the current capability through the
   existing state path; failure remains a visible, non-routing status.
4. Reuse only the previously allow-listed aggregate count and timestamp for
   contextual evidence, with local malformed-value fallback.
5. Remove the unused summary-service singleton that caused CI Knip to fail;
   the stats route already creates its scoped service via the service factory.
6. Test exact status gating, event emission, non-disclosure, malformed values,
   and the local Knip gate before pushing.

## Security properties

- The browser cannot trigger a test automatically or supply a provider target.
- Authorization remains enforced on the existing server route, not by UI
  visibility.
- Runtime context stays aggregate-only and is not a configuration inventory or
  event log.
- The remediation does not re-enable verification speculatively: only a
  successful existing test can update the saved capability.
- Removing the unused singleton eliminates dead production code without
  altering the factory-injected route behavior.

## Non-goals

- This is not an automatic repair mechanism or a retry scheduler.
- It does not modify the saved Ollama model or connection settings.
- It does not add a provider call, database migration, API response field, or
  release.
