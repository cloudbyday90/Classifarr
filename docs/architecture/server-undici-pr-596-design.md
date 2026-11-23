# Server Undici PR 596 assessment design

November 23, 2026 Eastern. [PR 596](https://github.com/cloudbyday90/Classifarr/pull/596)
was the only open PR and therefore the result of the selection. Its reviewed
head was `e54a926c6e0d420b2d5041b527e2bca860fb8e33`, one commit ahead and
zero behind main at intake.

## Candidate and tradeoffs

The PR proposes exact Undici 8.13.0. Its assessed head failed an existing
version assertion and an interceptor composition check. The upstream 8.13.0
release now enforces the supported cache and redirect composition order.
Version 8.13.1 adds fixes for aborted requests, response body cleanup, and
checking the server name on a reused connection. Assess exact 8.13.1 for
the standalone server dependency, building on the selected PR's scope.
[Undici 8.13.0](https://github.com/nodejs/undici/releases/tag/v8.13.0),
[Undici 8.13.1](https://github.com/nodejs/undici/releases/tag/v8.13.1),
[PR test job](https://github.com/cloudbyday90/Classifarr/actions/runs/45159819239/job/137642017831)

The recommended stack is the newer exact pin, the existing client and
Discord copies, and the existing install and audit policy. The newer pin
includes upstream transport fixes. The cost is validating the new supported
composition while retaining the older compatibility controls where those
versions remain installed. Reusing the PR pin would omit the follow-up
fixes. Keeping the current pin retains an already qualified baseline.

## Verification

Check the registry integrity, exact installed graph and manifest delta with
scripts disabled at lock generation. Use a strict clean install and review
the full server audit. Exercise the supported composition and its refusal
boundary, the shared client fixture on its existing version, and existing
server HTTP, TLS, bounded response and cancellation controls. Preserve the
assertions and production transport settings. Adopt only if the scoped
checks and fresh coverage and quality gates pass. Apply the exact qualified
pin locally and leave the selected PR unmerged.
