# Published-upgrade provenance diagnostics

## Finding and decision — September 28, 2026

The previous upgrade test stopped with HTTP 401 because an invalid process-level
`GITHUB_TOKEN` shadowed a valid stored GitHub CLI login. The pinned image's
attestation verified successfully when that variable was removed only from a
single local invocation. No saved credential, machine environment or verification
policy was changed.

Keep the existing mandatory provenance check. Extract its fixed invocation and
safe failure classification into a small ESM module so the acceptance receipt
explains the cause and next action instead of only saying "preflight".

## Official research

- [GitHub CLI environment](https://cli.github.com/manual/gh_help_environment):
  `GH_TOKEN` precedes `GITHUB_TOKEN`, and both override stored credentials.
  Token presence is enough to identify the selected source; never print values.
  Disable interactive prompts and inherited HTTP debug logging for this bounded
  verification subprocess.
- [GitHub CLI attestation verification](https://cli.github.com/manual/gh_attestation_verify):
  retain the immutable image digest, repository, signer workflow, source digest
  and hosted-runner restriction. Pin the GitHub host too. Successful access alone
  is not proof of provenance.
- [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations):
  use the verifier to establish provenance rather than accepting a downloaded
  statement or substituting an unsigned local baseline.
- [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification):
  describe what failed in text. Apply that communication principle to the CLI
  and Markdown summary; this is not a claim of web UI WCAG conformance.

## Options and trade-offs

| Option | Benefit | Drawback | Decision |
| --- | --- | --- | --- |
| Automatically fall back to another credential | Convenient retries | Can silently switch identities or privileges | Reject |
| Disable provenance for local tests | Avoids authentication dependency | Cannot establish the published baseline's identity | Reject |
| Safe classification with explicit operator repair | Actionable and auditable; no secret output | User may need to correct local or CI authentication | Select |
| Permanently delete environment credentials | Removes this override | Changes unrelated workflows and session state | Reject |

Recommended stack: existing GitHub CLI verifier + fixed ESM policy/diagnostics
module + allowlisted installation receipt + existing isolated Compose drill.
No new production service, authentication mechanism or orchestrator.

## Contract and safety

Keep one bounded, shell-free verification attempt before creating any disposable
Docker resources. Classify missing CLI, timeout, authentication failure, access
or rate-limit failure, and otherwise unverified provenance. Unknown errors remain
failures, never successful evidence. HTTP 403 does not prove which permission or
rate limit failed; report that uncertainty rather than recommending broader scopes.

Only fixed reason codes, the credential-source name, and predefined next steps
may enter receipts. Do not persist raw stderr/stdout, HTTP bodies, tokens, account
names or exception causes. Reconstruct diagnostic fields when producing JSON
and Markdown; malformed input cannot inject arbitrary strings into reports.

Preserve the caller's environment and credential precedence. Never automatically
retry using the keyring, run an interactive login, or request extra permissions.
No CI or production defaults, image publication, deployment or release changes.

## Local recovery procedure

1. Run `gh auth status --hostname github.com` without `--show-token`.
2. If an environment token is invalid, correct it. If a known stored account is
   intended for this local test, remove the override only for that invocation.
   For example, in a disposable PowerShell process:

   ```powershell
   Remove-Item Env:GITHUB_TOKEN
   node scripts/run-runtime-installation-acceptance.mjs --resource-budget
   ```

3. If `GH_TOKEN` is also present, it has higher precedence; inspect its status
   rather than assuming removing `GITHUB_TOKEN` changes the selected credential.
4. In CI, repair the supplied workflow token/permissions; do not fall back to a
   personal credential. Keep all attestation checks enabled.

Record fresh and published-upgrade execution, tests and remaining limitations in
the separate validation document.
