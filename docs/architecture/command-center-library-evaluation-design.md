# Command Center library evaluation summary

## Decision — 13 September 2026

Expose the previous commit's live library-evidence evaluation through one compact
Command Center summary. Separate evidence qualification from confirmation holds.
Move the existing protected-study readiness card into optional details. Do not add
settings, inference, training, routing permission, or a new polling loop.

## Research and tradeoffs

Official URLs were discovered through web search and opened on 13 September 2026.
These are design inputs, not a claim of complete WCAG conformance.

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Reuse live-stats polling | No additional timer or request; follows current visible-tab cadence | The response must become memory-only in this client | Use |
| New dedicated polling endpoint | Independent refresh and failure boundary | Extra requests and lifecycle logic | Defer |
| Show an accuracy percentage | Easy to scan | These counters have no independently labelled denominator | Reject |
| Compact summary with optional details | Less routine reading; diagnostics remain available | Details require an optional expansion | Use |
| Persistent historical dashboard | Survives restarts and supports trends | Needs durable, deduplicated, versioned measurements | Defer until needed for validated evaluation |

W3C's [Pause, Stop, Hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
requires a way to control nonessential auto-updating content. Provide an optional
summary pause/resume button without pausing classification. Resume jumps to the
latest snapshot. A future page-wide control can consolidate the older panels.

W3C's [Status Messages guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
warns against excessive announcements. Announce loading/unavailable/paused states,
not every counter tick. Use native disclosure controls and visible keyboard focus.

OWASP's [REST Security guidance](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
supports per-request access checks, generic failures, and no-store responses.
Only authenticated administrators receive the new aggregate. Do not include media,
library identities, provider messages, configuration, or prompts.

## Contract and ownership

- Add an optional administrator-only `libraryEvaluation` field to the existing
  `GET /api/queue/live-stats` response. Its reader uses the same evaluation-service
  instance owned by the production classification path; never a second counter.
- Project only a fixed version, availability, bounded counters, and an explicit
  diagnostic-only authority flag. Malformed input means unavailable, not zero.
- Set `Cache-Control: no-store` and vary by authorization. Disable persistent and
  cross-tab caching for live stats; clear its in-memory response on read failure.
- Reading status does not run retrieval, model generation, or any mutation.
- Render fixed application copy, never arbitrary diagnostic strings or HTML.

## Meaning of the numbers

Counters are attempts since the evaluation service started, capped individually
at 1,000,000 and reset on restart. They are neither distinct media items nor current
queue counts. The UI must not accumulate snapshots across restarts.

Evidence passes comprise strict passes held for confirmation, calibrated passes
held for confirmation, and calibrated shadow passes without that hold. The held
subset is shown separately; preparation counts are not evidence passes.

Other counters describe unsuccessful, unavailable, busy, or freshness-blocked
attempts. Some admission exits and strict automatic-route successes are not
instrumented here. There is no valid total-classification or accuracy denominator.
The diagnostic authority flag does not describe the global routing setting.

## Recommended stack and verification

Use the existing Express route factory with an injected read-only projection,
the existing Vue live-stats refresh with memory-only storage, a small ESM parser,
and a focused Vue summary component. Keep protected-study readiness independent
and available inside details. Preserve all routing gates.

Verify projection boundaries, authentication/role filtering, no-store, failure
isolation, service-instance wiring, cache exclusion, reactive refresh, pause and
resume, permission loss, reset/empty/malformed states, narrow-screen layout, and
keyboard disclosure. Test local Compose without routing media or using paid AI.

## PR scope

GitHub MCP returned no open pull requests for cloudbyday90/Classifarr at planning
time. No closed PR will be substituted and no PR will be merged.
