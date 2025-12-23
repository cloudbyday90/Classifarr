# Classifarr

**AI-Powered Media Classification for the *arr Ecosystem**

Classifarr is an intelligent media classification platform that automatically routes incoming requests from Overseerr/Jellyseerr/Seer to the correct Radarr/Sonarr library. It leverages your existing Plex/Emby/Jellyfin library structure combined with AI content analysis to make accurate classification decisions. Everything runs in a single self-contained Docker container with embedded PostgreSQL.

![License](https://img.shields.io/github/license/cloudbyday90/Classifarr)
![Version](https://img.shields.io/badge/version-0.21.3--alpha-blue)
![Docker Pulls](https://img.shields.io/docker/pulls/cloudbyday90/classifarr)

## ✨ Features

- **🔐 Secure Authentication System** - JWT-based login with first-run setup wizard
- **🎭 Multi-Server Support** - Plex, Emby, and Jellyfin with OAuth flows
- **🤖 AI-Powered Analysis** - Ollama integration for intelligent content classification
- **📚 Smart Rule Builder** - Create classification rules with AI-suggested conditions
- **🗄️ Embedded PostgreSQL** - All data in a single volume, auto-initialized
- **💬 Discord Bot** - Real-time notifications with correction buttons
- **🔄 Learning System** - Improves from user corrections over time
- **📊 Dashboard & Statistics** - Track classifications and system performance
- **🔗 Webhook Integration** - Automatic processing of Overseerr requests
- **🐳 Single Container** - Just `docker compose up -d`

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
│  │   │ 2. Holiday Detection (95%) │ │ │
│  │   │ 3. Custom Rules (90%)      │ │ │
│  │   │ 4. AI Analysis (Ollama)    │ │ │
│  │   │ 5. Learned Patterns (80%)  │ │ │
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
- Plex/Emby/Jellyfin media server
- Ollama instance (optional, for AI classification)
- Discord Bot Token (optional, for notifications)

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/cloudbyday90/Classifarr.git
cd Classifarr
```

2. **Start Classifarr:**

```bash
docker compose up -d
```

3. **Access the web interface:**

Open `http://localhost:21324` - first startup takes 30-60 seconds for database initialization.

### First-Time Setup

1. **Create Admin Account** - Set username, email, and secure password
2. **Connect Media Server** - Use OAuth (Plex) or manual configuration
3. **Configure TMDB** - Enter API key for metadata enrichment
4. **Configure Ollama** (optional) - For AI-powered content analysis
5. **Configure Discord** (optional) - For notifications and corrections

## 🎯 How Classification Works

Classifarr uses a multi-step decision tree with confidence scoring:

### Step 1: Source Library Check (100% Confidence)
If the item is already in one of your media server libraries, Classifarr trusts that organization completely.

### Step 2: Holiday Detection (95% Confidence)
Automatic detection of Christmas, Halloween, and other holiday content based on titles and metadata.

### Step 3: Custom Rules (90% Confidence)
User-defined rules created via the Smart Rule Builder match based on genre, rating, language, keywords, and more.

### Step 4: AI Content Analysis
If confidence is below threshold, Ollama analyzes the content:
- Metadata review (plot, genres, ratings)
- Content type detection
- Library recommendation with reasoning

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

**AI Suggestions:** Click "Get Smart Suggestions" to have Ollama analyze your library and suggest rules based on content patterns.

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

### Ollama AI
- Configure Ollama host and model
- Test connection and select models

### TMDB
- Enter API key for metadata enrichment
- Powers genre, rating, and keyword information

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

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Web server port | `21324` |
| `POSTGRES_PASSWORD` | Database password | `classifarr_secret` |
| `NODE_ENV` | Environment mode | `production` |
| `TZ` | Timezone | `UTC` |

Additional settings are configured through the web UI.

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
1. Verify Ollama is running: `curl http://ollama:11434/api/tags`
2. Test in **Settings** → **Ollama AI**
3. Ensure model is downloaded: `ollama list`

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
