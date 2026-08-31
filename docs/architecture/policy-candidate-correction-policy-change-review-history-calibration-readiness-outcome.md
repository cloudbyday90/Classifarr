# Policy-Change Review-History Calibration Readiness Outcome

## Status

Implemented and validated on the unreleased branch on 2026-08-31. This change
does not create a release, tag, or version bump.

## Intended Outcome

- Preserve exactly the current aggregate bucket plus six completed fixed
  30-day buckets, rather than the previous four-bucket window.
- Extend the existing protected summary with a compact fixed readiness state.
- Keep three completed periods as the only displayed activity detail.
- Refresh automatically through the existing Settings lifecycle.
- Require a human review using only aggregate and synthetic fixtures before
  any future threshold version can be proposed.

## Deliberate Non-Outcomes

- No policy, candidate score, confirmation threshold, provider, AI, RAG,
  learning, retry, classification, or routing behavior changes.
- No individual, media, policy, actor, outcome, prompt, model, provider, or
  RAG data is retained or returned.
- No new API endpoint, selector, migration, scheduled job, or manual refresh
  button.

## Open Pull Request Applied Locally

On 2026-08-31, [PR #524](https://github.com/cloudbyday90/Classifarr/pull/524)
was open. Its Morgan 1.12.0 server-runtime update is applied locally for
validation only. The upstream release notes identify a log-output security
fix. The pull request is not merged or modified.

## Validation

All checks passed before commit:

- Focused server tests: 4 suites, 10 tests.
- Focused client tests: 3 files, 6 tests.
- Full server test suite: 960 unit suites / 27,123 unit tests, plus 75 of 76
  integration suites (868 tests passed; one existing skip).
- Full client test suite: 287 files / 3,963 tests.
- Server and client linting, type checks, builds, coverage runs, and the
  client coverage ratchet all passed.
- `npm --prefix server audit --audit-level=high` reported zero vulnerabilities.
- A complete security diff review covered all 14 implementation and test files
  and reported zero findings. It verified the existing administrator,
  selector-free, rate-limited, no-store boundary; fixed server-selected
  aggregate reads; fail-closed client projection; and the locked Morgan update.
- `docker compose build --no-cache` completed successfully, and
  `docker compose up -d --force-recreate --wait` recreated a healthy local
  `classifarr` container on port 21324.

The clean image installed the locked Morgan 1.12.0 package and reported zero
production dependency vulnerabilities during `npm ci`.

## Research Outcome

W3C's WCAG status-message guidance supports concise programmatically
determinable updates without taking focus; the delivered status uses
`role="status"` and the existing automatic visibility/five-minute refresh.
OWASP API4 supports the retained bounded, server-controlled read scope, while
the NIST Privacy Framework supports limiting the additional history to the
minimum aggregate-only window needed for a future human review.

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)

## Next Item

When readiness first reaches `ready_for_human_review`, add a separately
reviewed, offline aggregate/synthetic-fixture calibration protocol. It must
produce a proposed contract version and test fixture changes for human review,
not write thresholds or trigger automation.
