# Classifarr

**AI-Powered Media Classification for the *arr Ecosystem**

Classifarr is an intelligent media classification platform that automatically routes incoming requests from Overseerr/Jellyseerr/Seer to the correct Radarr/Sonarr library. It leverages your existing Plex/Emby/Jellyfin library structure combined with AI content analysis to make accurate classification decisions. Everything runs in a single self-contained Docker container with embedded PostgreSQL.

![License](https://img.shields.io/github/license/cloudbyday90/Classifarr)
![Version](https://img.shields.io/badge/version-0.30.0--alpha-blue)
![Docker Pulls](https://img.shields.io/docker/pulls/cloudbyday90/classifarr)

## ✨ Features

- **🔐 Secure Authentication System** - JWT-based login with first-run setup wizard
- **🎭 Multi-Server Support** - Plex, Emby, and Jellyfin with OAuth flows
- 🤖 Multi-Provider AI - OpenAI, Gemini, OpenRouter, Ollama with budget controls
- 📚 Smart Rule Builder - Create classification rules with AI-suggested conditions
- 🗄️ Embedded PostgreSQL - All data in a single volume, auto-initialized
- 💬 Discord Bot - Real-time notifications with correction buttons
- 🔄 Learning System - Improves from user corrections over time
- 📊 Dashboard & Statistics - Track classifications and system performance
- 🔗 Webhook Integration - Automatic processing of Overseerr requests
- 🔧 Library Mapping - Map Plex libraries to *arr root folders for re-classification
- 🐳 Single Container - Just `docker compose up -d`

## 🏗️ Architecture

```
┌─────────────┐
│  Overseerr  │
│   /Seer     │
└──────┬──────┘
       │ Webhook
       ▼
┌─────────────────────────────────────────┐
│     CLASSIFARR (Single Container)       │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Classification Engine           │ │
│  │   ┌─────────────────────────────┐ │ │
│  │   │ 1. Source Library (100%)   │ │ │
│  │   │ 2. Learned Corrections (100%) │ │ │
│  │   │ 3. Holiday Detection (95%) │ │ │
│  │   │ 4. Custom Rules (90%)      │ │ │
│  │   │ 5. AI Analysis (Cloud/Ollama) │ │ │
│  │   │ 6. Learned Patterns (80%)  │ │ │
│  │   └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Media Server Sync               │ │
│  │   • Plex / Emby / Jellyfin        │ │
│  │   • Library Association           │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Embedded PostgreSQL             │ │
│  │   • Libraries & Rules             │ │
│  │   • Classification History        │ │
│  │   • Learning Patterns             │ │
│  └───────────────────────────────────┘ │
└─────────────┬───────────────────────────┘
              │ Routes to
       ┌──────┴──────┐
       ▼             ▼
┌───────────┐  ┌───────────┐
│  Radarr   │  │  Sonarr   │
└───────────┘  └───────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- TMDB API Key ([Get one here](https://www.themoviedb.org/settings/api))
- OMDb API Key ([Get one here](https://www.omdbapi.com/apikey.aspx)) - enhances metadata
- Plex/Emby/Jellyfin media server
- Ollama instance OR cloud AI API key (OpenAI, Gemini, OpenRouter)
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
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUID` | User ID for file permissions | `1000` |
| `PGID` | Group ID for file permissions | `1000` |
| `TZ` | Timezone (e.g., `America/New_York`) | `UTC` |
| `UMASK` | File permission mask | `022` |

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

## 🎯 How Classification Works

Classifarr uses a multi-step decision tree with confidence scoring:

### Step 1: Source Library Check (100% Confidence)
If the item is already in one of your media server libraries, Classifarr trusts that organization completely.

### Step 2: Holiday Detection (95% Confidence)
Automatic detection of Christmas, Halloween, and other holiday content based on titles and metadata.

### Step 3: Custom Rules (90% Confidence)
User-defined rules created via the Smart Rule Builder match based on genre, rating, language, keywords, and more.

### Step 4: AI Content Analysis
If confidence is below threshold, your configured AI provider analyzes the content:
- Metadata review (plot, genres, ratings)
- Content type detection
- Library recommendation with reasoning

**Supported Providers:** OpenAI (GPT-4o/5), Google Gemini, OpenRouter (100+ models), Ollama (local).

### Step 5: Learned Patterns (80% Confidence)
Patterns extracted from user corrections improve future classifications.

## 📚 Smart Rule Builder

Create classification rules through an intuitive interface:

1. Go to **Libraries** → Select a library
2. Click **Smart Rule Builder**
3. Choose conditions:
   - **Genre** - includes/excludes (Comedy, Drama, etc.)
   - **Rating** - certification matching (G, PG, R, etc.)
   - **Language** - original language filter
   - **Keywords** - title/overview matching
   - **Content Type** - AI-detected type (anime, documentary, etc.)
4. Preview matching items
5. Save the rule

**AI Suggestions:** Click "Get Smart Suggestions" to have your AI provider analyze your library and suggest rules based on content patterns.

## 🔄 Clear & Re-sync

When you need a fresh start:

1. Go to **Settings** → **Queue**
2. Click **Clear & Re-sync All**

This will:
- Clear all classification history
- Remove all custom rules
- Clear the task queue
- Resync libraries from your media server
- Re-queue all items for classification

## ⚙️ Settings Overview

### Media Server
- Connect to Plex (OAuth), Emby, or Jellyfin
- **Sync Libraries** button to refresh content from media server

### Radarr & Sonarr
- Configure multiple instances
- Map libraries to specific Radarr/Sonarr servers
- Set root folders and quality profiles

### AI Providers

Classifarr supports multiple AI providers for content classification. Configure in **Settings** → **AI**.

#### Provider Options

| Provider | Type | Cost | Best For |
|----------|------|------|----------|
| **Ollama** | Local | Free | Privacy, no API costs, full control |
| **OpenAI** | Cloud | $$ | Highest accuracy, GPT-5/o3 models |
| **Google Gemini** | Cloud | $ | Great value, fast, multimodal |
| **OpenRouter** | Cloud | Varies | Access 100+ models, flexibility |
| **LiteLLM** | Self-hosted | Proxy | Enterprise, custom routing |

#### Budget Controls

For cloud providers, set monthly spending limits:
- **Monthly Budget** - Set max spend (e.g., $5/month)
- **Alert Threshold** - Notify at 80% usage
- **Pause on Exhausted** - Auto-stop or fallback to Ollama

---

### 🏆 Recommended Models by Use Case

#### Local (Ollama) - Best by VRAM

| VRAM | Model | Speed | Accuracy | Notes |
|------|-------|-------|----------|-------|
| **4GB** | `phi3:3.8b` | ⚡ Fastest | Good | Best for low-end GPUs |
| **6GB** | `mistral:7b` | ⚡ Very Fast | Good | Popular, well-tested |
| **8GB** | `qwen3:8b` | ⚡ Very Fast | High | **Recommended** - strong multilingual |
| **8GB** | `llama3.2:8b` | ⚡ Very Fast | High | Meta's latest efficient model |
| **12GB** | `qwen3:14b` | Fast | Very High | Excellent reasoning |
| **16GB** | `deepseek-r1:14b` | Fast | Very High | Strong complex reasoning |
| **24GB+** | `llama3.3:70b` | Medium | Highest | Most capable open model |

> **Tip:** For media classification, `qwen3:8b` or `qwen3:14b` offer the best accuracy-to-speed ratio.

---

#### OpenAI - Best for Accuracy

| Model | Cost (per 1M tokens) | Speed | Best For |
|-------|---------------------|-------|----------|
| `gpt-4o-mini` | $0.60 in / $2.40 out | ⚡ Fast | **Best Value** - 90% of GPT-4o quality at 1/10th cost |
| `gpt-4o` | $5.00 in / $15.00 out | Fast | Premium tasks, complex classification |
| `o3-mini` | $1.10 in / $4.40 out | Fast | Advanced reasoning, nuanced decisions |
| `gpt-5.2` | $1.75 in / $14.00 out | Medium | **Most Accurate** - cutting-edge performance |
| `gpt-5-mini` | $0.25 in / $2.00 out | ⚡ Fast | Budget option with GPT-5 quality |

> **OpenAI Recommendation:** Start with `gpt-4o-mini` - it handles 95% of classification tasks accurately at minimal cost.

---

#### Google Gemini - Best Value

| Model | Cost (per 1M tokens) | Speed | Best For |
|-------|---------------------|-------|----------|
| `gemini-2.5-flash-lite` | $0.10 in / $0.40 out | ⚡ Fastest | **Budget Pick** - high volume, low cost |
| `gemini-2.0-flash` | $0.10 in / $0.40 out | ⚡ Very Fast | Fast processing, good accuracy |
| `gemini-2.5-flash` | $0.30 in / $2.50 out | Fast | Balanced speed and reasoning |
| `gemini-2.5-pro` | $1.25 in / $10.00 out | Fast | Complex analysis, 1M token context |
| `gemini-3-flash` | $0.50 in / $3.00 out | ⚡ Fast | Latest model, strong all-around |

> **Gemini Recommendation:** `gemini-2.5-flash-lite` for budget, `gemini-2.0-flash` for best value balance.

---

#### OpenRouter - Access Any Model

OpenRouter provides unified access to 100+ models. Best picks for classification:

| Model | Cost (per 1M tokens) | Speed | Best For |
|-------|---------------------|-------|----------|
| `meta-llama/llama-3.3-70b-instruct` | $0.10 in / $0.32 out | Fast | **Best Free-tier** - near GPT-4 quality |
| `anthropic/claude-sonnet-4` | $3.00 in / $15.00 out | Fast | Nuanced understanding, safety-focused |
| `google/gemini-2.0-flash` | $0.10 in / $0.40 out | ⚡ Fast | Same as direct Gemini |
| `openai/gpt-4o-mini` | $0.60 in / $2.40 out | ⚡ Fast | Same as direct OpenAI |
| `qwen/qwen-2.5-72b-instruct` | $0.20 in / $0.30 out | Fast | Strong multilingual, low cost |

> **OpenRouter Recommendation:** Great for testing different models before committing. Try `llama-3.3-70b` free tier.

---

#### Quick Decision Guide

| Your Situation | Recommended Setup |
|----------------|-------------------|
| **No budget / Privacy-focused** | Ollama with `qwen3:8b` or `llama3.2:8b` |
| **$1-5/month** | Gemini `gemini-2.5-flash-lite` or OpenAI `gpt-4o-mini` |
| **$5-20/month** | OpenAI `gpt-4o` or Gemini `gemini-2.0-flash` |
| **Best accuracy regardless of cost** | OpenAI `gpt-5.2` or `o3-mini` |
| **Want to try different providers** | OpenRouter with budget controls |

> **Ollama Fallback:** Enable Ollama as a fallback for basic tasks or when cloud budget is exhausted.

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


## 🎮 Discord Bot

Real-time notifications with interactive buttons:

- **✓ Correct** - Confirm classification
- **→ Alt Library** - Quick correction
- **Library Dropdown** - Select any library

Corrections feed into the learning system for improved future accuracy.

## 📊 API Documentation

Swagger docs available at: `http://localhost:21324/api/docs`

### Key Endpoints
- `POST /api/webhook/overseerr` - Receive webhooks
- `GET /api/libraries` - List libraries
- `POST /api/queue/clear-and-resync` - Reset and resync
- `POST /api/media-server/sync` - Sync from media server

## 🐳 Deployment

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



## 🐛 Troubleshooting

### Classification Issues
1. Check **Settings** → **Queue** for pending items
2. Verify TMDB API key in settings
3. Check container logs: `docker logs classifarr`
4. Use **Clear & Re-sync** for fresh start

### Media Server Not Syncing
1. Test connection in **Settings** → **Media Server**
2. Click **Sync Libraries** to manually refresh
3. Check that libraries are accessible

### AI Not Working
1. Go to **Settings** → **AI** and test connection
2. **For Ollama:** 
   - Enter your Ollama host (IP address or container name)
   - Default is `localhost` - change if Ollama runs on a different machine
   - Use **Test Connection** to verify before saving
   - Verify Ollama is running: `curl http://your-ollama-host:11434/api/tags`
3. **For Cloud Providers:** Check API key is valid and has credits
4. Check budget hasn't been exhausted (see Usage Statistics)
5. View container logs: `docker logs classifarr | grep -i ai`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/NewFeature`
3. Commit changes: `git commit -m 'Add NewFeature'`
4. Push: `git push origin feature/NewFeature`
5. Open Pull Request

## 📝 License

GNU General Public License v3.0 - see [LICENSE](LICENSE)

## 🔗 Links

- [GitHub Repository](https://github.com/cloudbyday90/Classifarr)
- [GitHub Container Registry](https://github.com/cloudbyday90/Classifarr/pkgs/container/classifarr)
- [Docker Hub](https://hub.docker.com/r/cloudbyday90/classifarr)
- [Release Notes](RELEASE_NOTES.md)
- [Issue Tracker](https://github.com/cloudbyday90/Classifarr/issues)

---

Made with ❤️ for the *arr community
