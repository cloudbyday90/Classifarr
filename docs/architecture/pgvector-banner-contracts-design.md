# Pgvector compatibility notice: design

Research date: 2026-10-12. Scope: Dashboard's optional pgvector banner, not binary
selection, database configuration, migrations, or recovery policy.

## Findings

The banner reads sessionStorage outside its request error handler and writes
dismissal without protection. A blocked storage getter/read/write can therefore
interrupt the optional notice. Its request can also update state after unmount.
It currently assumes generic mode means RAG is enabled, without checking `enabled`.

The restart advice is not supported by the actual startup paths. In
`docker-entrypoint.sh`, generic mode can result from CPU/image availability,
disabled runtime staging, or unsafe/unavailable symlink staging. A restart alone
cannot add missing binaries or guarantee a different selection. `avxGuard.mjs`
records the selection and CPU flags; `/rag/status` exposes those saved values,
not a proof of the currently loaded extension on an external database.

## Chosen design

1. Dashboard supplies the existing named `getRagStatus` loader through a required
   `() => Promise<unknown>` prop, matching the Arr warning boundary. HTTP stays in
   the client API layer; the GET response remains unwrapped and unchanged.
2. A pure ESM presenter accepts only an object with `enabled === true` and
   `pgvectorVariant === generic`. Unsupported/malformed status is not rendered.
   Absence of a notice is not a health declaration.
3. Wording distinguishes a reported generic-only build, explicitly reported lack
   of both AVX flags, and an unknown fallback cause. It does not guess staging
   failure from CPU support, promise speed gains, prescribe a restart, or suggest
   relaxing container/CPU safeguards. Describe saved reports as reports.
4. A small storage helper catches getter, read and write failures. Preserve the
   existing session key and exact `true` marker. Dismiss immediately in memory
   even when persistence fails. It may reappear after remount if storage is
   blocked; do not create an unbounded singleton cache or persistent server state.
5. Ignore request completion after unmount. Keep one fetch per non-dismissed
   mount, no retries/polling, no transport cancellation claim, and no raw error
   logging. Use the existing checked listener binding and named non-submit button.

## Alternatives and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Typed loader, pure presenter, best-effort session dismissal | Small independently checked boundaries; useful even with blocked storage | Adds explicit caller wiring; use now |
| Suppress the notice whenever storage fails | Less code | Loses relevant information; reject |
| Guarantee AVX after restart or relax mount permissions | Appears actionable | Unsupported by status data and can weaken safety; reject |
| Add persisted reason codes and runtime freshness to the API | More precise deployment diagnosis | Requires startup/database provenance work; separate follow-up |

Order: fix truthful display and failure isolation, verify strict/compiler/browser
contracts, then consider richer recorded startup evidence as its own batch.

## Research and validation

Official sources discovered and retrieved through connected web search:

- [MDN sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
  documents tab-scoped lifetime and SecurityError when storage is blocked. Guard
  access to the property itself, not only its methods.
- [Vue lifecycle hooks](https://vuejs.org/api/composition-api-lifecycle) documents
  synchronous hook registration and cleanup when unmounted. Register the late-result
  guard during setup.
- [Pgvector portability](https://github.com/pgvector/pgvector) explains why
  CPU-specific builds can fail on other machines. Retain compatibility protections;
  Classifarr-specific staging conclusions above come from local source inspection.

Test malformed/disabled/unknown/optimized status, each supported explanation,
storage getter/read/write failures, session persistence, loader errors, late
completion, Dashboard wiring, compiler rejection, and real keyboard dismissal.
Run full frontend coverage, existing backend status/selection regressions, lint,
typechecks, browser/build checks and a no-cache local image with an isolated schema
dump. Record actual outcomes separately. No release or Unraid mutation.

Current GitHub MCP enumeration returned zero open PRs; no random candidate exists.
Do not invent or reopen one to satisfy that request.
