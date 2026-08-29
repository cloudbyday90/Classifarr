# Ollama Verification Compatibility Capacity Eligibility — Outcome

## Delivered behavior

The compatibility matrix now has a separate server-side eligibility policy for
automatic comparison candidates:

- The installed saved model remains first even when its artifact is larger than
  the alternative capacity boundary.
- Other local models require a known positive artifact size of 24 GiB or less.
- Oversized, unknown-size, and clearly embedding-only alternatives are skipped
  before a generation request.
- The existing cloud exclusion, stable ordering, six-model total maximum,
  serial probes, timeout, unload request, and single-flight protection remain
  in force.
- AI Settings receives only an aggregate skipped-alternative count. It reveals
  no capacity threshold inputs, sizes, families, provider target, response, or
  raw error.

## Sanitized live evidence

The saved local `gemma4:e4b` model completed the fixed strict JSON-schema
probe with a `verification_ready` result in 13,987 ms. The evidence supports
the conclusion that this build can participate; any current strict-routing
block should be investigated as saved configuration or admission state rather
than a blanket model incompatibility.

No raw provider response, endpoint, full digest, prompt, media, or credentials
was retained in this outcome.

## Verification

Server unit coverage verifies deterministic selection, a saved model above the
alternative boundary, oversized and embedding exclusions, response projection,
and serial probe behavior. Client coverage verifies the aggregate skipped
indicator. A live inventory selection check confirms that the server module
keeps the saved model while avoiding ineligible alternatives in the observed
environment.

## External PR check

On 2026-08-29, the repository open-pull-request query returned no open pull
requests. No unrelated pull request could be implemented or tested locally.
No release was created for this change.

## Next item

After deploying this commit, run **Local model compatibility check** once and
compare its saved-model inclusion and outcome with **Test Ollama Verification**.
If the saved model remains capability-ready but strict admission is unavailable,
collect the status-only saved capability state for a focused admission-path
investigation.
