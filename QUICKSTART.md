# 🚀 Quick Start Guide

Get Classifarr up and running in 5 minutes!

## Step 1: Prerequisites (2 min)

You need:
- ✅ Docker & Docker Compose installed
- ✅ TMDB API Key ([Get free key](https://www.themoviedb.org/settings/api))
- ⚠️ Optional: Discord bot token for notifications
- ⚠️ Optional: Ollama instance for AI classification

## Step 2: Clone & Configure (1 min)

```bash
# Clone the repository
git clone https://github.com/yourusername/Classifarr.git
cd Classifarr

# Create environment file
cp .env.example .env

# Edit with your values
nano .env
```

**Required in `.env`:**
```env
TMDB_API_KEY=your_actual_tmdb_api_key_here
```

**Optional (for Discord notifications):**
```env
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id
```

**Optional (for AI classification):**
```env
OLLAMA_HOST=host.docker.internal
OLLAMA_PORT=11434
OLLAMA_MODEL=llama2
```

## Step 3: Start Application (1 min)

```bash
# Start everything
docker compose up -d

# Check it's running
docker compose ps

# View logs
docker compose logs -f classifarr
```

You should see:
```
✓ Database connected successfully
✓ Discord bot connected as YourBot#1234
✓ Classifarr is running!
  - Server: http://localhost:21324
  - API: http://localhost:21324/api
```

## Step 4: Verify Installation (30 sec)

Open in browser: http://localhost:21324

Or test with curl:
```bash
curl http://localhost:21324/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 12.34
}
```

## Step 5: Configure Your Setup (5-10 min)

### A. Add Your Media Server

Navigate to http://localhost:21324 or use API:

```bash
# Example: Add Plex server
curl -X POST http://localhost:21324/api/media-servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Plex",
    "type": "plex",
    "url": "http://your-plex-server:32400",
    "api_key": "your_plex_token"
  }'

# Sync libraries
curl -X POST http://localhost:21324/api/media-servers/1/sync
```

### B. Configure Libraries

1. View libraries: `curl http://localhost:21324/api/libraries`
2. Assign labels to each library (ratings, genres, content types)
3. Configure Radarr/Sonarr for each library

### C. Connect Overseerr

In Overseerr:
1. Go to **Settings** → **Notifications** → **Webhook**
2. Enable webhook
3. Set URL: `http://classifarr:21324/api/webhook/overseerr`
4. Select events: "Media Approved" and "Media Auto-Approved"
5. Save

## Done! 🎉

Your Classifarr instance is now ready to automatically classify media!

### What Happens Next?

1. User requests media in Overseerr
2. Overseerr approves and sends webhook to Classifarr
3. Classifarr:
   - Fetches metadata from TMDB
   - Runs classification decision tree
   - Routes to appropriate Radarr/Sonarr
   - Sends Discord notification (if configured)
4. User can correct via Discord buttons
5. Corrections improve future classifications

## Quick Test

Test classification manually:

```bash
# Classify The Matrix (TMDB ID: 603)
curl -X POST http://localhost:21324/api/classification/classify \
  -H "Content-Type: application/json" \
  -d '{
    "tmdb_id": 603,
    "media_type": "movie",
    "requested_by": "test_user"
  }'
```

Check the result:
```bash
curl http://localhost:21324/api/classification/history
```

## Troubleshooting

### Can't connect to database?
```bash
docker compose logs postgres
docker compose restart postgres
```

### Server won't start?
```bash
docker compose logs classifarr
# Check for port 21324 conflicts
netstat -tulpn | grep 21324
```

### Discord bot offline?
- Verify `DISCORD_BOT_TOKEN` is correct
- Check bot has proper permissions
- Ensure bot is added to your server

## Next Steps

- 📖 Read full [README.md](README.md) for detailed features
- 🧪 Follow [TESTING.md](TESTING.md) for comprehensive testing
- 🎨 Customize label system for your libraries
- 🤖 Try the AI rule builder for custom rules
- 📊 Monitor classification stats and corrections

## Need Help?

- Check logs: `docker compose logs -f`
- Review [TESTING.md](TESTING.md) troubleshooting section
- Open an issue on GitHub

---

**Pro Tip:** Start with just TMDB API key and basic setup. Add Discord, Ollama, and custom rules later as you get comfortable with the system.
