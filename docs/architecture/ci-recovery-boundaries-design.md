# CI recovery boundaries: design

Date: 2026-09-26. Unreleased; no release or deployment.

## Evidence and scope

[Run 36279486272](https://github.com/cloudbyday90/Classifarr/actions/runs/36279486272)
passed unit tests, integration tests, and coverage, but exposed two gaps outside
those checks. Cold native-intent navigation loaded 540,265 bytes of JavaScript,
exceeding its unchanged 524,288-byte budget. The released-schema replay crashed
with `EACCES: permission denied, mkdir '/app'` before comparing catalogs.

The previous commit added recovery outcomes and item-level guidance. Its tests
did not exercise these two complete CI commands. Command Center was eagerly
imported by the router, so its growing feature tree burdened unrelated pages.
Both isolated upgrade CLIs statically imported application modules that create
Pino's file transport using the default container-only log directory.

Restore these checks before changing recovery scheduling. This is a priority
change prompted by the supplied CI failure, not a claim that retry fairness has
already been fixed.

## Selected boundaries

- Make Command Center a normal Vue Router lazy route, matching the other main
  pages. Keep routing, authentication, semantics, SWR, and the byte limit intact.
- Configure each isolated rehearsal for stdout logging before dynamically
  importing its application runtime. Do not change production logging defaults,
  grant filesystem privileges, or swallow transport errors.
- Keep replay database names in a pure ESM module so CLI import and target
  validation cannot inadvertently initialize application logging.
- Extend production browser checks to reject eager Command Center loading and
  verify navigation back to it. Test CLI import under production logging with
  an invalid log directory, plus configuration-before-import ordering.
- Run both real isolated database rehearsals, not only mocked unit tests. All
  writes stay in disposable containers with generated credentials; no live
  application volume, routing setting, or provider is involved.

## Official research and tradeoffs

Sources were discovered through web search and opened on 2026-09-26. Guidance
describes these mechanisms; the particular fixes are inferred from repository
code and CI evidence, not prescribed for Classifarr by the source authors.

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Vue Router dynamic route import | Unrelated pages avoid dashboard code; cached after first visit | First dashboard visit fetches its chunk | Adopt |
| Raise the asset budget | Minimal implementation | Hides increasing shared payload | Reject |
| Configure isolated CLI logging before imports | Portable stdout diagnostics without application log writes | Ordering must be regression-tested | Adopt |
| Grant CI access to `/app` | Allows default file transport | Unnecessary privileges and host coupling | Reject |
| Change global logger defaults | Broad portability | Changes production behavior beyond this defect | Defer |

[Vue performance guidance](https://vuejs.org/guide/best-practices/performance)
recommends measuring actual builds and loading features on demand.
[Vue Router guidance](https://router.vuejs.org/guide/advanced/lazy-loading)
distinguishes promise-returning route loaders from async components and caches
the loaded route. Use that existing mechanism, without a new dependency.

[Pino transport documentation](https://github.com/pinojs/pino/blob/main/docs/transports.md)
explains asynchronous worker initialization. Catching an unrelated awaited
database operation cannot make an already-started file transport safe; configure
its destination before module evaluation.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
requires programmatically determinable status where applicable. Existing headings,
links, and polite live status remain intact; code splitting must not replace
them with a visual-only indication. Browser navigation checks complement, but
do not establish, full accessibility conformance.

## Recommendation stack

1. Restore both CI checks without weakening thresholds or adding privileges.
2. Keep the full production-route and released-schema commands in local checks
   whenever shared UI dependencies or migration/runtime imports change.
3. Build on the deterministic movie/TV admission probe recorded in the outcome:
   implement a bounded oldest-attempt-first planner across complete streamed
   captures, then verify it with real database failure/restart tests at the
   unchanged eight-attempt budget.

For that next benchmark, [PostgreSQL ordering guidance](https://www.postgresql.org/docs/18/queries-limit.html)
requires predictable ordering for bounded selections. [AWS retry guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
emphasizes idempotency and controlling retry load. Neither jitter nor a larger
budget alone proves fairness for a stable source-ordered scan.
