# Changelog

All notable changes to Classifarr will be documented in this file.

This project uses [Semantic Versioning](https://semver.org/) for releases.
Current stage: **Alpha** (v0.x-alpha)

---

## [0.10-alpha] - 2025-12-21

### 🎉 Initial Public Alpha

This is the first consolidated alpha release of Classifarr, an AI-powered media classification platform for the *arr ecosystem.

### Core Features
- **AI Classification Engine** - Multi-stage matching: exact → learned → rule → AI fallback
- **Ollama Integration** - Local LLM for privacy-first classification
- **Embedded PostgreSQL** - Single-container deployment with built-in database
- **Vue 3 Frontend** - Modern dark theme matching *arr ecosystem

### Media Server Support
- Plex (OAuth + manual connection selection)
- Jellyfin (API key authentication)
- Emby (API key authentication)

### Request Manager Support
- Overseerr
- Jellyseerr
- Seer (unified successor)
- Multi-manager support (run multiple simultaneously)

### Queue System
- Database-backed task queue
- Ollama offline resilience (tasks persist until Ollama available)
- Exponential backoff retry: 30s → 1m → 2m → 5m → 10m
- Max 5 retries before permanent failure

### Discord Integration
- Real-time classification notifications
- Interactive correction buttons
- In-app setup wizard

### Additional Features
- JWT-based authentication
- Confidence thresholds with AI clarification
- Learning system that improves from corrections
- TMDB/TVDB metadata integration
- Comprehensive logging with database persistence

---

## Version History

Prior to v0.10-alpha, development releases were numbered v1.0.0 - v1.8.0.
These have been consolidated into this alpha release for clearer versioning.
