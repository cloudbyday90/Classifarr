# Candidate-bound verification recheck outcome

Status: Implemented locally for `Unreleased`
Date: 2026-08-28

## Observed behavior

The current release's review card correctly showed a policy confirmation, but
a targeted retry ended as `policy_recheck` without an AI verification status.
The code path confirmed the reason: a RAG policy recheck that selected a
`prompt_confirm` candidate was passed to `existingCandidate` and skipped the
AI rerun stage.

This was distinct from the existing strict-provider admission check. When the
configured provider cannot guarantee candidate-bound structured output, the
system correctly sends no AI request and returns the bounded
`provider_capability_unavailable` outcome. The recheck short circuit meant the
user could encounter neither a request nor that explanation.

## Implemented outcome

- Added `classificationRagLoopVerification.mjs`, an ESM-only service that
  determines when a policy-recheck confirmation must be verified and binds the
  verification context to the rechecked, server-owned destination.
- Updated the RAG AI stage to run `verify` for an adopted `prompt_confirm`
  candidate. The provider admission check remains before prompt construction
  and generation.
- Kept existing AI-call budgets and resilience gates. If either prevents a
  call, or a provider call fails, the deterministic confirmation candidate is
  retained for operator review rather than falling back to an unrelated result.
- Added regression coverage for the recheck candidate, including the bounded
  `provider_capability_unavailable` result.
- Applied open pull request #519 locally as commit `00cf012e`: Vite 8.2.2 in
  the client tooling group. The pull request was not merged and no release was
  created.

## Validation

Focused ESM server suites passed while implementing the change:

```text
3 suites passed, 147 tests passed
```

The complete local test suites also passed:

```text
Server: 855 suites passed, 24,843 tests passed
Client: 238 files passed, 3,513 tests passed
```

Server/client lint, documentation lint, and the Vite 8.2.2 production build
also passed. Repository type checks, static ESM-import checks, and ESM test
mock-shape checks passed as the final local gates.

## Operational interpretation

After this change reaches a running instance, retrying a comparable item has
three expected outcomes:

1. An eligible provider receives a strict candidate-bound verification request.
2. An ineligible provider receives no request, and the review card displays
   the safe, fixed verification-unavailable status.
3. A budget, resilience, or provider failure preserves the deterministic
   confirmation for a human; it never auto-routes the item.

No deployment or release was performed as part of this work. Pushing the
commit makes the change available for the normal build/deployment pipeline;
it does not alter the current Unraid container.

## Research and selection record

The open-PR selection used GitHub's documented list-pull-requests endpoint
with `state=open`, then selected a non-draft result at random. The documented
endpoint supports the `state` filter and a maximum page size of 100.

- [GitHub REST API: list pull requests](https://docs.github.com/en/rest/pulls/pulls?apiVersion=latest)
- [OpenAI API reference: Structured Outputs and strict JSON Schema](https://platform.openai.com/docs/api-reference/responses-streaming/response/output_item?lang=node.js)
- [OWASP API10:2023 — Unsafe Consumption of APIs](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
