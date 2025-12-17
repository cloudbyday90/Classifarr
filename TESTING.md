# Testing Guide for Classifarr

## Prerequisites

Before testing Classifarr, ensure you have:
- Docker and Docker Compose installed
- TMDB API key (get one at https://www.themoviedb.org/settings/api)
- (Optional) Discord bot token for notifications
- (Optional) Ollama instance for AI classification

## Quick Start Test

### 1. Setup Environment

```bash
# Clone repository
git clone https://github.com/yourusername/Classifarr.git
cd Classifarr

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

Required values in `.env`:
- `TMDB_API_KEY` - Your TMDB API key
- `DISCORD_BOT_TOKEN` - (Optional) Your Discord bot token
- `DISCORD_CHANNEL_ID` - (Optional) Discord channel ID

### 2. Start Services

```bash
# Start with Docker Compose
docker compose up -d

# Check logs
docker compose logs -f classifarr

# You should see:
# ✓ Database connected successfully
# ✓ Discord bot connected (if configured)
# ✓ Classifarr is running!
```

### 3. Verify Installation

**Check health endpoint:**
```bash
curl http://localhost:21324/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45
}
```

**Check API info:**
```bash
curl http://localhost:21324/api
```

**Access Web UI:**
Open http://localhost:21324 in your browser

## Testing Core Features

### Test 1: Media Server Configuration

```bash
# Add a Plex server
curl -X POST http://localhost:21324/api/media-servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Plex Server",
    "type": "plex",
    "url": "http://plex:32400",
    "api_key": "your_plex_token",
    "enabled": true
  }'

# Test connection
curl -X POST http://localhost:21324/api/media-servers/1/test

# Sync libraries
curl -X POST http://localhost:21324/api/media-servers/1/sync
```

### Test 2: Library Configuration

```bash
# Get all libraries
curl http://localhost:21324/api/libraries

# Assign labels to a library
curl -X POST http://localhost:21324/api/libraries/1/labels \
  -H "Content-Type: application/json" \
  -d '{
    "labelIds": [1, 2, 3, 13, 14]
  }'

# Configure Radarr for a library
curl -X POST http://localhost:21324/api/libraries/1/radarr \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://radarr:7878",
    "api_key": "your_radarr_api_key",
    "quality_profile_id": 1,
    "root_folder_path": "/movies/4k",
    "enabled": true
  }'
```

### Test 3: Manual Classification

```bash
# Classify a movie (The Matrix - TMDB ID: 603)
curl -X POST http://localhost:21324/api/classification/classify \
  -H "Content-Type: application/json" \
  -d '{
    "tmdb_id": 603,
    "media_type": "movie",
    "requested_by": "test_user"
  }'

# Check classification history
curl http://localhost:21324/api/classification/history

# Get statistics
curl http://localhost:21324/api/classification/stats
```

### Test 4: Webhook Simulation

```bash
# Simulate Overseerr webhook
curl -X POST http://localhost:21324/api/webhook/overseerr \
  -H "Content-Type: application/json" \
  -d '{
    "notification_type": "MEDIA_APPROVED",
    "media": {
      "tmdbId": 603,
      "title": "The Matrix",
      "media_type": "movie"
    },
    "request": {
      "requestedBy_username": "john_doe",
      "request_id": 123
    }
  }'
```

### Test 5: AI Rule Builder

```bash
# Start a rule building session
curl -X POST http://localhost:21324/api/rule-builder/session/start \
  -H "Content-Type: application/json" \
  -d '{
    "library_id": 1,
    "media_type": "movie",
    "user_id": "test_user"
  }'

# Save the returned sessionId, then send a message
curl -X POST http://localhost:21324/api/rule-builder/session/{sessionId}/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "This library is for action movies rated R or PG-13"
  }'

# Generate rule when ready
curl -X POST http://localhost:21324/api/rule-builder/session/{sessionId}/generate \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "Action R/PG-13"
  }'
```

## Database Verification

```bash
# Connect to PostgreSQL
docker exec -it classifarr-db psql -U classifarr -d classifarr

# Check tables
\dt

# Check label presets
SELECT * FROM label_presets LIMIT 10;

# Check settings
SELECT * FROM settings;

# Exit
\q
```

## Discord Bot Testing

If you configured Discord:

1. Check bot is online in your Discord server
2. Trigger a classification (manual or webhook)
3. Verify notification appears in configured channel
4. Test correction buttons:
   - Click "✓ Correct" to approve
   - Click alternative library buttons to correct
   - Use dropdown for more options

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker compose logs postgres

# Verify database is accessible
docker exec -it classifarr-db pg_isready -U classifarr
```

### Server Not Starting

```bash
# Check server logs
docker compose logs classifarr

# Check for port conflicts
netstat -tulpn | grep 21324

# Restart services
docker compose restart classifarr
```

### Discord Bot Not Connecting

```bash
# Check logs for Discord errors
docker compose logs classifarr | grep -i discord

# Verify token is correct
docker exec -it classifarr env | grep DISCORD

# Check bot has correct permissions in Discord
```

### TMDB API Errors

```bash
# Test TMDB API key
curl "https://api.themoviedb.org/3/movie/603?api_key=YOUR_KEY"

# Check logs
docker compose logs classifarr | grep -i tmdb
```

## Performance Testing

### Load Test Classification

```bash
# Install hey (HTTP load testing tool)
# brew install hey  # macOS
# apt-get install hey  # Ubuntu

# Run load test
hey -n 100 -c 10 \
  -m POST \
  -H "Content-Type: application/json" \
  -d '{"tmdb_id":603,"media_type":"movie","requested_by":"test"}' \
  http://localhost:21324/api/classification/classify
```

## Development Testing

### Run Server Locally (without Docker)

```bash
# Start PostgreSQL only
docker compose up -d postgres

# Install dependencies
cd server && npm install

# Set environment variables
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export TMDB_API_KEY=your_key_here

# Start server
npm start

# Server runs on http://localhost:21324
```

### Run Frontend Locally

```bash
cd client
npm install
npm run dev

# Frontend runs on http://localhost:5173
# API proxied to http://localhost:21324/api
```

## Integration Testing

### Full Workflow Test

1. Configure media server (Plex/Emby/Jellyfin)
2. Sync libraries
3. Assign labels to libraries
4. Configure Radarr/Sonarr for each library
5. Configure Discord notifications
6. Configure Overseerr webhook
7. Make a request in Overseerr
8. Verify:
   - Classification happens automatically
   - Media is routed to correct *arr instance
   - Discord notification is sent
   - Correction buttons work
   - Learning patterns are saved after correction

## Cleanup

```bash
# Stop services
docker compose down

# Remove volumes (WARNING: deletes database)
docker compose down -v

# Remove images
docker rmi classifarr postgres:16-alpine
```

## Next Steps

Once basic testing is complete:

1. Configure your production media servers
2. Set up label system for your libraries
3. Create custom rules with AI chatbot
4. Monitor classification accuracy
5. Use corrections to improve ML patterns
6. Review classification history regularly

## Support

If you encounter issues:
1. Check logs: `docker compose logs -f`
2. Verify configuration in `.env`
3. Review troubleshooting section above
4. Open an issue on GitHub with logs
