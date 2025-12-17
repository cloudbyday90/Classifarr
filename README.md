# Classifarr

An AI-powered media classification platform for the *arr ecosystem. Classifarr automatically classifies your media files into the appropriate libraries using AI, integrating seamlessly with Plex, Emby, Jellyfin, Radarr, and Sonarr.

## Features

- 🤖 **AI-Powered Classification**: Uses Ollama for intelligent media classification
- 📚 **Multiple Media Servers**: Support for Plex, Emby, and Jellyfin
- 🎬 ***arr Integration**: Seamless integration with Radarr and Sonarr
- 🎯 **Custom Rules**: Define custom classification rules per library
- 📊 **Classification History**: Track all classifications and corrections
- 🔄 **Learning System**: Improves over time based on user corrections
- 🐳 **Docker Ready**: Production-ready Docker setup

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **AI Engine**: Ollama
- **Media Data**: TMDB (The Movie Database)

## Getting Started

### Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- Ollama (for AI classification)
- One of: Plex, Emby, or Jellyfin media server
- (Optional) Radarr and/or Sonarr

### Installation

1. Clone the repository:
```bash
git clone https://github.com/cloudbyday90/Classifarr.git
cd Classifarr/server
```

2. Install dependencies:
```bash
npm install
```

3. Create your environment configuration:
```bash
cp ../.env.example .env
```

4. Edit `.env` with your configuration:
```env
# Server
PORT=21324
NODE_ENV=development

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=classifarr
POSTGRES_USER=classifarr
POSTGRES_PASSWORD=your_password_here

# TMDB
TMDB_API_KEY=your_tmdb_api_key
```

5. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on port 21324 by default.

### Docker Deployment

Build and run with Docker:

```bash
cd server
docker build -t classifarr .
docker run -p 21324:21324 --env-file .env classifarr
```

## API Documentation

Once the server is running, access the interactive API documentation at:

```
http://localhost:21324/api/docs
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Media Server
- `GET /api/media-server` - Get current media server configuration
- `POST /api/media-server` - Save media server configuration
- `POST /api/media-server/test` - Test media server connection
- `POST /api/media-server/sync` - Sync media server libraries

### Libraries
- `GET /api/libraries` - List all libraries
- `GET /api/libraries/:id` - Get single library details
- `PUT /api/libraries/:id` - Update library settings
- `POST /api/libraries/:id/rules` - Update classification rules

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update settings
- `GET/POST /api/settings/radarr` - Radarr configuration
- `POST /api/settings/radarr/test` - Test Radarr connection
- `GET/POST /api/settings/sonarr` - Sonarr configuration
- `POST /api/settings/sonarr/test` - Test Sonarr connection
- `GET/POST /api/settings/ollama` - Ollama configuration
- `POST /api/settings/ollama/test` - Test Ollama connection

### Classification
- `POST /api/classify` - Classify a media item (webhook endpoint)
- `GET /api/history` - Get classification history
- `POST /api/corrections` - Submit a correction

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection pool
│   ├── routes/
│   │   ├── api.js               # Main API router
│   │   ├── classification.js    # Classification endpoints
│   │   ├── libraries.js         # Library management
│   │   ├── mediaServer.js       # Media server integration
│   │   └── settings.js          # Application settings
│   ├── services/
│   │   ├── emby.js              # Emby API service
│   │   ├── jellyfin.js          # Jellyfin API service
│   │   ├── ollama.js            # Ollama AI service
│   │   ├── plex.js              # Plex API service
│   │   ├── radarr.js            # Radarr API service
│   │   ├── sonarr.js            # Sonarr API service
│   │   └── tmdb.js              # TMDB API service
│   └── index.js                 # Express server setup
├── Dockerfile                   # Production Docker image
└── package.json                 # Dependencies and scripts
```

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for automatic reloading on file changes.

### Linting

```bash
npm run lint
```

## Configuration

### Media Server Setup

1. Configure your media server (Plex/Emby/Jellyfin) via the API or UI
2. Test the connection using the test endpoint
3. Sync libraries to import them into Classifarr

### Ollama Setup

1. Install and run Ollama locally or on a server
2. Pull a compatible model (e.g., `llama2`, `mistral`)
3. Configure Ollama connection in Classifarr settings

### TMDB API Key

Get a free API key from [The Movie Database](https://www.themoviedb.org/settings/api).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](../LICENSE) file for details.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.
