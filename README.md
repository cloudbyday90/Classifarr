# Classifarr

**Policy-Driven Media Classification for the *arr Ecosystem**

Classifarr is an intelligent media classification platform that automatically routes incoming requests from Overseerr/Jellyseerr/Seer to the correct Radarr/Sonarr library. **v0.41.2-alpha** builds on the Policy Engine - a transparent, configurable system that combines content presets, auto-discovered patterns, semantic similarity (RAG), and learning from your decisions. Everything runs in a single self-contained Docker container with embedded PostgreSQL.

![License](https://img.shields.io/github/license/cloudbyday90/Classifarr)
![Version](https://img.shields.io/badge/version-v0.41.2--alpha-blue.svg)
![Docker Pulls](https://img.shields.io/docker/pulls/cloudbyday90/classifarr)
![Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen.svg)

## Features

Classifarr focuses on fast, explainable media classification with deep control over policy and AI usage.

- Policy-driven classification engine with 168 presets, patterns, and configurable weights
- Transparent scoring breakdowns and classification explanations
- AI skip logic to reduce API usage and cost
- RAG semantic search using text embeddings for history-aware decisions
- Optional image embeddings for poster similarity
- Multi-provider AI support (OpenAI, Gemini, OpenRouter, Ollama) with budgets and rate controls
- Real-time system health monitoring with trends and latency
- Robust error handling with consistent API responses
- Secure authentication with API keys and permissioned access
- Media server integration for Plex/Emby/Jellyfin plus Radarr/Sonarr routing
- Embedded PostgreSQL with pgvector and automated migrations
- Discord notifications, webhooks, and activity dashboards
- Single-container deployment with Docker Compose

## Architecture

Introduced in v0.37.0, the Policy-Driven Classification Engine powers the core routing flow.

```
Overseerr/Jellyseerr/Seer
  -> webhook
  -> Classifarr (single container)
     - Policy Engine (presets, patterns, RAG, history)
     - Action thresholds (auto / confirm / manual)
     - Optional AI validation for mid-confidence results
     - Feedback + learning loop
  -> Routes to Radarr/Sonarr libraries
```

### Why the Policy Engine?

Old way (v0.36.x): AI decides -> you hope it's right -> fix mistakes later  
New way (v0.37.0): formula calculates -> AI validates -> system learns -> you see exactly why

Benefits:
- Transparent: full breakdown of why items were classified
- Configurable: adjust weights and thresholds per library
- Efficient: reduces AI API calls
- Accurate: learns from corrections
- Explainable: know what signals matched and why

## Quick Start

### Prerequisites for Local Development

> **Note:** If you're using Docker (recommended for production), you can skip to [Docker Prerequisites](#prerequisites) below. This section is for developers running Classifarr locally.

- **Node.js >= 24.11.0 LTS**
- **npm >= 10.0.0**

#### Install Node.js 24 LTS

Using nvm (recommended):
```bash
nvm install 24.11.0
nvm use 24.11.0
```

Or download from [nodejs.org](https://nodejs.org/)

#### Why Node.js 24?

Our test runners and build tools leverage Node.js 24+ features like `--no-experimental-webstorage` for stability. Running older versions may cause test failures or unexpected behavior. See [Node.js 24 Migration Guide](docs/nodejs-24-migration.md) for detailed upgrade instructions.

### Prerequisites

- Docker and Docker Compose
- TMDB API Key ([Get one here](https://www.themoviedb.org/settings/api))
- OMDb API Key ([Get one here](https://www.omdbapi.com/apikey.aspx)) - enhances metadata
- Plex/Emby/Jellyfin media server
- Ollama instance OR cloud AI API key (OpenAI, Gemini, OpenRouter)
- Optional: Image Embedding Service (for poster embeddings)  
  [classifarr-image-embedding-service](https://github.com/cloudbyday90/classifarr-image-embedding-service)
- Discord Bot Token (optional, for notifications)

### Installation

#### Option 1: Docker Compose (Recommended)

1. **Create a directory and docker-compose.yml:**

```bash
mkdir classifarr && cd classifarr
```

2. **Create `docker-compose.yml`:**

```yaml
services:
  classifarr:
    image: ghcr.io/cloudbyday90/classifarr:latest
    # pgvector auto-selects AVX when supported, otherwise uses generic build
    container_name: classifarr
    ports:
      - "21324:21324"
    environment:
      - PUID=1000        # Your user ID (run `id -u` to find)
      - PGID=1000        # Your group ID (run `id -g` to find)
      - TZ=America/New_York  # Your timezone
    volumes:
      - ./data:/app/data
      # Media libraries - mount your Plex/Radarr/Sonarr media root
      - /path/to/media:/data/media
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"  # Required for Ollama on Linux
```

> **Important:** The media volume (`/data/media`) should point to the same root folder that Plex, Radarr, and Sonarr access. This enables re-classification path testing and media move features.

3. **Start the container:**

```bash
docker compose up -d
```

#### Option 2: Docker Run

```bash
docker run -d \
  --name classifarr \
  -p 21324:21324 \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=America/New_York \
  -v ./data:/app/data \
  -v /path/to/media:/data/media \
  --add-host host.docker.internal:host-gateway \
  --restart unless-stopped \
  ghcr.io/cloudbyday90/classifarr:latest
  # pgvector auto-selects AVX when supported, otherwise uses generic build
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUID` | User ID for file permissions | `1000` |
| `PGID` | Group ID for file permissions | `1000` |
| `TZ` | Timezone (e.g., `America/New_York`) | `UTC` |
| `UMASK` | File permission mask | `022` |

#### Migration Path Configuration (Advanced)

If migrations fail to load in Docker, you can override the paths:

```yaml
environment:
  - MIGRATIONS_DIR=/app/database/migrations
  - SCHEMA_FILE=/app/database/schema/current.sql
```

> [!CAUTION]
> **PUID/PGID Must Match Across All Containers**
> 
> For Classifarr to move media files between libraries, it must run with the **same PUID/PGID** as your other media containers (Radarr, Sonarr, Plex, etc.). If these don't match, file moves will fail due to permission issues.
> 
> To find your PUID/PGID:
> - Linux: Run `id -u` (PUID) and `id -g` (PGID) 
> - UnRaid: Default is `PUID=99`, `PGID=100`
> - Synology: Default is `PUID=1026`, `PGID=100`

> **Note:** First startup takes 30-60 seconds for database initialization.

4. **Access the web interface:**

Open `http://localhost:21324`

### First-Time Setup

1. **Create Admin Account** - Set username, email, and secure password
2. **Connect Media Server** - Use OAuth (Plex) or manual configuration
3. **Configure TMDB** - Enter API key for metadata enrichment
4. **Configure OMDb** - Additional ratings and metadata
5. **Configure AI Provider** (recommended) - Choose Ollama, OpenAI, Gemini, or OpenRouter
6. **Configure Discord** (optional) - For notifications and corrections

## API Authentication

Classifarr supports two authentication methods for secure access:

### 1. JWT Tokens (Web UI)
Used by the web interface for user sessions. Tokens are automatically managed by the browser.

### 2. API Keys (Integrations)
For third-party integrations, automation, and external tools.

#### Creating an API Key

1. Go to **Settings** -> **Security**
2. Click **Create New API Key**
3. Set a descriptive name and permission level:
   - **Read-Write**: Full access to all endpoints
   - **Read-Only**: Access to GET endpoints only
4. Copy the key (you can view it again later when logged in)
5. Use in requests with the `X-API-Key` header

#### Using an API Key

```bash
# Get libraries
curl -X GET http://localhost:21324/api/libraries \
  -H "X-API-Key: clf_your_api_key_here"

# Trigger a library sync
curl -X POST http://localhost:21324/api/libraries/1/sync \
  -H "X-API-Key: clf_your_api_key_here" \
  -H "Content-Type: application/json"
```

#### Permission Levels

| Permission | Endpoints | Use Case |
|------------|-----------|----------|
| `read_only` | All GET endpoints | Monitoring, dashboards, read-only integrations |
| `read_write` | All endpoints (GET, POST, PUT, DELETE) | Automation, full integrations, webhook processing |

#### Security Best Practices

- **Store keys securely** - Use environment variables or secret managers
- **Use read-only keys** when write access is not needed
- **Rotate keys periodically** - Revoke old keys and create new ones
- **Revoke unused keys** - Delete keys that are no longer in use
- **Never commit keys** to version control
- **Monitor usage** - Check "Last Used" timestamps in Settings -> Security

#### Default API Key

On first startup, Classifarr auto-generates a read-write API key named "Default API Key". The full key is displayed in the server logs:

```
INFO: Auto-generated default API key
  Prefix: clf_abc1...
  Full key: clf_abc123xyz...
  You can view this key again in Settings -> Security.
```

You can view this key again later in **Settings** -> **Security** by clicking the eye icon.

## System Health Monitoring

Classifarr includes comprehensive real-time health monitoring for all integrated services, accessible via the UI and API.

### Health Dashboard

Navigate to **System** -> **Health** to view:
- **Service Status** - Current operational state of each service
- **Trend Indicators** - Visual arrows showing health trends over time
- **Last Successful Check** - When the service last responded successfully
- **Response Time** - Current latency with color-coded indicators
- **Instance Details** - For services with multiple instances (Radarr/Sonarr)

### Health Status Values

| Status | Icon | Description |
|--------|------|-------------|
| `healthy` | OK | Service is operational and responding normally |
| `degraded` | WARN | Service is responding but with elevated latency or partial failures |
| `unhealthy` | DOWN | Service is not responding or returning errors |
| `unknown` | UNKNOWN | Service has not been checked yet or status is indeterminate |

### Trend Indicators

| Indicator | Meaning |
|-----------|---------|
| up | Service health is improving (consecutive successful checks) |
| down | Service health is degrading (recent failures or increased latency) |
| stable | Service health is stable (consistent performance) |

### Auto-Refresh

The health dashboard automatically refreshes every 30 seconds to provide real-time monitoring without manual intervention.

### System Health API

For automated monitoring and integrations, see the [System Health API Documentation](docs/api/system-health.md).


## How Classification Works (v0.37.0)

The Policy Engine uses a **formula-first, AI-validates** approach:

### Step 1: Authoritative Signals (100% Confidence)

Items with these signals skip all other evaluation:

- **Existing Media** - Already in your media server library
- **Manual Correction** - You explicitly corrected this classification before
- **Exact Match** - Previously confirmed TMDB ID with high confidence

### Step 2: Policy Evaluation (Formula-Based Scoring)

Each library has a policy that evaluates items using four weighted signals:

```
Final Score = (Preset Score - 0.40) + 
              (Pattern Score - 0.25) + 
              (RAG Score - 0.20) + 
              (History Score - 0.15)
```

#### Preset Score (40% weight)
Matches against 168 pre-built content definitions:
- **Genres**: Action, Comedy, Horror, Anime, Documentary, etc.
- **Ratings**: Family-friendly, Teen, Adult-only
- **Themes**: Superhero, True Crime, Sports, Holiday
- **Studios**: Pixar, A24, Marvel, Ghibli
- **Eras**: Classic, 80s, Modern, Recent
- **Languages**: English, Japanese, Korean, etc.
- **Special**: Reality TV, Stand-up, Concert, Biographical

Each preset checks multiple signals (certifications, genres, keywords, studios, years, etc.)

**Example:** A movie with PG rating + Animation genre + "disney" keyword -> Matches `family_friendly` preset (95%)

#### Pattern Score (25% weight)
Auto-discovered patterns from your feedback:
- **Studio Patterns**: "A24 films -> Indie library" (85% confidence)
- **Keyword Patterns**: "christmas" in title -> Holiday library (92% confidence)
- **Genre Patterns**: "Documentary + Crime" -> True Crime library (78% confidence)

Patterns learn from corrections:
- Correct prediction: +5% confidence (max 95%)
- Incorrect prediction: -5% confidence
- Auto-deprecate below 30%

#### RAG Score (20% weight)
Semantic similarity to previously classified items:
- Uses vector embeddings of title, overview, genres, cast, studio
- Finds similar items you've classified before
- Higher similarity = higher confidence
- Requires 50+ embeddings to activate

**Example:** "Inception" is similar to "Interstellar" which you classified to "Sci-Fi Movies" -> 82% RAG score

#### History Score (15% weight)
Policy's historical accuracy on similar content:
- Tracks correct vs incorrect classifications
- Higher accuracy = higher weight
- 7-day and 30-day trend analysis

### Step 3: Action Determination

Based on the final score:

| Score | Action | AI Call | Behavior |
|-------|--------|---------|----------|
| >=85% | **Auto-Classify** | Skipped | Immediately routed to library (70-80% faster) |
| 60-84% | **Prompt Confirm** | Skipped | "Is this correct?" (Discord/Web) |
| 40-59% | **Prompt Select** | Used | AI helps pick from top 3 options |
| <40% | **Manual** | Used | AI provides guidance for manual selection |

**Performance Benefit:** Most classifications (>=85% confidence) skip AI entirely, reducing latency from 3+ seconds to ~300ms.

### Step 4: AI Validation (When Needed)

For scores below 60%, AI assists with decision-making:
- Reviews formula's top suggestions
- Confirms or suggests alternative
- Adds reasoning to feedback log
- Both formula and AI opinions logged

**Cost Savings:** 70-80% reduction in AI API costs since most classifications skip AI validation.

### Step 5: Feedback & Learning

Every decision feeds back into the system:
1. **Record to feedback log** - Full metadata, signals, user choice
2. **Discover new patterns** - Auto-detect recurring studios, keywords
3. **Generate tuning suggestions** - "Remove underperforming preset", "Add new pattern"
4. **Update statistics** - Accuracy rates, trends, correction counts

**Result:** System gets smarter with every classification you review.

## Policy Builder

Create and configure classification policies through the visual interface:

### Creating a Policy

1. Go to **Settings** -> **Policies**
2. Click **Create Policy**
3. Select target library
4. Choose content presets from categories:
   - Browse by category (Genres, Ratings, Themes, etc.)
   - Search for specific presets
   - Adjust individual preset weights (0.5 = reduce, 1.5 = boost)
5. Configure thresholds:
   - **Auto-classify threshold** (default 85%)
   - **Prompt threshold** (default 60%)
   - **AI validation threshold** (default 90%)
6. Adjust scoring weights:
   - Preset weight (default 40%)
   - Pattern weight (default 25%)
   - RAG weight (default 20%)
   - History weight (default 15%)
7. Save policy

### Example: Kids Movies Policy

**Presets Selected:**
- `family_friendly` (certifications: G, PG)
- `animated` (Animation genre)
- `pixar` (Pixar studio)
- `disney` (Disney studio)

**Thresholds:**
- Auto-classify: 90% (more conservative)
- Prompt: 70%

**Result:** Most Pixar/Disney animated films auto-classify. Edge cases (e.g., Pixar shorts) prompt for confirmation.

### Preset Categories

**Audience (8 presets)**
- family_friendly, kids_only, teen, adult_only, etc.

**Genres (60 presets)**
- Core: action, comedy, horror, scifi, anime, documentary
- Subgenres: romantic_comedy, psychological_horror, cyberpunk, superhero
- Special: true_crime, nature, concert, standup

**Quality (10 presets)**
- highly_rated, critically_acclaimed, cult_classic, indie, blockbuster

**Franchise (25 presets)**
- marvel_mcu, star_wars, harry_potter, pixar, ghibli, a24

**Temporal (12 presets)**
- classic_films, 80s, 90s, 2000s, modern, recent_releases

**Regional (25 presets)**
- hollywood, british, bollywood, korean, anime, spanish, french

**Seasonal (8 presets)**
- christmas_holiday, halloween, thanksgiving, valentines, summer

**TV-Specific (20 presets)**
- tv_sitcom, tv_drama, tv_reality, tv_anime, tv_documentary

**See full preset reference:** [docs/presets/README.md](docs/presets/README.md)

## Policy Statistics & Tuning

Monitor and optimize your policies with the Stats Dashboard:

### Stats Dashboard

Access via **Dashboard** -> **Policy Stats**

**Overview Cards:**
- Total classification decisions
- Overall accuracy percentage
- Auto-classification rate
- Policies with improving trends

**Per-Policy Stats:**
- Accuracy rate (7-day, 30-day, all-time)
- Decision breakdown (auto, prompted, manual, corrections)
- Trend indicators (up improving, down declining, stable)
- Click to view detailed breakdown

**Live Activity Feed:**
- Recent classification decisions
- Newly discovered patterns
- Generated tuning suggestions
- Real-time updates every 30 seconds

**Alerts:**
- Declining accuracy warnings
- Pending tuning suggestions
- High correction rates

### Tuning Suggestions

The system analyzes your feedback and suggests improvements:

Access via **Settings** -> **Tuning**

**Suggestion Types:**
1. **Adjust Weight** - "Increase pattern weight by 10%"
2. **Add Preset** - "Add 'horror_comedy' preset"
3. **Remove Preset** - "Remove 'family_friendly' (low accuracy)"
4. **Adjust Threshold** - "Lower auto-classify to 80%"
5. **Create Pattern** - "Add studio pattern: A24 -> Indie"
6. **Modify Signal** - "Exclude Horror genre from preset"

**For Each Suggestion:**
- Confidence level (high/medium/low)
- Impact estimate ("May improve accuracy by 12%")
- Supporting evidence (which feedback led to this)
- Before/after accuracy comparison
- Apply or reject with one click

**Example Flow:**
1. System notices `family_friendly` preset has 55% accuracy on your "Kids Movies" policy
2. Generates suggestion: "Remove family_friendly preset (underperforming)"
3. You review: Supporting evidence shows it's matching teen content
4. You apply suggestion
5. Accuracy improves from 78% -> 85%
6. System tracks improvement in stats

### Pattern Discovery

Patterns are automatically discovered from your decisions:

**When you classify items:**
- System tracks studios, keywords, genres, collections
- Identifies recurring associations (e.g., "Warner Bros -> Action Movies" appears 10 times)
- Calculates confidence based on consistency
- Auto-approves patterns above 85% confidence
- Prompts you to review patterns 60-84% confidence

**Managing Patterns (v0.37.0+):**
- Manual pattern management via **Settings** -> **Patterns** is **deprecated** and will be removed in a future release
- Use the **Visual Policy Builder** to control how discovered patterns influence classification (via presets and weighting)
- Patterns continue to automatically integrate into policy scoring, and low-performing patterns (<30%) are auto-deprecated by the system

## Migration from v0.36.x

If you're upgrading from v0.36.x, see the comprehensive migration guide:

**[Migration Guide: v0.36.x -> v0.37.0](docs/migration/v037.md)**

### Key Changes

1. **Legacy Rules Deprecated**
   - Use Migration Wizard to convert rules to policies
   - Timeline: v0.37 (tools available) -> v0.38 (warnings) -> v0.39 (removed)

2. **Event Detection Deprecated**
   - Replaced by seasonal/genre presets
   - `christmas_holiday`, `halloween`, `sports_doc`, etc.
   - Timeline: v0.37 (tools available) -> v0.38 (warnings) -> v0.39 (removed)

3. **New Policy System**
   - Default policies auto-created for each library
   - 168 content presets available
   - Feedback learning enabled

### Migration Options

1. **Migration Wizard** - Interactive rule-by-rule migration
2. **Auto-Migrate** - Bulk migration with top suggestions
3. **Manual** - Create policies from scratch

## Clear & Re-sync

When you need a fresh start:

1. Go to **Settings** -> **Queue**
2. Click **Clear & Re-sync All**

This will:
- Clear all classification history
- Remove all custom rules
- Clear the task queue
- Resync libraries from your media server
- Re-queue all items for classification

## sT Settings Overview

### General
- Application settings and preferences
- Scheduler configuration
- Queue management

### Policies
- **Create/Edit Policies** - Visual policy builder
- **Content Presets** - Browse and select from 168 presets
- **Policy Statistics** - View accuracy and trends
- **Tuning Suggestions** - Review and apply AI-generated improvements

### Connections
- **Media Server** - Connect Plex (OAuth), Emby, or Jellyfin
- **Radarr** - Configure multiple instances, map libraries
- **Sonarr** - Configure multiple instances, map libraries

### Metadata
- **TMDB** - API key for metadata enrichment
- **OMDb** - Additional ratings and metadata
- **Tavily** - Web search for obscure content

### Classification
- **AI Provider** - OpenAI, Gemini, OpenRouter, or Ollama
- **RAG (Semantic Search)** - Enable/configure similarity matching
- **Confidence Thresholds** - Adjust auto-classify and prompt thresholds

### Notifications
- **Discord** - Bot integration for notifications and corrections
- **Webhooks** - Custom webhook endpoints

### System
- **Backup & Restore** - Database backup management
- **SSL/HTTPS** - Configure secure connections
- **Error Logs** - View system errors and warnings

### AI Providers

Classifarr supports multiple AI providers for validation and edge cases. Configure in **Settings** -> **AI**.

> **Note:** With the Policy Engine, AI is used primarily for validation (60-90% confidence scores) and edge cases. Most classifications (>=85%) are handled by the formula, reducing AI costs by 60-85%.

#### Provider Options

| Provider | Type | Cost | Best For |
|----------|------|------|----------|
| **Ollama** | Local | Free | Privacy, no API costs, full control |
| **OpenAI** | Cloud | $$ | Highest accuracy, GPT-4o/o3 models |
| **Google Gemini** | Cloud | $ | Great value, fast, multimodal |
| **OpenRouter** | Cloud | Varies | Access 100+ models, flexibility |

#### Budget Controls

For cloud providers, set monthly spending limits:
- **Monthly Budget** - Set max spend (e.g., $5/month)
- **Alert Threshold** - Notify at 80% usage
- **Pause on Exhausted** - Auto-stop or fallback to formula-only

---

### Recommended Models by Use Case

#### Local (Ollama) - Best by VRAM

| VRAM | Model | Speed | Accuracy | Notes |
|------|-------|-------|----------|-------|
| **4GB** | `phi3:3.8b` | Fastest | Good | Best for low-end GPUs |
| **6GB** | `mistral:7b` | Very Fast | Good | Popular, well-tested |
| **8GB** | `llama3.3:8b` | Very Fast | High | **Recommended** - latest Llama on Ollama |
| **8GB** | `qwen2.5:7b` | Very Fast | High | Strong multilingual, STEM tasks, 128k context |
| **12GB** | `qwen2.5:14b` | Fast | Very High | Excellent reasoning, 128k context |
| **16GB** | `deepseek-r1:14b` | Fast | Very High | Advanced reasoning, distilled from 671B |
| **24GB+** | `qwen2.5:32b` | Medium | Highest | Top open source performance |
| **48GB+** | `llama3.3:70b` | Slower | Highest | Near GPT-4 quality, large context |

> **Tip:** With the Policy Engine, smaller models work great since they're only validating formula decisions. `llama3.3:8b` or `qwen2.5:7b` are excellent choices.
> **Note:** At the time of writing, `llama3.3` is the latest Llama model available on Ollama. For the most current Llama releases and Ollama availability, refer to the official Ollama model catalog.

---

#### OpenAI - Premium Accuracy

| Model | Cost (per 1M tokens) | Speed | Best For |
|-------|---------------------|-------|----------|
| `gpt-5-mini` | $0.25 in / $2.00 out | Fastest | **Best Value** - cost-effective GPT-5 |
| `gpt-5-nano` | $0.05 in / $0.40 out | s Ultra Fast | Ultra low-cost, high-volume tasks |
| `gpt-5` | $1.25 in / $10.00 out | Fast | Standard GPT-5, excellent quality |
| `gpt-5.1` | $1.25 in / $10.00 out | Fast | Enhanced GPT-5, improved reasoning |
| `gpt-5.2` | $1.75 in / $14.00 out | Fast | **Latest** (Dec 2025) - best accuracy, 400K context |
| `gpt-5.2-pro` | $21.00 in / $168.00 out | Medium | Maximum reasoning, research, advanced coding |

> **OpenAI Recommendation:** Start with `gpt-5-mini` for most tasks. Use `gpt-5.2` for complex edge cases.
> **Note:** GPT-5.2 released December 11, 2025. All GPT-5 models support 400K token context windows.

---

#### Google Gemini - Best Value

| Model | Cost (per 1M tokens) | Speed | Best For |
|-------|---------------------|-------|----------|
| `gemini-3-flash` | $0.10 in / $0.40 out | Fastest | **Latest** (Dec 2025) - 3x faster, best value |
| `gemini-3-pro` | $1.25 in / $5.00 out | Fast | Latest flagship, advanced reasoning |
| `gemini-1.5-flash` | $0.075 in / $0.30 out | Fast | Stable, 1M token context |
| `gemini-1.5-pro` | $1.25 in / $5.00 out | Fast | 2M token context, complex analysis |

> **Gemini Recommendation:** `gemini-3-flash` for best performance/cost ratio.
> **Note:** Gemini 3 series released December 2025 as Google's latest flagship models.

---

#### Anthropic Claude - Best for Safety

| Model | Cost (per 1M tokens) | Speed | Best For |
|-------|---------------------|-------|----------|
| `claude-haiku-4.5` | $0.80 in / $4.00 out | Very Fast | **Best Value** - fastest Claude, high-throughput |
| `claude-sonnet-4.5` | $3.00 in / $15.00 out | Fast | **Recommended** - balanced speed/accuracy |
| `claude-opus-4.5` | $15.00 in / $75.00 out | Medium | Maximum intelligence, complex reasoning |

> **Claude Recommendation:** `claude-sonnet-4.5` for balanced performance. All models support 200K context.
> **Note:** Claude 4.5 series is current as of Jan 2026 and supersedes the Claude 3 series; check Anthropic's latest documentation for up-to-date model availability.

---

#### OpenRouter - Access Any Model

OpenRouter provides unified access to 200+ models. Best picks for classification:

| Model | Cost (per 1M tokens) | Speed | Best For |
|-------|---------------------|-------|----------|
| `meta-llama/llama-4-maverick:free` | FREE | Fast | **Best Free Option** - MoE, 1M context |
| `google/gemini-3-flash:free` | FREE (limited) | Fastest | Free Gemini 3 latest |
| `openai/gpt-5-mini` | $0.25 in / $2.00 out | Fast | Latest GPT, cost-effective |
| `google/gemini-3-flash` | $0.10 in / $0.40 out | Fastest | Latest Gemini, best value |
| `anthropic/claude-sonnet-4.5` | $3.00 in / $15.00 out | Fast | Latest Claude, premium quality |
| `openai/gpt-5.2` | $1.75 in / $14.00 out | Fast | Latest GPT flagship |
| `qwen/qwen-2.5-72b-instruct` | $0.35 in / $0.40 out | Fast | Strong multilingual |
| `deepseek/deepseek-r1` | $0.55 in / $2.19 out | Medium | Advanced reasoning, low cost |

> **OpenRouter Recommendation:** Start with free `llama-4-maverick:free` or `gemini-3-flash:free` for testing.
> **Note:** OpenRouter provides access to Llama 4 models (not yet available on Ollama), and the `:free` suffix indicates OpenRouter's free tier which may have rate limits.

---

#### Quick Decision Guide

| Your Situation | Recommended Setup |
|----------------|-------------------|
| **No budget / Privacy-focused** | Ollama with `llama3.3:8b` or `qwen2.5:7b` |
| **Free tier / Testing** | OpenRouter `llama-4-maverick:free` or `gemini-3-flash:free` |
| **$1-10/month** | Gemini `gemini-3-flash` or OpenAI `gpt-5-mini` |
| **$10-30/month** | OpenAI `gpt-5.2` or Anthropic `claude-sonnet-4.5` |
| **Best accuracy regardless of cost** | OpenAI `gpt-5.2-pro` or Anthropic `claude-opus-4.5` |
| **Want to try different providers** | OpenRouter with budget controls |

> **Ollama Fallback:** Enable Ollama as a fallback for basic tasks or when cloud budget is exhausted.

---

### Semantic Search (RAG)

RAG (Retrieval-Augmented Generation) is Classifarr's learning system that uses your classification history to improve future decisions. Instead of treating each new request in isolation, Classifarr remembers how you classified similar content and uses that knowledge to make better decisions.

#### Why RAG for Media Classification?

Traditional rule-based systems struggle with edge cases. RAG solves this by learning from your preferences:

- **Franchise Consistency**: Classified "Harry Potter and the Sorcerer's Stone" to your Kids library? RAG remembers this and suggests the same library for subsequent Harry Potter films.
- **Studio Patterns**: If you route all Pixar films to a specific library, RAG learns this pattern and applies it to new Pixar releases.
- **Genre Nuances**: A horror-comedy like "Shaun of the Dead" might not fit neatly into rules, but if you've classified similar films before, RAG uses that context.
- **Personal Preferences**: Your library organization is unique. RAG learns YOUR preferences, not generic rules.

#### How RAG Works in Classifarr

```
New Request: "Encanto (2021)"
  1. Generate embedding vector (title, genres, studio)
  2. Search classification history (pgvector similarity)
     Similar items: "Moana" -> Family (92%), "Coco" -> Family (89%), "Frozen" -> Family (87%)
  3. Inject context into AI prompt ("Similar items went to Family")
  4. AI makes informed decision -> Routes to Family library (90% confidence)
```

#### Classification Flow Integration

RAG integrates into the signal-based classification chain:

1. **Exact Match (100%)**: Previously classified TMDB ID or learned correction
2. **Pattern Match (90%)**: Title rules, genre patterns
3. **Franchise Match (85%)**: Other items from same collection
4. **RAG Similarity (50-90%)**: Similar past classifications (NEW)
5. **AI Analysis**: Falls back to AI with RAG context injected

RAG confidence dynamically adjusts based on match quality:
- **3+ unanimous matches with 90%+ similarity** -> 90% confidence
- **2+ unanimous matches with 80%+ similarity** -> 80% confidence  
- **Any match above 70% similarity** -> 70% confidence

#### Setup

1. Go to **Settings** -> **AI** -> **Semantic Search (RAG)**
2. Enable RAG
3. Choose your **Embedding Provider** (Ollama recommended - free!)
4. Select an embedding model from the dropdown
5. Save and wait for 50+ embeddings to be generated

> **Tip:** Use Ollama for embeddings even if you use a cloud provider for classification - it's free and runs locally!

#### Ollama Embedding Models

| Model | Dims | Size | Best For |
|-------|------|------|----------|
| `nomic-embed-text`  | 768 | 274MB | **Recommended** - High-quality, 8192 token context, open source |
| `mxbai-embed-large`  | 1024 | 670MB | State-of-the-art retrieval performance |
| `snowflake-arctic-embed2` | 1024 | 1.1GB | Latest Snowflake model, multilingual |
| `bge-m3` | 1024 | 1.1GB | Multi-lingual, multi-granularity embeddings |
| `all-minilm` | 384 | 46MB | **Fastest** - Low resource usage, good quality |

To install an Ollama embedding model:
```bash
ollama pull nomic-embed-text
# or
ollama pull mxbai-embed-large
```

#### Cloud Embedding Models

**OpenAI:**
| Model | Dims | Cost (per 1M tokens) | Notes |
|-------|------|---------------------|-------|
| `text-embedding-3-small`  | 1536 | $0.02 | **Best value** - excellent quality |
| `text-embedding-3-large` | 3072 | $0.13 | Highest quality, top leaderboard performance |

**Voyage AI:**
| Model | Dims | Cost (per 1M tokens) | Notes |
|-------|------|---------------------|-------|
| `voyage-3` | 1024 | $0.06 | Cutting-edge retrieval, often tops leaderboards |
| `voyage-3-lite` | 512 | $0.02 | Fast, cost-effective |

**Google Gemini:**
| Model | Dims | Cost | Notes |
|-------|------|------|-------|
| `text-embedding-004` | 768 | FREE (limited) | Latest Gemini embedding, excellent quality |

**Cohere:**
| Model | Dims | Cost (per 1M tokens) | Notes |
|-------|------|---------------------|-------|
| `embed-v3-multilingual` | 1024 | $0.10 | Excellent multilingual support |

> **Recommendation:** Use `nomic-embed-text` with Ollama (free, self-hosted) or `text-embedding-3-small` with OpenAI for best results.

#### Image Embeddings (Optional)

Classifarr can also generate **image embeddings** (posters/cover art) to improve semantic matching for visually similar titles. If you want to enable this, run the companion image embedding service and configure it in **Settings -> RAG & Embeddings -> Image Embeddings**.

- **Service repo:** [classifarr-image-embedding-service](https://github.com/cloudbyday90/classifarr-image-embedding-service)
- Includes Docker setup, model list, and API docs for `/health`, `/models`, and `/embed-image`.

#### Backfilling

When you enable RAG, existing classification history can be backfilled to seed the system:
- Backfill runs in the background when enabled
- You can monitor progress in the RAG status section
- Once 50+ embeddings exist, RAG activates automatically

#### Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| Similarity Threshold | 70% | Minimum match similarity to consider |
| Min History Count | 50 | Classifications needed before RAG activates |
| Backfill Budget | 25% | Daily budget allocation for embedding existing items |

### TMDB
- Enter API key for metadata enrichment
- Powers genre, rating, and keyword information

### OMDb
- API key for enhanced metadata
- Provides IMDb ratings, Rotten Tomatoes scores, awards, and box office data
- Get a free key at [omdbapi.com](https://www.omdbapi.com/apikey.aspx)

### Discord
- Bot token and channel configuration
- Notification preferences

## Documentation

### User Guides
- [Migration Guide - v0.41.0-alpha](docs/migration/v0.41.0-alpha.md) - Upgrade instructions and breaking changes
- [Migration Guide - v0.37.0](docs/migration/v037.md) - Upgrade from v0.36.x to v0.37.0
- [Release Notes](RELEASE_NOTES.md) - What's new in each release
- [Roadmap](docs/roadmap.md) - Planned features and priorities
- [CHANGELOG](CHANGELOG.md) - Detailed change history

### API Documentation
- [API Overview](docs/api/README.md) - Complete API reference
- [Authentication](docs/api/authentication.md) - JWT tokens and API keys
- [Libraries](docs/api/libraries.md) - Library management
- [Media Sync](docs/api/media-sync.md) - Sync operations
- [System Health](docs/api/system.md) - Health monitoring
- [Classification](docs/api/classification.md) - Classification operations
- [Webhooks](docs/api/webhooks.md) - Webhook integration
- [Error Handling](docs/api/errors.md) - Error codes and responses
- [Examples](docs/api/examples/) - cURL, JavaScript, Python examples

### Policy Engine (v0.37.0+)
- [Policy Engine Architecture](docs/architecture/policy-engine.md) - How the Policy Engine works
- [Content Presets Reference](docs/presets/README.md) - All 168 presets explained
- [Policy Builder](#-policy-builder) - Visual policy configuration
- [Policy Statistics & Tuning](#-policy-statistics--tuning) - AI-generated improvements

### Setup & Configuration
- [Plex Setup](PLEX_SETUP.md) - Connect Plex media server
- [Discord Bot Setup](DISCORD_SETUP.md) - Configure Discord notifications
- [Authentication](AUTHENTICATION.md) - User management
- [UnRaid Guide](unraid/README.md) - UnRaid deployment

### Development
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Testing Guide](docs/testing/coverage.md) - Running tests and coverage
- [Database Migration System](docs/MIGRATION_SYSTEM.md) - How migrations work (v0.41+)
- [Database Migrations](docs/migrations.md) - Schema management

### Key Concepts

| Topic | Description | Link |
|-------|-------------|------|
| **Policies** | Library classification rules using presets | [Policy Builder](#-policy-builder) |
| **Presets** | 168 pre-built content definitions | [Presets Reference](docs/presets/README.md) |
| **Patterns** | Auto-discovered from user feedback | [Architecture](docs/architecture/policy-engine.md#pattern-scoring) |
| **RAG** | Semantic similarity matching | [Architecture](docs/architecture/policy-engine.md#rag-scoring) |
| **Tuning** | AI-generated policy improvements | [Tuning Dashboard](#-policy-statistics--tuning) |
| **Health Monitoring** | Real-time service health tracking | [System Health](#-system-health-monitoring) |

## Discord Bot

Real-time notifications with interactive buttons:

- **o" Correct** - Confirm classification
- **Alt Library** - Quick correction
- **Library Dropdown** - Select any library

Corrections feed into the learning system for improved future accuracy.

## API Documentation

Full interactive API documentation available at: `http://localhost:21324/api/docs` (Swagger UI)

### Core API Documentation

**Authentication & Security:**
- [API Authentication](docs/api/authentication.md) - JWT tokens, API keys, permissions
- [System Health API](docs/api/system-health.md) - Service monitoring, health checks, trends

**Data Management:**
- [Libraries API](docs/api/libraries.md) - Library management and configuration
- [Media Sync API](docs/api/media-sync.md) - Media server synchronization
- [Policies API](docs/api/policies.md) - Policy creation and management
- [Classification API](docs/api/classification.md) - Classification requests and results

**Integration:**
- [Webhooks API](docs/api/webhooks.md) - Webhook endpoints for Overseerr/Jellyseerr
- [Error Handling](docs/api/errors.md) - Error codes, formats, and troubleshooting
- [Code Examples](docs/api/examples.md) - Complete integration examples

### Quick Reference

**v0.37.0+ Policy Engine Endpoints:**

**Policies:**
- `GET /api/policies` - List all policies
- `GET /api/policies/:id` - Get policy with presets
- `POST /api/policies` - Create new policy
- `PUT /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy

**Presets:**
- `GET /api/presets` - List all 168 content presets
- `GET /api/presets/categories` - Get preset categories
- `GET /api/policies/:id/presets` - Get policy's presets

**Tuning & Suggestions:**
- `POST /api/suggestions/:id/apply` - Apply suggestion
- `POST /api/suggestions/:id/reject` - Reject suggestion
- `GET /api/suggestions/:id/impact` - Get impact metrics

**Statistics:**
- `GET /api/stats/overview` - Global statistics
- `GET /api/stats/policies` - All policy stats
- `GET /api/stats/policies/:id` - Specific policy stats
- `GET /api/stats/live-feed` - Real-time activity feed
- `GET /api/stats/alerts` - Abnormal metrics alerts

**Health Monitoring (v0.41.0+):**
- `GET /api/health` - Overall system health
- `GET /api/health/services` - Detailed service health with trends
- `GET /api/health/history` - Historical health data

**Core Endpoints:**
- `POST /api/webhook/overseerr` - Receive Overseerr webhooks
- `GET /api/libraries` - List libraries
- `POST /api/queue/clear-and-resync` - Reset and resync
- `POST /api/media-server/sync` - Sync from media server

**See full API reference:** [docs/api/README.md](docs/api/README.md)

## Deployment

### Pre-built Images

```bash
# GitHub Container Registry
docker pull ghcr.io/cloudbyday90/classifarr:latest

# Docker Hub
docker pull cloudbyday90/classifarr:latest
```

### Supported Platforms
- **linux/amd64** - UnRaid, Synology x86, Linux servers, Windows (Docker Desktop)
- **linux/arm64** - Raspberry Pi 4+, Apple Silicon, Synology ARM
- **linux/arm/v7** - Older ARM devices

See deployment guides:
- [UnRaid Guide](unraid/README.md)
- [Plex Setup](PLEX_SETUP.md)
- [Discord Bot Setup](DISCORD_SETUP.md)
- [Authentication](AUTHENTICATION.md)



## Troubleshooting

### Health Monitoring Issues

1. **Services showing as "unknown"**
   - Check that services are configured in Settings
   - Verify network connectivity to external services
   - Review logs for connection errors

2. **Incorrect health status**
   - Click **Refresh** to force an immediate health check
   - Check service configuration for typos in URLs or API keys
   - Verify firewall rules allow outbound connections

3. **Health dashboard not loading**
   - Check browser console for errors
   - Verify API authentication is working
   - Clear browser cache and reload

### Error 404 - Resource Not Found

If you receive a 404 error with a structured response like:
```json
{
  "error": "Library not found",
  "code": "LIBRARY_NOT_FOUND",
  "details": { "libraryId": 999 }
}
```

**Common causes:**
- Resource was deleted or never existed
- Incorrect ID in the URL or request
- Database was cleared or reset

**Solutions:**
- Verify the resource ID is correct
- Check the resource still exists via the UI
- Review recent changes that may have affected the resource

### Classification Issues
1. Check **Settings** -> **Queue** for pending items
2. Verify TMDB API key in settings
3. Check container logs: `docker logs classifarr`
4. Use **Clear & Re-sync** for fresh start

### Media Server Not Syncing
1. Test connection in **Settings** -> **Media Server**
2. Click **Sync Libraries** to manually refresh
3. Check that libraries are accessible

### Sync Issues

**Error 409 - Sync Already in Progress:**
```json
{
  "error": "Sync operation already in progress",
  "code": "SYNC_IN_PROGRESS"
}
```

**Cause:** Another sync operation is currently running. Classifarr prevents concurrent syncs to avoid race conditions and data corruption.

**Solutions:**
- Wait for the current sync to complete (check logs or UI)
- If a sync appears stuck, restart the container to clear the lock
- Use the health monitoring dashboard to check sync service status

### AI Not Working
1. Go to **Settings** -> **AI** and test connection
2. **For Ollama:** 
   - Enter your Ollama host (IP address or container name)
   - Default is `localhost` - change if Ollama runs on a different machine
   - Use **Test Connection** to verify before saving
   - Verify Ollama is running: `curl http://your-ollama-host:11434/api/tags`
3. **For Cloud Providers:** Check API key is valid and has credits
4. Check budget hasn't been exhausted (see Usage Statistics)
5. View container logs: `docker logs classifarr | grep -i ai`

### PostgreSQL Version Mismatch

If you see an error about PostgreSQL version mismatch on startup:

```
ERROR: PostgreSQL version mismatch detected!
Data directory version: 18
Installed PostgreSQL:   17
```

**Cause:** Your data directory was created with a different PostgreSQL version.

**Solutions:**
1. **Use compatible image** - Switch to a Classifarr image with the matching PostgreSQL version
2. **Backup and migrate** - Export data from old version, initialize new database, restore data
3. **Start fresh** - Remove data directory if you don't need to preserve data

See [PostgreSQL Version Guide](docs/POSTGRESQL.md) for detailed migration instructions.

### PostgreSQL Recovery Mode (v0.40.5-alpha)

If you upgraded from **v0.40.5-alpha** and see logs like `the database system is in recovery mode`, update to the hotfix image (non-AVX pgvector auto-selection) and run a one-time PostgreSQL restart inside the container:

```bash
docker exec -it classifarr sh -lc "su-exec classifarr pg_ctl -D /app/data/postgres -m fast stop && su-exec classifarr pg_ctl -D /app/data/postgres -l /app/data/postgres.log start"
```

If your container name is different (e.g., `Classifarr` on Unraid), replace `classifarr` with your container name.

### Container Won't Start

1. Check logs: `docker logs classifarr`
2. Verify permissions on data directory
3. Ensure PostgreSQL version compatibility (see above)
4. Check disk space: `df -h`

### Logs Not Appearing

Classifarr writes logs to multiple locations:
- **Console/Docker logs**: `docker logs classifarr`
- **File logs**: `/app/data/logs/classifarr.log` and `/app/data/logs/error.log`
- **Database**: Errors and warnings are also stored in the error_log table

File logging can be disabled by setting `FILE_LOGGING_ENABLED=false`.

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/NewFeature`
3. Commit changes: `git commit -m 'Add NewFeature'`
4. Push: `git push origin feature/NewFeature`
5. Open Pull Request

## License

Classifarr is licensed under GPL-3.0. See [LICENSE](LICENSE) for details.

### Copyright Compliance

All source files must include current copyright headers. To check compliance:

```bash
npm run check-copyright
```

To update copyright years (run annually on January 1st):

```bash
npm run update-copyright
```

## Links

- [GitHub Repository](https://github.com/cloudbyday90/Classifarr)
- [GitHub Container Registry](https://github.com/cloudbyday90/Classifarr/pkgs/container/classifarr)
- [Docker Hub](https://hub.docker.com/r/cloudbyday90/classifarr)
- [Release Notes](RELEASE_NOTES.md)
- [Issue Tracker](https://github.com/cloudbyday90/Classifarr/issues)

---

Made with care for the *arr community.


