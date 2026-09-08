# Held-out semantic policy source contract outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-policy-source-contract-design.md) for the decision,
research, alternatives, and recommendation stack.

## Outcome

The private source screen is now
`policy.held_out_semantic_study_policy_source_screen.v2`. It no longer calls all
observed rules declared purpose. Instead it returns fixed counts for observed
purpose, profile-only purpose, retained purpose, and policies without observed
purpose. The counts are library- and configuration-agnostic and contain no
identities or rule values.

The private eligibility audit is now
`policy.held_out_semantic_study_eligibility_audit.v3` and returns its version on
every outcome. This lets future code recognize the corrected source terminology
without treating a source receipt as study, semantic, or routing authority.

## Live read-only result

The local Compose eligibility audit completed against the existing inventory.
It found 6,641 canonical candidates and no eligible policy-only comparison:
all ten active policies had observed purpose evidence, all were profile-only,
and none had retained purpose. Every candidate remained
`not_pending_policy_decision`; the cohort command returned
`insufficient_eligible_cases` and produced no bundle or labels.

This is a valid blocked measurement. No readiness or frozen-study preflight ran,
because both require a captured cohort with independent human labels. No policy,
library configuration, media identifier, source value, provider detail, or
semantic output was written or returned.

## Validation

Focused source-screen, eligibility-audit, and script tests pass. Server type
checking and security and test lint pass. The final validation also includes a
no-cache Compose rebuild, a read-only audit and cohort-capture execution, and
live health and error-log checks.

GitHub's public pull-request endpoint returned zero open pull requests. No
random PR could therefore be implemented locally, and no closed or merged PR
was substituted.

## Next item

Continue passive observation only. When the versioned aggregate first reports
retained purpose evidence and the private audit can capture a complete 24–32
case cohort, obtain genuine independent labels and run the existing readiness
and frozen-study preflight. Use a good measured error profile only to consider a
later ambiguous-item review signal; automatic semantic routing remains out of
scope.
