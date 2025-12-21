# Classifarr

**AI-Powered Media Classification for the *arr Ecosystem**

Classifarr is an intelligent media classification platform that automatically routes incoming requests from Overseerr/Jellyseerr to the correct Radarr/Sonarr library using AI and machine learning. Everything runs in a single self-contained Docker container with embedded PostgreSQL.

![License](https://img.shields.io/github/license/cloudbyday90/Classifarr)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

## ✨ Features

- **🔐 Secure Authentication System** - JWT-based login with first-run setup wizard
- **🔒 Optional HTTPS Support** - Built-in TLS or reverse proxy compatible
- **🤖 Built-in AI Classification Engine** - No external n8n or workflows required
- **🗄️ Embedded PostgreSQL Database** - Auto-initialized on first run, all data in single volume
- **💬 Discord Bot Integration** - Real-time notifications and corrections
- **🎨 Modern Vue 3 Frontend** - Dark *arr-style theme
- **🔄 Smart Learning System** - Learns from corrections over time
- **📊 Comprehensive Dashboard** - Track classifications and performance
- **⚙️ Easy Configuration** - Simple setup through web UI
- **🐳 Single Container Deployment** - Just `docker compose up -d`

## 🏗️ Architecture

```
┌─────────────┐
│  Overseerr  │
│ /Jellyseerr │
└──────┬──────┘
       │ Webhook
       ▼
┌─────────────────────────────────────────┐
│     CLASSIFARR (Single Container)       │
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
│  │   Embedded PostgreSQL             │ │
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

2. **Start Classifarr:**

```bash
docker compose up -d
```

The container will automatically:
- Initialize PostgreSQL database on first run
- Create all necessary tables and seed data
- Start both PostgreSQL and the application

3. **Access the web interface:**

Open your browser to `http://localhost:21324`

**Note:** The first startup may take 30-60 seconds as PostgreSQL initializes the database.

### First-Time Setup

When you first access Classifarr, you'll be guided through a setup wizard:

1. **Create Admin Account**
   - Set your admin username, email, and password
   - Password must meet security requirements (8+ chars, uppercase, lowercase, number, special char)

2. **Configure TMDB** (Required)
   - Enter your TMDB API key
   - Test the connection

3. **Configure Ollama** (Optional)
   - Set Ollama host and port if using AI classification
   - Select your preferred model

4. **Configure Discord** (Optional)
   - Add your bot token and channel ID for notifications
   - See [DISCORD_SETUP.md](DISCORD_SETUP.md) for complete bot setup instructions

## 🔐 Authentication & Security

Classifarr includes a secure authentication system:

- **First-run setup wizard** creates your admin account
- **JWT-based authentication** with 7-day sessions
- **Password requirements**: 8+ chars with uppercase, lowercase, number, and special character
- **Audit logging** of all security events
- **Session management** with automatic token refresh

See [AUTHENTICATION.md](AUTHENTICATION.md) for detailed security information.

## 🔒 HTTPS Configuration

Classifarr supports two HTTPS deployment options:

### Option 1: Reverse Proxy (Recommended)

Use Nginx Proxy Manager, Traefik, or Caddy to handle SSL:
- Automatic certificate management with Let's Encrypt
- Centralized SSL for all your services
- No certificate configuration in Classifarr needed

### Option 2: Direct HTTPS

Enable built-in HTTPS in Classifarr:
- Serve directly on port 21325
- Configure certificate paths in Settings → SSL/HTTPS
- Good for standalone deployments

See [AUTHENTICATION.md](AUTHENTICATION.md) for detailed HTTPS setup instructions and reverse proxy examples.

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

See [DISCORD_SETUP.md](DISCORD_SETUP.md) for complete setup and troubleshooting guide.

### AI Classification Failing

1. Check Ollama is running and accessible
2. Test connection in Settings → Ollama AI
3. Verify the model is downloaded: `ollama list`
4. Try a different model if current one fails

### Database Issues

1. Remove volumes and restart: `docker compose down -v && docker compose up -d`
2. Check database logs: `docker logs classifarr-db`

## 🐳 Deployment Options

Classifarr supports multiple platforms with pre-built Docker images for various architectures.

### Supported Platforms

Pre-built images are available for:
- **linux/amd64** - UnRaid, Synology x86, Windows (Docker Desktop), Linux servers
- **linux/arm64** - Synology ARM, Raspberry Pi 4+, Apple Silicon Macs
- **linux/arm/v7** - Older Raspberry Pi, some Synology ARM models

### Linux (Standard Docker)

The simplest deployment method:

```bash
git clone https://github.com/cloudbyday90/Classifarr.git
cd Classifarr

# Start the service (database auto-initializes on first run)
docker compose up -d
```

Or use pre-built images:

```bash
# Create data directory
mkdir -p ./data

# Pull from GitHub Container Registry
docker pull ghcr.io/cloudbyday90/classifarr:latest

# Or pull from Docker Hub
docker pull cloudbyday90/classifarr:latest

# Run the container
docker run -d \
  --name classifarr \
  -p 21324:21324 \
  -v ./data:/app/data \
  -e NODE_ENV=production \
  --restart unless-stopped \
  ghcr.io/cloudbyday90/classifarr:latest
```

### Windows (Docker Desktop)

1. **Install Docker Desktop**
   - Download from [docker.com](https://www.docker.com/products/docker-desktop/)
   - Install and start Docker Desktop
   - No WSL setup required - Docker Desktop handles everything

2. **Deploy Classifarr**
   
   In PowerShell or Command Prompt:
   ```powershell
   git clone https://github.com/cloudbyday90/Classifarr.git
   cd Classifarr
   
   # Start the service (database auto-initializes on first run)
   docker compose up -d
   ```

3. **Access the interface**
   - Open browser to `http://localhost:21324`

**Note:** Windows paths in docker-compose.yml will be automatically handled by Docker Desktop. The first startup may take 30-60 seconds as the database initializes.

### UnRaid

**Option 1: Community Applications (Recommended)**
1. Open UnRaid web interface
2. Go to **Apps** tab
3. Search for "Classifarr"
4. Click **Install**
5. Configure paths and ports as needed
6. Click **Apply**

The Community Applications template will automatically:
- Initialize the embedded PostgreSQL database on first run
- Configure proper volume mounts to `/mnt/user/appdata/classifarr/data`
- Set up networking with default port 21324

For detailed UnRaid installation instructions, see [unraid/README.md](unraid/README.md).

**Option 2: Manual Docker Setup**
1. In UnRaid, go to **Docker** tab
2. Click **Add Container**
3. Use the following settings:
   - **Repository:** `ghcr.io/cloudbyday90/classifarr:latest` or `cloudbyday90/classifarr:latest`
   - **Network Type:** Bridge
   - **Port Mappings:**
     - Container Port: 21324 → Host Port: 21324 (HTTP)
     - Container Port: 21325 → Host Port: 21325 (HTTPS - optional)
   - **Path Mappings:**
     - Container Path: `/app/data` → Host Path: `/mnt/user/appdata/classifarr/data`
   - **Environment Variables:**
     - `NODE_ENV=production`
     - `TZ=America/New_York` (or your timezone)

**Option 3: Using Docker Compose**
```bash
# Create directory
mkdir -p /mnt/user/appdata/classifarr/data
cd /mnt/user/appdata/classifarr

# Download and start
wget https://raw.githubusercontent.com/cloudbyday90/Classifarr/main/docker-compose.unraid.yml
docker compose -f docker-compose.unraid.yml up -d
```

### Synology NAS

**Using Container Manager (DSM 7.2+)**

1. **Download Docker Compose File**
   - Download `docker-compose.synology.yml` from the repository
   - Rename it to `docker-compose.yml`

2. **Set Up via Container Manager**
   - Open **Container Manager** in DSM
   - Go to **Project** tab
   - Click **Create**
   - Name the project: `classifarr`
   - Upload the `docker-compose.yml` file
   - Click **Next** and review settings
   - Click **Done** to start the container

3. **Configure Paths**
   - Ensure `/volume1/docker/classifarr/data` directory exists
   - Set proper permissions: `chmod -R 755 /volume1/docker/classifarr/`

4. **Access Classifarr**
   - Open browser to `http://your-synology-ip:21324`

**Manual Container Setup (Alternative)**

1. In Container Manager, go to **Container** tab
2. Click **Create** → **Create Container via Docker Hub**
3. Search for: `ghcr.io/cloudbyday90/classifarr` or `cloudbyday90/classifarr`
4. Configure:
   - **Port Settings:**
     - Local Port: 21324 → Container Port: 21324
   - **Volume Settings:**
     - File/Folder: `/docker/classifarr/data` → Mount Path: `/app/data`
   - **Environment Variables:**
     - `NODE_ENV=production`
     - `POSTGRES_HOST=postgres`

**Note:** For Synology ARM models, the appropriate image (arm64 or arm/v7) will be automatically selected.

### Pre-built Images

All platforms can use pre-built images from GitHub Container Registry or Docker Hub:

```bash
# From GitHub Container Registry
docker pull ghcr.io/cloudbyday90/classifarr:latest

# From Docker Hub
docker pull cloudbyday90/classifarr:latest

# Pull specific version
docker pull ghcr.io/cloudbyday90/classifarr:v1.0.0
docker pull cloudbyday90/classifarr:v1.0.0

# Pull specific architecture
docker pull ghcr.io/cloudbyday90/classifarr:latest --platform linux/arm64
```

The correct architecture will be automatically selected based on your system.

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
- [GitHub Container Registry](https://github.com/cloudbyday90/Classifarr/pkgs/container/classifarr)
- [Docker Hub](https://hub.docker.com/r/cloudbyday90/classifarr)
- [Issue Tracker](https://github.com/cloudbyday90/Classifarr/issues)
- [Discord Bot Setup Guide](DISCORD_SETUP.md)
- [Authentication Guide](AUTHENTICATION.md)
- [UnRaid Installation Guide](unraid/README.md)
- [UnRaid Community Apps](https://unraid.net/community/apps)
- [TMDB API](https://www.themoviedb.org/settings/api)
- [Ollama](https://ollama.ai/)

---

Made with ❤️ by the Classifarr Team
