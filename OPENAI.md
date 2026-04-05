# Agent Instructions

> This file is mirrored across AGENTS.md, CLAUDE.md, GEMINI.md, and OPENAI.md so the same instructions load in any AI environment.

## Project Overview

Classifarr is a Node/Express backend with a Vue 3 + Vite frontend. The server exposes REST APIs (and serves the built UI), while the client provides the web interface for policy-driven media classification.

## Repo Layout

- `client/` - Vue 3 + Vite frontend
  - `src/components`, `src/views`, `src/router`, `src/stores`, `src/api`, `src/composables`, `src/utils`
  - Tests live in `client/src/__tests__`
- `server/` - Express backend
  - Entry point: `server/src/index.js`
  - Routes: `server/src/routes`
  - Services: `server/src/services`
  - Middleware/config/utils: `server/src/middleware`, `server/src/config`, `server/src/utils`
  - Tests live in `server/src/__tests__`
- `database/migrations/` - SQL migrations
- `scripts/` - local maintenance/debug utilities
- `docker-compose*.yml`, `Dockerfile` - containerized setup
- `docs/` - project documentation

## The 3-Layer Architecture (Best Practice)

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

**Layer 1: Directive (What to do)**
- SOPs written in Markdown, live in `directives/`
- Define goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution. Example: you don't scrape websites manually—you read `directives/scrape_website.md`, then run `execution/scrape_single_site.py`

**Layer 3: Execution (Doing the work)**
- Deterministic scripts in `execution/` (prefer Python for automation)
- Environment variables, API tokens, etc. are stored in `.env`
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Use scripts instead of manual work.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is to push complexity into deterministic code so you focus on decision-making.

## Working Rules

- Follow existing patterns in each area (client vs server). Avoid cross-cutting refactors unless requested.
- If you change API contracts, update both `server/src/routes` (and services) and the client API layer in `client/src/api`, plus any affected views/stores.
- If you change the database schema, add a new migration in `database/migrations/` and adjust server queries accordingly.
- Use `.env.example` as the reference for configuration; never commit real secrets.
- Keep changes scoped and document behavior changes in `README.md` or `docs/` when needed.

## Operating Principles

**1. Check for tools first**
Before writing a new script, check `execution/` per your directive. Only create new scripts if none exist.

**2. Self-anneal when things break**
- Read the error message and stack trace
- Fix the script and test it again (unless it uses paid tokens/credits/etc.—in that case, check with the user first)
- Update the directive with what you learned (API limits, timing, edge cases)
- Example: you hit an API rate limit → find a batch endpoint → rewrite script → test → update directive

**3. Update directives as you learn**
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations—update the directive. Don’t create or overwrite directives without asking unless explicitly told to.

## Self-annealing Loop

Errors are learning opportunities. When something breaks:
1. Fix it
2. Update the tool
3. Test the tool, make sure it works
4. Update the directive to include the new flow
5. The system is now stronger

## File Organization

**Deliverables vs Intermediates:**
- **Deliverables:** Google Sheets, Google Slides, or other cloud-based outputs the user can access
- **Intermediates:** Temporary files needed during processing

**Directory structure:**
- `.tmp/` - All intermediate files (dossiers, scraped data, temp exports). Never commit; always regenerated.
- `execution/` - Deterministic scripts
- `directives/` - SOPs in Markdown (the instruction set)
- `.env` - Environment variables and API keys
- `credentials.json`, `token.json` - Google OAuth credentials (required files; keep in `.gitignore`)

**Key principle:** Local files are only for processing. Deliverables live in cloud services where the user can access them. Everything in `.tmp/` can be deleted and regenerated.

## Common Commands

- Backend dev: `npm --prefix server run dev`
- Backend tests: `npm --prefix server test`
- Backend tests (unit only): `npm --prefix server run test:unit`
- Backend tests (targeted): `cd server && npx jest --testPathPatterns="<pattern>" --no-coverage`
- Frontend dev: `npm --prefix client run dev`
- Frontend tests: `npm --prefix client test`
- Frontend build: `npm --prefix client run build`

> **Jest note:** Use `--testPathPatterns` (plural). The singular `--testPathPattern` is deprecated in Jest 30+ and will print a warning. Always `cd server` before running `npx jest` directly.

## Notes

- This repo is primarily JavaScript; keep code consistent with existing style.
- Prefer updating existing scripts in `scripts/` or `server/src/scripts/` before adding new ones.

## Future Findings

- See `docs/interesting_findings.md` for non-blocking observations and follow-ups.

## Implementation Plans

- `docs/implementation_plan_discord_arr.md`
- `docs/implementation_plan_ai_clarification_policy_questions.md`

## Summary

You sit between human intent (directives) and deterministic execution (scripts). Read instructions, make decisions, call tools, handle errors, and continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.
