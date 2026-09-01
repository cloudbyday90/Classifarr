# Policy-Candidate Branch-Protection Readiness Design

## Decision

Do not enable required status checks on `main` yet. First restore the existing
CI dependency-declaration gate, then observe one successful real pull-request
run of the new **Policy Candidate Synthetic Replay** job. Only then should an
administrator choose and apply branch protection.

This is deliberate: required checks are a repository policy, not an application
feature. Enabling a previously absent rule changes how every contributor pushes
and merges. Configuring a check before it has a successful recent run can leave
pull requests waiting for a status that GitHub cannot yet identify.

## Preconditions

1. The deterministic replay job succeeds for an ordinary pull request targeting
   `main` and has the exact check name **Policy Candidate Synthetic Replay**.
2. The baseline CI pipeline is green, including the Knip dependency-declaration
   gate.
3. An administrator decides whether direct pushes to `main` remain permissible.
   A secure default is to require pull requests, the replay check, and an
   up-to-date branch; that is a material workflow change and must not be
   inferred from a code change.

## Rollout boundary

```text
repair existing CI gate
        |
ordinary pull request to main
        |
successful exact replay check observed
        |
administrator chooses direct-push policy
        |
branch rule requires the exact check
```

No application UI, API, AI/RAG provider, database record, or classification
decision participates in this process. The workflow already uses `pull_request`
and a read-only token, so a branch rule adds merge governance rather than new
runtime authority.

## Alternatives considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Repair CI, observe a real PR, then protect `main` | Proven check name and behavior; avoids an accidental merge block | One staged rollout step | Selected |
| Enable the replay requirement immediately | Fastest enforcement | Can leave all PRs waiting for an unseen check; changes direct-push behavior without a decision | Rejected |
| Require only the full CI workflow | Fewer visible check names | The compact deterministic replay result is hidden in a slower, broader job | Rejected |
| Run live media or AI/RAG before allowing merges | More runtime context | Exposes data and introduces nondeterministic, provider-dependent enforcement | Rejected |

## Recommendation stack

1. Keep the replay as a separate, fixed-fixture `pull_request` check.
2. Keep Actions immutable and least-privileged: full-SHA action pins,
   `contents: read`, disabled persisted credentials, and no secrets or cache.
3. Correct CI failures before adding any merge requirement.
4. After a successful ordinary PR run, require the exact job name **Policy
   Candidate Synthetic Replay** in a branch rule, alongside the team's chosen
   review and direct-push policy.

## W3C consideration

This is repository governance with no rendered web content or interactive
control in Classifarr. WCAG 2.2 implementation work is therefore not
applicable; no inaccessible product status or busy settings surface is added.

## Sources consulted

- [GitHub: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub: Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub: Status checks](https://docs.github.com/en/pull-requests/reference/status-checks)
- [GitHub: Troubleshooting rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules)
- [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)
