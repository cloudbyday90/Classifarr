# 🎬 Classifarr

**AI-Powered Media Classification for Plex, Emby & Jellyfin**

Classifarr automatically classifies and routes media requests from Overseerr to the appropriate library in Radarr/Sonarr using AI, custom rules, and machine learning from user corrections.

## ✨ Features

- 🤖 **AI Classification** - Uses Ollama (LLaMA, Qwen, etc.) for intelligent media classification
- 📊 **Multi-Criteria Matching** - Classifies based on genres, ratings, keywords, and metadata
- 🧠 **Machine Learning** - Learns from user corrections via Discord interactions
- 📋 **Custom Rules** - Create rule-based classification with an AI-powered chatbot
- 💬 **Discord Integration** - Rich notifications with one-click corrections
- 🎯 **Auto-Routing** - Automatically sends media to the correct Radarr/Sonarr instance
- 📚 **Multi-Library Support** - Manage multiple libraries per media server
- 🏷️ **Label System** - Organize libraries with ratings, genres, and content types
- 🔄 **Media Server Sync** - Discovers libraries from Plex, Emby, or Jellyfin
- 📈 **Classification History** - Track all classifications and corrections

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- TMDB API Key ([Get one here](https://www.themoviedb.org/settings/api))
- Discord Bot Token (optional, for notifications)
- Ollama instance (optional, for AI classification)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Classifarr.git
   cd Classifarr
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   nano .env
   ```

   Required settings:
   - `TMDB_API_KEY` - Your TMDB API key
   - `DISCORD_BOT_TOKEN` - Your Discord bot token (for notifications)
   - `DISCORD_CHANNEL_ID` - Discord channel ID for notifications
   - `OLLAMA_HOST` - Ollama host (default: host.docker.internal)
   - `OLLAMA_MODEL` - Ollama model to use (default: llama2)

3. **Start the application**
   ```bash
   docker compose up -d
   ```

4. **Access Classifarr**
   - Web UI: http://localhost:21324
   - API: http://localhost:21324/api

## 📖 Setup Guide

### 1. Configure Media Server

1. Navigate to **Settings** → **Media Servers**
2. Click **Add Media Server**
3. Choose your media server type (Plex, Emby, or Jellyfin)
4. Enter connection details:
   - **Name**: Friendly name for your server
   - **URL**: Server URL (e.g., http://plex:32400)
   - **API Key/Token**: Your server's API key
5. Click **Test Connection**
6. Click **Sync Libraries** to discover all libraries

### 2. Assign Labels to Libraries

1. Navigate to **Libraries**
2. Select a library
3. Click **Edit Labels**
4. Assign appropriate labels:
   - **Ratings**: G, PG, PG-13, R, NC-17, TV-MA, etc.
   - **Content Types**: Blockbuster, Independent, Foreign, Documentary, Kids, etc.
   - **Genres**: Action, Comedy, Drama, Horror, Sci-Fi, etc.
5. Save changes

### 3. Configure Radarr/Sonarr

For each library, configure the corresponding *arr instance:

1. Select a library
2. Navigate to **Radarr/Sonarr Config**
3. Enter connection details:
   - **URL**: *arr instance URL
   - **API Key**: *arr API key
   - **Quality Profile ID**: Quality profile to use
   - **Root Folder Path**: Destination folder path
   - **Tag**: Optional tag to apply
4. Save configuration

### 4. Set Up Discord Notifications

1. **Create a Discord Bot**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click **New Application**
   - Go to **Bot** section
   - Click **Add Bot**
   - Enable **MESSAGE CONTENT INTENT**
   - Copy the bot token

2. **Invite Bot to Server**:
   - Go to **OAuth2** → **URL Generator**
   - Select scopes: `bot`
   - Select permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
   - Copy and open the generated URL
   - Add bot to your server

3. **Get Channel ID**:
   - Enable Developer Mode in Discord (Settings → Advanced)
   - Right-click your notifications channel
   - Click **Copy ID**

4. **Configure in Classifarr**:
   - Navigate to **Settings** → **Notifications**
   - Enter **Discord Bot Token**
   - Enter **Discord Channel ID**
   - Enable notifications
   - Save configuration

### 5. Connect Overseerr

1. In Overseerr, go to **Settings** → **Notifications** → **Webhook**
2. Enable webhook notifications
3. Set webhook URL: `http://classifarr:21324/api/webhook/overseerr`
4. Select notification types:
   - ✅ Media Approved
   - ✅ Media Auto-Approved
5. Save settings

## 🎯 Classification Flow

```
Overseerr Request
       ↓
Classifarr Receives Webhook
       ↓
Fetch TMDB Metadata
       ↓
Decision Tree:
  1. Check Exact Match (previously corrected?)
  2. Check Learned Patterns (ML patterns match?)
  3. Match Custom Rules (rule-based)
  4. AI Classification (Ollama fallback)
       ↓
Assign to Library
       ↓
Route to Radarr/Sonarr
       ↓
Send Discord Notification
       ↓
User Can Correct via Discord Buttons
       ↓
Learn from Correction (ML patterns)
```

## 🤖 AI Rule Builder

Create custom classification rules using natural language:

1. Navigate to **Libraries** → Select Library → **Rules**
2. Click **Create Rule with AI**
3. Chat with the AI assistant:
   ```
   User: "This library is for family-friendly animated movies"
   AI: "Got it! What ratings should be included?"
   User: "G and PG only"
   AI: "Any specific genres or keywords?"
   User: "Animation, Family"
   AI: "Perfect! I'll create a rule for G/PG animated family films."
   ```
4. Review and save the generated rule

## 💬 Discord Corrections

When Classifarr classifies media, it sends a Discord notification with:

- 📊 Media information (title, year, poster)
- 🎯 Assigned library
- 📈 Confidence score
- 🔍 Classification method
- 💡 Reasoning

Users can correct classifications with one click:

- ✅ **Correct** - Mark as correct
- ➡️ **Alternative Library** - Move to different library
- 📋 **Dropdown** - Choose from all available libraries

Corrections are used to:
- Update the classification
- Move media in Radarr/Sonarr
- Learn patterns for future classifications

## 🛠️ API Documentation

### Webhook Endpoint

**POST** `/api/webhook/overseerr`

Receives Overseerr webhook notifications.

### Classification Endpoints

- **GET** `/api/classification/history` - Classification history
- **GET** `/api/classification/stats` - Statistics
- **GET** `/api/classification/corrections` - User corrections
- **GET** `/api/classification/patterns` - Learned patterns
- **POST** `/api/classification/classify` - Manual classification

### Library Endpoints

- **GET** `/api/libraries` - List all libraries
- **GET** `/api/libraries/:id` - Get library details
- **PUT** `/api/libraries/:id` - Update library
- **POST** `/api/libraries/:id/labels` - Assign labels
- **GET** `/api/libraries/:id/rules` - Get library rules
- **POST** `/api/libraries/:id/rules` - Create rule

### Settings Endpoints

- **GET** `/api/settings` - Get all settings
- **PUT** `/api/settings/:key` - Update setting
- **GET** `/api/settings/ollama/config` - Ollama config
- **PUT** `/api/settings/ollama/config` - Update Ollama
- **GET** `/api/settings/tmdb/config` - TMDB config
- **PUT** `/api/settings/tmdb/config` - Update TMDB
- **GET** `/api/settings/notifications/config` - Notification config
- **PUT** `/api/settings/notifications/config` - Update notifications

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Application port | `21324` |
| `POSTGRES_HOST` | PostgreSQL host | `postgres` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `classifarr` |
| `POSTGRES_USER` | Database user | `classifarr` |
| `POSTGRES_PASSWORD` | Database password | `classifarr_secret` |
| `TMDB_API_KEY` | TMDB API key | (required) |
| `DISCORD_BOT_TOKEN` | Discord bot token | (optional) |
| `DISCORD_CHANNEL_ID` | Discord channel ID | (optional) |
| `OLLAMA_HOST` | Ollama host | `host.docker.internal` |
| `OLLAMA_PORT` | Ollama port | `11434` |
| `OLLAMA_MODEL` | Ollama model | `llama2` |

### Database Schema

The application uses PostgreSQL with the following main tables:

- `media_server` - Media server configurations
- `libraries` - Discovered libraries
- `library_labels` - Label assignments
- `library_custom_rules` - Custom classification rules
- `label_presets` - System label presets
- `radarr_config` - Radarr configurations
- `sonarr_config` - Sonarr configurations
- `classification_history` - Classification logs
- `classification_corrections` - User corrections
- `learning_patterns` - ML patterns from corrections

## 🐛 Troubleshooting

### Discord Bot Not Connecting

1. Check bot token is correct in settings
2. Verify bot has necessary permissions
3. Check bot is in the correct server
4. Ensure channel ID is correct

### Classifications Not Working

1. Check TMDB API key is valid
2. Verify Ollama is accessible
3. Check libraries are enabled
4. Review classification history for errors

### Radarr/Sonarr Not Receiving Media

1. Verify *arr configuration is correct
2. Test connection to *arr instance
3. Check quality profile ID exists
4. Verify root folder path is correct

### Database Connection Issues

1. Check PostgreSQL is running: `docker ps`
2. Verify database credentials
3. Check logs: `docker logs classifarr`

## 📊 Architecture

```
┌─────────────────┐
│   Overseerr     │
└────────┬────────┘
         │ Webhook
         ↓
┌─────────────────────────────────────────┐
│           Classifarr                    │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Classification Engine           │  │
│  │  • TMDB Metadata Enrichment      │  │
│  │  • Decision Tree                 │  │
│  │  • Rule Matching                 │  │
│  │  • AI Classification (Ollama)    │  │
│  │  • Learning from Corrections     │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Discord Bot                     │  │
│  │  • Rich Notifications            │  │
│  │  • Interactive Corrections       │  │
│  │  • Pattern Learning              │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  PostgreSQL Database             │  │
│  │  • Configuration                 │  │
│  │  • Classification History        │  │
│  │  • Learning Patterns             │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
         │                    │
         ↓                    ↓
┌──────────────┐      ┌──────────────┐
│   Radarr     │      │   Sonarr     │
└──────────────┘      └──────────────┘
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Overseerr](https://overseerr.dev/) - Media request management
- [TMDB](https://www.themoviedb.org/) - Media metadata
- [Ollama](https://ollama.ai/) - Local AI inference
- [Discord.js](https://discord.js.org/) - Discord bot framework

## 📧 Support

For support, please open an issue on GitHub or join our Discord community.

---

Made with ❤️ for the *arr community
