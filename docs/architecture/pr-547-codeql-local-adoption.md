# PR 547: local CodeQL action adoption

## Selection and design

On 2026-09-28, GitHub MCP returned five open Classifarr PRs: 551, 550, 549, 548,
547. A single random index selected [PR 547](https://github.com/cloudbyday90/Classifarr/pull/547),
the GitHub Actions dependency group. Its head was
`ba5d9036952bbb8c3c6e04988ff9d6af8a9d55d1` against base `494019c4`.
The MCP-provided patch was inspected and applied locally, not merged.

The change updates CodeQL init/analyze and the two Trivy SARIF uploads from
v4.38.1 to v4.38.2. All four references retain full commit pins:
`2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2`.
The official upstream tag was verified with `git ls-remote`; its annotated tag
peels to that commit. Permissions, triggers, scan paths and release behavior
remain unchanged.

## Recommendation and trade-offs

- Recommend the verified full SHA: reproducible action selection and the upstream
  bug fixes, consistent with [GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).
- Keep automated dependency proposals: pins require deliberate maintenance.
- Do not use a floating major tag: simpler updates, but the executed action can
  change without a reviewed repository diff.

## Outcome and limits

The local security-workflow regression checks validate all four pins and the
existing least-privilege/release invariants. Local checks do not execute GitHub's
hosted CodeQL service or prove that a SARIF upload will succeed on GitHub. No PR
was merged and no release was created.

Official source: [upstream v4.38.2 commit](https://github.com/github/codeql-action/commit/2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2).
