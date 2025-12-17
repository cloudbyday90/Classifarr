# Classifarr

AI-powered media classification and routing system for Radarr/Sonarr with Discord notifications.

## Features

- 🤖 **AI-Powered Classification**: Uses Ollama for intelligent media classification
- 📋 **Rule-Based System**: Configurable label presets and custom rules
- 🧠 **Learning System**: Learns from user corrections to improve accuracy
- 💬 **Chatbot Rule Builder**: Interactive assistant to create custom classification rules
- 🔔 **Discord Notifications**: Rich embeds with correction buttons
- 🔄 **Automatic Routing**: Routes media to appropriate Radarr/Sonarr libraries
- 🎯 **Confidence Scoring**: Transparent confidence levels for each classification

## Classification Flow

1. **Past Corrections** - Check if this exact TMDB ID has been corrected before → return if found
2. **Learned Patterns** - Check learned patterns from previous corrections → return if confidence ≥ 85%
3. **Rule Matching** - Match against all library labels and custom rules
4. **High Confidence** - If rule match confidence ≥ 80% → use rule match
5. **AI Decision** - If confidence < 80% → call Ollama AI for decision
6. **Result** - Return library, confidence, reason, and method

## Requirements

- Node.js 18+
- PostgreSQL 12+
- Ollama (for AI classification)
- Discord Bot (optional, for notifications)
- Radarr and/or Sonarr

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/cloudbyday90/Classifarr.git
cd Classifarr
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL database

```bash
psql -U postgres
CREATE DATABASE classifarr;
\c classifarr
\i database/init.sql
\q
```

### 4. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL connection
- `OLLAMA_HOST`, `OLLAMA_MODEL` - Ollama API configuration
- `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID` - Discord bot (optional)
- `RADARR_URL`, `RADARR_API_KEY` - Radarr configuration
- `SONARR_URL`, `SONARR_API_KEY` - Sonarr configuration
- `TMDB_API_KEY` - TMDB API key for metadata enrichment

### 5. Start the server

```bash
npm start
# Or for development with auto-reload:
npm run dev
```

## Configuration

### Creating Libraries

```bash
curl -X POST http://localhost:3000/api/libraries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Family Movies",
    "mediaType": "movie",
    "rootFolder": "/media/family",
    "qualityProfileId": 1,
    "description": "Family-friendly movies for all ages"
  }'
```

### Setting Library Labels

```bash
curl -X POST http://localhost:3000/api/libraries/1/labels \
  -H "Content-Type: application/json" \
  -d '{
    "labels": [
      {"labelPresetId": 1, "isInclude": true},
      {"labelPresetId": 2, "isInclude": true}
    ]
  }'
```

### Creating Custom Rules with Chatbot

```bash
# Start conversation
curl -X POST http://localhost:3000/api/rule-builder/start \
  -H "Content-Type: application/json" \
  -d '{"libraryId": 1, "mediaType": "movie"}'

# Continue conversation
curl -X POST http://localhost:3000/api/rule-builder/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session-id", "message": "I want action movies rated PG or PG-13"}'

# Generate final rule
curl -X POST http://localhost:3000/api/rule-builder/generate \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session-id"}'
```

## API Endpoints

### Classification
- `POST /api/classify` - Classify media and route to library
- `POST /api/classify/test` - Test classification without saving
- `GET /api/labels` - Get all label presets
- `GET /api/labels/:category` - Get labels by category
- `POST /api/libraries/:id/labels` - Set labels for library
- `GET /api/libraries/:id/labels` - Get labels for library
- `POST /api/libraries/:id/rules` - Add custom rule
- `GET /api/libraries/:id/rules` - Get custom rules
- `PUT /api/libraries/:id/rules/:ruleId` - Update custom rule
- `DELETE /api/libraries/:id/rules/:ruleId` - Delete custom rule

### Rule Builder
- `POST /api/rule-builder/start` - Start new conversation
- `POST /api/rule-builder/message` - Send message in conversation
- `POST /api/rule-builder/generate` - Generate rule from conversation
- `POST /api/rule-builder/test` - Test rule against sample data
- `GET /api/rule-builder/session/:sessionId` - Get session details

### Webhooks
- `POST /api/webhook/overseerr` - Handle Overseerr webhooks
- `POST /api/webhook/test` - Test webhook parsing

### Libraries
- `GET /api/libraries` - Get all libraries
- `POST /api/libraries` - Create library
- `PUT /api/libraries/:id` - Update library
- `DELETE /api/libraries/:id` - Delete library

## Overseerr Integration

Configure Overseerr to send webhooks to Classifarr:

1. Go to Settings → Notifications → Webhook
2. Enable Webhook agent
3. Set Webhook URL: `http://your-server:3000/api/webhook/overseerr`
4. Enable notifications for:
   - Media Pending Approval
   - Media Approved

## Discord Integration

The Discord bot sends rich embeds with classification results:

```
🎬 New Movie Classified
━━━━━━━━━━━━━━━━━━━━
[Poster Image]
Title: The Super Mario Bros. Movie
Year: 2023
Library: Family
Confidence: 92%
Method: 📋 Rule Match
Reason: Rated PG, Animation genre, Family genre...

[✓ Correct] [→ Movies] [→ Kids] [→ Anime]
[▼ Move to different library...]
```

Users can:
- Click **✓ Correct** to confirm the classification
- Click library buttons to move to a different library
- Use the dropdown for more library options

All corrections are stored and used to improve future classifications.

## Label Presets

Pre-configured labels for easy classification:

### Ratings
- **Movies**: G, PG, PG-13, R, NC-17
- **TV**: TV-Y, TV-Y7, TV-G, TV-PG, TV-14, TV-MA

### Content Types
- Animated, Anime, Holiday/Seasonal, Standup, Documentary
- Reality, Talk Show, Game Show, Sports

### Genres
- Action, Adventure, Comedy, Crime, Drama, Family
- Fantasy, Horror, Mystery, Romance, Sci-Fi, Thriller
- War, Western, Music, History

## Custom Rules

Custom rules use JSON logic format:

```json
{
  "and": [
    {"field": "genres", "operator": "in", "value": ["Action", "Adventure"]},
    {"field": "certification", "operator": "in", "value": ["PG", "PG-13"]},
    {"field": "year", "operator": "greaterThan", "value": "2010"}
  ]
}
```

Supported operators:
- `equals` - Exact match
- `contains` - String/array contains value
- `in` - Value is in array
- `greaterThan` - Numeric comparison
- `lessThan` - Numeric comparison

## Learning System

Classifarr learns from user corrections:

1. User corrects a classification via Discord
2. System extracts patterns (genres, keywords, certification)
3. Patterns are stored with confidence scores
4. Future classifications use learned patterns
5. Confidence increases with correct predictions

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests (when implemented)
npm test
```

## Architecture

```
┌─────────────┐
│  Overseerr  │
└──────┬──────┘
       │ Webhook
       ▼
┌─────────────────────────────────────────┐
│           Classifarr Server             │
│  ┌───────────────────────────────────┐  │
│  │   Classification Flow              │  │
│  │   1. Past Corrections              │  │
│  │   2. Learned Patterns              │  │
│  │   3. Rule Matching                 │  │
│  │   4. AI Decision (Ollama)          │  │
│  └───────────────────────────────────┘  │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │   Database (PostgreSQL)            │  │
│  │   - Libraries                      │  │
│  │   - Label Presets                  │  │
│  │   - Custom Rules                   │  │
│  │   - Classifications                │  │
│  │   - Corrections                    │  │
│  │   - Learned Patterns               │  │
│  └───────────────────────────────────┘  │
└────────┬───────────────────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────┐         ┌──────────────┐
│   Discord   │         │ Radarr/      │
│   (notify)  │         │ Sonarr       │
└─────────────┘         └──────────────┘
```

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and questions, please use the GitHub issue tracker.
