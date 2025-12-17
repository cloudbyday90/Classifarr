# Classifarr

**AI-Powered Media Classification for the *arr Ecosystem**

Classifarr is an intelligent media classification platform that automatically routes incoming requests from Overseerr/Jellyseerr to the correct Radarr/Sonarr library using AI and machine learning. No external services required - everything runs in a single Docker container.

![License](https://img.shields.io/github/license/cloudbyday90/Classifarr)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

## ✨ Features

- **🤖 Built-in AI Classification Engine** - No external n8n or workflows required
- **🗄️ Internal PostgreSQL Database** - Auto-initialized with seed data
- **💬 Discord Bot Integration** - Real-time notifications and corrections
- **🎨 Modern Vue 3 Frontend** - Dark *arr-style theme
- **🔄 Smart Learning System** - Learns from corrections over time
- **📊 Comprehensive Dashboard** - Track classifications and performance
- **⚙️ Easy Configuration** - Simple setup through web UI
- **🐳 Single Command Deployment** - Just `docker compose up -d`

## 🏗️ Architecture

```
┌─────────────┐
│  Overseerr  │
│ /Jellyseerr │
└──────┬──────┘
       │ Webhook
       ▼
┌─────────────────────────────────────────┐
│            CLASSIFARR                   │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Classification Engine           │ │
│  │   ┌─────────────────────────────┐ │ │
│  │   │ 1. Exact Match Check        │ │ │
│  │   │ 2. Learned Pattern Check    │ │ │
│  │   │ 3. Rule-based Matching      │ │ │
│  │   │ 4. AI Fallback (Ollama)     │ │ │
│  │   └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   PostgreSQL Database             │ │
│  │   • Libraries & Labels            │ │
│  │   • Custom Rules                  │ │
│  │   • Classification History        │ │
│  │   • Learning Patterns             │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Discord Bot                     │ │
│  │   • Notifications                 │ │
│  │   • Correction Interface          │ │
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
- Discord Bot Token (Optional, [Create bot](https://discord.com/developers/applications))
- Ollama instance (Optional, for AI classification)

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/cloudbyday90/Classifarr.git
cd Classifarr
```

2. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and set your configuration:

```env
# TMDB API (Required)
TMDB_API_KEY=your_tmdb_api_key_here

# Discord Bot (Optional but recommended)
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here

# Ollama (Optional, defaults to host.docker.internal)
OLLAMA_HOST=host.docker.internal
OLLAMA_PORT=11434
OLLAMA_MODEL=qwen3:14b
```

3. **Start Classifarr:**

```bash
docker compose up -d
```

4. **Access the web interface:**

Open your browser to `http://localhost:21324`

## 📖 Configuration Guide

### 1. Configure Media Server

1. Go to **Settings** → **Media Server**
2. Select your media server type (Plex, Emby, or Jellyfin)
3. Enter server URL and API key
4. Click **Test Connection**
5. Click **Save**

### 2. Sync Libraries

1. Go to **Libraries**
2. Click **Sync Libraries**
3. Your media libraries will be imported

### 3. Map Libraries to Radarr/Sonarr

1. Click on a library
2. Select the ARR type (Radarr or Sonarr)
3. Configure root folder and quality profile
4. Set priority (higher = preferred)
5. Click **Save Changes**

### 4. Configure Classification Rules

For each library, you can configure:

- **Include/Exclude Labels**: Use predefined labels like ratings (PG-13, R), genres (Action, Comedy), or content types (Anime, Documentary)
- **Custom Rules**: Use the AI Rule Builder to create complex rules through natural conversation

#### Using the AI Rule Builder

1. Go to a library detail page
2. Click **AI Rule Builder**
3. Chat with the AI about what content should go in this library
4. The AI will ask clarifying questions and extract rules
5. Click **Generate Rule** when ready

Example conversation:
```
AI: What kind of movies should go into "Family Movies"?
You: G and PG rated movies with family-friendly content
AI: Should animation be included?
You: Yes, all animated movies
AI: Any specific genres to exclude?
You: Exclude horror and thriller
```

### 5. Set Up Overseerr Webhook

In Overseerr/Jellyseerr:

1. Go to **Settings** → **Notifications** → **Webhook**
2. Enable webhook notifications
3. Set webhook URL to: `http://classifarr:21324/api/webhook/overseerr`
4. Enable "Media Requested" notification type
5. Save

## 🎯 How Classification Works

Classifarr uses a 4-step decision tree:

### Step 1: Exact Match Check
- Checks if this TMDB ID was previously classified and confirmed
- **Confidence: 100%**

### Step 2: Learned Pattern Check  
- Checks patterns extracted from user corrections
- **Confidence: 80-100%**

### Step 3: Rule-Based Matching
- Evaluates include/exclude labels
- Evaluates custom JSON rules
- Calculates confidence score
- **Confidence: 0-100%**

### Step 4: AI Fallback (Ollama)
- If confidence < 80%, queries Ollama AI
- Provides metadata and library descriptions
- AI selects best match with reasoning
- **Confidence: 60-80%**

## 🎮 Discord Bot Commands

The Discord bot sends notifications for each classification with interactive buttons:

- **✓ Correct** - Confirms the classification is correct
- **→ Alt Library** - Quick correction to alternative library
- **Dropdown Menu** - Select any library for correction

Corrections automatically:
- Update the classification record
- Extract learning patterns
- Improve future classifications

## 📊 API Documentation

Swagger API documentation is available at: `http://localhost:21324/api/docs`

### Key Endpoints

- `POST /api/webhook/overseerr` - Receive Overseerr webhooks
- `GET /api/libraries` - List all libraries
- `GET /api/classification/history` - Get classification history
- `POST /api/classification/corrections` - Submit corrections
- `POST /api/rule-builder/start` - Start AI rule builder session

## 🔧 Advanced Configuration

### Database Customization

The PostgreSQL database is automatically initialized with:
- 40+ predefined label presets (ratings, genres, content types)
- Optimized indexes for performance
- Default settings and configurations

To access the database directly:

```bash
docker exec -it classifarr-db psql -U classifarr -d classifarr
```

### Ollama Models

Classifarr works best with instruction-tuned models. Recommended:

- `qwen3:14b` (default) - Best balance of quality and speed
- `llama2:13b` - Good alternative
- `mistral:7b` - Faster but less accurate

Configure in Settings → Ollama AI

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Web server port | `21324` |
| `POSTGRES_PASSWORD` | Database password | `classifarr_secret` |
| `TMDB_API_KEY` | TMDB API key | Required |
| `DISCORD_BOT_TOKEN` | Discord bot token | Optional |
| `DISCORD_CHANNEL_ID` | Discord channel ID | Optional |
| `OLLAMA_HOST` | Ollama host | `host.docker.internal` |
| `OLLAMA_PORT` | Ollama port | `11434` |
| `OLLAMA_MODEL` | Ollama model | `qwen3:14b` |

## 🐛 Troubleshooting

### Classification Not Working

1. Check health endpoint: `http://localhost:21324/health`
2. Verify TMDB API key is valid
3. Check Docker logs: `docker logs classifarr`
4. Ensure libraries are mapped to Radarr/Sonarr

### Discord Bot Not Connecting

1. Verify bot token is correct
2. Ensure bot has permissions in the channel
3. Check bot is invited to your Discord server
4. View logs for connection errors

### AI Classification Failing

1. Check Ollama is running and accessible
2. Test connection in Settings → Ollama AI
3. Verify the model is downloaded: `ollama list`
4. Try a different model if current one fails

### Database Issues

1. Remove volumes and restart: `docker compose down -v && docker compose up -d`
2. Check database logs: `docker logs classifarr-db`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the amazing *arr community
- Inspired by the need for intelligent media classification
- Powered by Ollama and TMDB

## 🔗 Links

- [GitHub Repository](https://github.com/cloudbyday90/Classifarr)
- [Issue Tracker](https://github.com/cloudbyday90/Classifarr/issues)
- [TMDB API](https://www.themoviedb.org/settings/api)
- [Ollama](https://ollama.ai/)

---

Made with ❤️ by the Classifarr Team
