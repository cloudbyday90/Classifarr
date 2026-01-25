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

## Working Rules

- Follow existing patterns in each area (client vs server). Avoid cross-cutting refactors unless requested.
- If you change API contracts, update both `server/src/routes` (and services) and the client API layer in `client/src/api`, plus any affected views/stores.
- If you change the database schema, add a new migration in `database/migrations/` and adjust server queries accordingly.
- Use `.env.example` as the reference for configuration; never commit real secrets.
- Keep changes scoped and document behavior changes in `README.md` or `docs/` when needed.

## Common Commands

- Backend dev: `npm --prefix server run dev`
- Backend tests: `npm --prefix server test`
- Frontend dev: `npm --prefix client run dev`
- Frontend tests: `npm --prefix client test`
- Frontend build: `npm --prefix client run build`

## Notes

- This repo is primarily JavaScript; keep code consistent with existing style.
- Prefer updating existing scripts in `scripts/` or `server/src/scripts/` before adding new ones.
