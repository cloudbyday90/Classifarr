# Ollama Verification Compatibility Matrix — Outcome

## Delivered behavior

Classifarr provides a manual, advisory compatibility matrix in AI Settings for
the installed local Ollama environment. It explains whether the fixed strict
JSON-schema probe succeeds across a bounded subset of local model builds.

- The matrix binds transport to the saved AI Settings host and port, then reads
  the installed-model list on the server; it does not reuse a separate legacy
  Ollama-settings target. The browser sends no provider target, model, or
  prompt.
- It tests at most six local models serially: the saved model first, then a
  stable local-name order. Cloud-tagged models are excluded and any omitted
  count is shown.
- Each test uses the same media-free strict JSON-schema contract as the saved
  capability test, temperature `0`, a fixed timeout, and immediate unload
  request.
- The response is ephemeral. It includes only the local Ollama version, model
  name, short build-digest prefix, fixed outcome, timestamp, and latency.
- The dedicated endpoint rejects request bodies and remains behind the existing
  administrator settings boundary, a two-runs-per-hour rate limit, and a
  service-level single-flight gate.

## Explicit exclusions

The feature does not persist or return the saved host, port, full model digest,
configuration fingerprint/revision, credentials, prompt, response, raw error,
media, policy, routing decision, actor, or individual diagnostic event. It
does not call cloud-tagged models, pull models, alter the configured model, or
change the current saved verification capability.

If a model probe fails, the matrix records only an allow-listed result for the
current HTTP response. If version collection fails, model probes may still run
and the version is reported as unavailable. If a matrix is already running,
the new request receives a bounded in-progress response without starting more
provider work.

## Operator guidance

Run the matrix only after a saved capability test indicates a local
structured-output issue. A pattern where several local builds are
`classification_only` points to an Ollama/runtime compatibility concern; a
single failing build points to that model build. In either case, retest the
saved model after remediation. The matrix is not authority: only a successful
current saved-capability test can enable strict candidate-bound verification.

## Follow-up

The next useful item is a narrowly scoped operator guide that maps fixed
matrix outcomes to safe Ollama maintenance steps: checking the local service
version, replacing a model build, and re-running the saved capability test.
It should remain documentation-only unless real matrix evidence identifies a
repeatable product defect.

## External PR check

On 2026-08-29, the repository's open-pull-request query returned no open pull
requests. There was therefore no unrelated pull request to implement locally
or test in this change.
