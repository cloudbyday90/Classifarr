# Policy Runtime Completion Engine Gate

## Status

Implemented as the prerequisite gate between policy-engine completion and
runtime/rebuild completion.

## Problem

The runtime completion audit verified its nine local runtime and rebuild
contracts, but it did not require the prerequisite policy-engine completion
audit. That allowed the runtime gate to report native-storage readiness even if
the evidence, intent, learning, readiness, operator-workflow, or migration
engine chain had failed.

Runtime automation is downstream of those contracts. A local runtime-only pass
is not a sufficient precondition for native intent storage or legacy removal.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side enforcement of legal workflow states. Runtime
  completion now requires its upstream policy-engine state explicitly.
- [OWASP Web Security Testing Guide: Testing for the Circumvention of Work Flows](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/06-Testing_for_the_Circumvention_of_Work_Flows)
  recommends testing whether server-side workflow validation prevents skipped
  steps. The focused test proves a failed engine gate blocks runtime completion.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  describes outcome-based secure development practices. Composed completion
  gates provide deterministic evidence that prerequisites are satisfied before
  later lifecycle work begins.
- [OpenTelemetry Context specification](https://opentelemetry.io/docs/specs/otel/context/)
  defines bounded propagation of execution context. The runtime audit exposes a
  minimal engine-gate summary rather than copying raw engine audit payloads.

## Recommendation

Require runtime/rebuild completion to compose the existing policy-engine
completion gate:

```text
policy-engine completion audit
             |
             v
runtime/rebuild component audits
             |
             v
runtime completion audit
             |
             v
native intent storage readiness
```

The runtime audit accepts the prerequisite only when the engine audit reports
`ok = true` and `issueCount = 0`. It returns only a sanitized summary:

```text
ok
issueCount
checkedComponentCount
```

## Pros And Cons

Pros:

- Prevents runtime completion from skipping a failed upstream engine gate.
- Reuses the existing engine audit rather than duplicating six engine contracts.
- Keeps native-storage readiness tied to the full policy architecture.
- Exposes bounded dependency status without raw evidence or audit payloads.

Cons:

- Runtime completion now depends on engine-completion audit availability.
- Engine audit changes can affect runtime completion tests, by design.
- This is a prerequisite check, not a replacement for the runtime component
  audits or full test suite.

## Final Recommendation Stack

1. Keep engine completion as the authority for evidence-to-migration contracts.
2. Keep runtime completion as the authority for runtime/rebuild contracts.
3. Require the engine gate to pass before runtime completion advances to native
   storage readiness.
4. Return only a sanitized dependency summary.
5. Fail closed when the engine result is absent, malformed, failing, or has a
   nonzero issue count.
6. Keep both gates side-effect-free.

## Security And Data Handling

- The runtime gate does not trust a route, UI, or caller-supplied readiness
  flag.
- A failing or malformed engine audit cannot be represented as a passing
  dependency.
- The summary omits raw evidence, source labels, model output, provider data,
  and detailed engine issues.
- The component performs no policy, routing, storage, queue, provider, or file
  mutation.

## Implemented Files

- Runtime completion gate:
  `server/src/services/policyRuntimeCompletionAudit.mjs`
- Engine prerequisite gate:
  `server/src/services/policyEngineCompletionAudit.mjs`
- Focused runtime completion tests:
  `server/src/__tests__/services/policyRuntimeCompletionAudit.test.mjs`

## Verification

Focused tests prove that:

- the default runtime completion audit includes a passing engine-gate summary;
- a failed engine audit blocks runtime completion; and
- runtime component checks and next-step checks remain independently enforced.

## Next Component

Begin native intent storage only after this composed completion result passes.
The first storage component should define the native intent schema and
repository boundary without expanding legacy compatibility paths.
