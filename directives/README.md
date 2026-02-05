# Directives

This folder contains SOP-style directives that define the intended workflow for repeatable tasks. Directives are human-readable and describe the goal, inputs, required tools or scripts, expected outputs, and edge cases.

## Purpose
- Keep high-level procedures explicit, auditable, and easy to improve.
- Reduce ambiguity for recurring tasks by documenting a single source of truth.
- Enable reliable automation by pairing directives with deterministic scripts in `execution/`.

## When to Add a Directive
- The task is repeatable or complex enough to benefit from a step-by-step SOP.
- The task involves multiple tools or risky side effects.
- The task should be reproducible by another engineer or automation.

## Directive Structure
Each directive should be a single Markdown file and follow this structure:

- Title and intent
- Inputs and required configuration
- Preconditions and dependencies
- Tools or scripts to use (prefer `execution/`)
- Step-by-step procedure
- Outputs and artifacts
- Validation steps
- Error handling and recovery
- Edge cases and limitations
- Change log (brief notes when updated)

## Example Skeleton
```
# <Directive Title>

## Goal

## Inputs

## Preconditions

## Tools

## Steps

## Outputs

## Validation

## Error Handling

## Edge Cases

## Change Log
```

## Conventions
- Keep steps short and numbered.
- Prefer deterministic scripts when possible.
- Do not store secrets in directives.
- If a directive requires new environment variables, update `.env.example`.

## Relationship to `execution/`
Directives should reference scripts in `execution/` for repeatable work. If no script exists, document the manual procedure and consider adding a script in the future.
