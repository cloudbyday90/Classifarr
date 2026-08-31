# Route-safety readiness auto-refresh design

## Decision

Add one small, automatically refreshed Route Safety Readiness summary to AI
Settings. It reports only the three most frequent allow-listed primary
route-safety gate categories in the last seven completed UTC days. It is a
descriptive operational signal, not an AI result, policy-health score, or
routing control.

The card refreshes with the existing saved AI-capability lifecycle while the
page is visible. The existing pause control stops both refreshes. A refresh
uses no caller-provided filters, does not call a provider, and does not invoke
RAG, retry, policy, learning, or routing work.

## Why this is the next component

The current UI correctly explains a route decision after it reaches Needs
Attention, but it gives little compact feedback about what safeguards are
actually being observed. That made the AI area feel busy while still leaving
the operator unsure whether AI verification, a score threshold, or a policy
gate was the relevant follow-up.

The new summary separates those questions:

- **Saved AI readiness** answers whether the configured provider can perform
  its configured role.
- **Route Safety Readiness** answers which deterministic safeguards have been
  observed recently.
- **Needs Attention** remains the place to inspect and resolve an individual
  item.

This preserves Classifarr's intended boundary: AI and RAG may contribute
advisory evidence, while deterministic policy and an operator remain the
authority for routing.

## Alternatives considered

| Option | Pros | Cons |
| --- | --- | --- |
| Full item-level route dashboard in AI Settings | Directly answers individual questions | Duplicates Command Center, exposes media/policy context, and makes Settings busier |
| Provider probe during every refresh | Fresh provider signal | Spends local inference capacity, conflates provider health with routing, and risks repeated work |
| Client-side analysis of pending items | Quick to prototype | Duplicates server policy semantics and leaks more data to the browser |
| **Fixed server aggregate with visible-page refresh** | Clear separation, low load, no item identity, works with existing pause control | Cannot explain an individual item; requires navigation to Needs Attention |

## Recommended stack

1. Use the existing persisted `classification.route_safety.v1` projection as
   the sole source.
2. Query a server-built seven-completed-UTC-day window and an allow-list of
   primary-gate identifiers.
3. Return only a version, completed window, total count, three fixed gate
   labels/counts, and a fixed status. No media, library, policy term, provider,
   model, prompt, response, actor, or raw diagnostic crosses the API boundary.
4. Protect the endpoint with administrator authorization, `Cache-Control:
   no-store`, and a 30-request/15-minute rate limit.
5. Revalidate the returned version, statuses, identifiers, and counts in a
   small client presentation module before Vue renders them.
6. Refresh it with saved AI readiness only when the page is visible; retain the
   existing pause control and announce only a meaningful status transition, not
   every timestamp update.

## Security and privacy boundaries

The read is static and parameterized. Its reporting period and gate vocabulary
are constants in server code; request parameters cannot choose a date range,
library, classification, provider, or category. The migration adds only a
partial index to the existing history table, not an event stream or another
retention path.

The client does not trust display text from the response. It maps only
allow-listed gate and status identifiers to local presentation text, drops
unknown data, and caps displayed categories at three. The endpoint has no write
operation and cannot authorize routing.

## Accessibility and automatic updates

W3C WCAG 2.2 Success Criterion 2.2.2 requires a mechanism to pause, stop,
hide, or control the frequency of automatically updating content presented in
parallel with other content. The existing "Pause automatic updates" control
therefore governs this card as well. WCAG 2.2 Status Messages asks that
important changes that do not take focus be programmatically determinable, but
also warns against a chatty live-region experience. The card announces only a
status transition, not every periodic count/timestamp refresh. Its visible,
fixed-text unavailable state explains what did not load and what behavior is
unchanged.

## Sources consulted on 2026-08-31

- [W3C WCAG 2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C WCAG 2.2: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
- [NIST AI Risk Management Framework](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10)
- [NIST TEVV-Athlon Framework](https://www.nist.gov/artificial-intelligence/ai-research/tevv-athlon-framework-evaluating-ai-systems)
- [OWASP API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)

NIST's current material supports traceable monitoring and testing rather than
equating a single capability signal with a route decision. The W3C guidance
supports the explicit pause mechanism and restrained status announcement.
OWASP supports constraining a recurring aggregate endpoint with both a bounded
query and a rate limit.
