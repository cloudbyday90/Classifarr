# Protected startup: preserve operator tuning

Date: 2026-10-05. Follows [configuration preservation](selected-configuration-design.md).
The subsequent [deployment admission design](selected-deployment-design.md)
adds heap-only Node options and compatible pool/retry defaults for compiled
deployment profiles; direct internal launches keep their earlier defaults.

## Decision and scope

Preserve documented application tuning before activating protected production
startup. The existing profile rejects queue retention, Ollama preflight, vector
recall and database pool settings. Inheriting the parent environment would avoid
that rejection but would also inherit executable and database authority.

Use a small ESM validation module with explicit bounds. Preserve supplied values,
including zero-valued queue retention and disabled refresh-token cleanup. Do not
silently clamp, substitute defaults or enable optional providers. Unsupported
settings must still refuse this path. Existing compatible startup is unchanged.

Database connection identity, socket, credentials, executable, Node options and
migration paths remain fixed. Pool size, query/acquisition timeouts and bounded
connection-acquisition retries are application tuning, not database identity.
The privileged schema/restore worker retains its separate fixed environment.

## Contract

- No new work on fresh installs. Absent settings retain protected-launch defaults
  (including pool 5 and connection retries 0), not automatic parity with the
  compatible path's pool 15/retries 2. Production selection must reconcile this
  deliberate resource policy before claiming drop-in configuration compatibility.
- Preserve DB/UI > runtime JSON > environment precedence where the consumer
  supports it. Copy strings into a new profile; never mutate the caller.
- Validate numbers lexically and numerically. Explicit bounds prevent timer
  overflow, unbounded retries and excessive pool/vector resources. Reject invalid
  values with a fixed message containing neither keys nor values.
- Accept zero for queue age retention (disabled), retry count/delay, slow-query
  threshold and Ollama cache. API audit retention zero means immediate pruning,
  not disabled pruning; preserve that existing distinction.
- Preserve optional empty pgvector scan caps as unset. Validate cross-field
  retry caps and vector candidate limits against supplied or existing defaults.
- Inventory every name in `.env.example` in a regression test: application
  settings must be supported; deployment/privileged settings require a named
  separate owner or an explicit deferred review. This is a documented-contract
  inventory, not a claim to enumerate every internal environment read.
- Keep preflight serialized and read-only. No database transaction, HTTP call,
  retry loop, key regeneration or ownership reset is introduced. Invalid
  configuration is permanent until corrected; restart does not alter it.
- Completion requires focused boundary/consumer tests, real-image child setting
  preservation, unchanged key/file behavior, and the existing isolated startup
  and restore scenarios. Production activation and restore HTTP are deferred.

## Research and tradeoffs

The new numeric rules admit: pool size 2–100 (normal admission pins one connection);
connection timeout 1–60,000 ms;
idle/query timeouts 1–600,000 ms; connection retries 0–10 and initial delay
0–30,000 ms; retention 0–36,500 days; queue cap 1–10,000,000 rows. Ollama
durations use existing consumer minima and a signed 32-bit timer ceiling;
context length is 256–131,072. Vector bounds match existing consumer clamps,
but protected admission refuses values that would be clamped. See
`selectedTuningConfiguration.mjs` for exact per-key bounds. These limits are
not a claim that every admitted combination suits every NAS's resource budget.

The sixteen documented non-application names stay out of the child profile:
three Compose mount inputs; runtime/schema modes; six database identity inputs;
pgvector binary staging and PostgreSQL startup deadline; three privileged
compatibility-retirement inputs. The final group remains unsupported in protected
application startup. Their exclusion is not authorization for a future dispatcher
to discard supplied values: deployment selection must validate them separately.

Official sources discovered through web search and opened on 2026-10-05:

- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  child `env` defaults to inheritance; explicitly build it and keep shell disabled.
- [Docker environment precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/):
  container environment is the resolved input, not permission to reinterpret
  saved operator choices. Classifarr's DB/JSON precedence is separate.
- [Docker environment practices](https://docs.docker.com/compose/how-tos/environment-variables/best-practices/):
  document precedence and keep secrets out of casual diagnostics.
- [OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html):
  minimize secret exposure; never include values in validation errors or reports.

| Option | Benefit | Cost |
| --- | --- | --- |
| Inherit all parent variables | Few compatibility gaps | Transfers privileged and executable overrides |
| Fixed profile only | Small attack surface | Omits legitimate operator choices |
| Bounded explicit tuning — selected | Preserves choices without identity changes | More rules; extreme legacy values need review |
| Activate immediately | Earlier rollout | Restore HTTP and full deployment inventory remain incomplete |

Recommendation stack: preserve documented application tuning; finish restricted
restore HTTP and deployment-input selection; prove published-image upgrades;
activate protected dispatch; then database-fenced unattended ingestion recovery.
Key rotation/reset remains separate. No UI interaction changes in this increment.
