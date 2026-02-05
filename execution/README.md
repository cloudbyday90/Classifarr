# Execution

This folder contains deterministic scripts used to carry out directives. Scripts should be reliable, repeatable, and safe to run on developer or CI environments.

## Purpose
- Encapsulate automation so results are consistent.
- Reduce manual steps and human error.
- Provide a stable interface for directives to call.

## When to Add a Script
- A directive is executed more than once.
- A task requires multiple steps that can be automated.
- A task is error-prone or has strict validation needs.

## Script Standards
- Prefer Python for scripting unless the repo already uses another tool for the task.
- Scripts must be deterministic and idempotent when possible.
- All inputs should be explicit via arguments or environment variables.
- Produce clear, machine-readable outputs when reasonable.

## Documentation Requirements
Each script should have:
- A header with a short description.
- Usage examples.
- Required environment variables.
- Exit codes and error behavior.

## Example Header
```
"""
Description: Syncs embeddings and validates results.
Usage: python execution/sync_embeddings.py --dry-run
Env: DATABASE_URL, API_KEY
"""
```

## Testing and Validation
- If a script changes data, include a dry-run mode when feasible.
- Validate outputs with explicit checks.
- Log progress and errors clearly.

## Security and Secrets
- Never hardcode secrets in scripts.
- Use `.env` and `.env.example` for configuration.
- Avoid writing sensitive data to disk.
