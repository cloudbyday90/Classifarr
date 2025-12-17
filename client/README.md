# Classifarr Client

Modern Vue 3 frontend for Classifarr - AI-powered media classification for *arr stack.

## Tech Stack

- **Vue 3** with Composition API
- **Vite** for fast development and building
- **Vue Router** for navigation
- **Pinia** for state management
- **Tailwind CSS** for styling
- **Axios** for API calls
- **Heroicons** for icons

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

### Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
client/
├── src/
│   ├── api/              # API layer (Axios)
│   ├── assets/           # Static assets (CSS, images)
│   ├── components/       # Reusable Vue components
│   │   ├── common/       # Generic UI components
│   │   ├── dashboard/    # Dashboard-specific components
│   │   ├── libraries/    # Library management components
│   │   ├── settings/     # Settings components
│   │   ├── chat/         # Chat interface components
│   │   └── history/      # History components
│   ├── router/           # Vue Router configuration
│   ├── stores/           # Pinia stores
│   ├── views/            # Page components
│   ├── App.vue           # Root component
│   └── main.js           # Application entry point
├── public/               # Public static files
├── index.html            # HTML entry point
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── package.json          # Dependencies and scripts
```

## Features

- **Dashboard**: Overview with statistics and recent activity
- **Libraries**: Manage media libraries from your server
- **Library Configuration**: Set up labels, custom rules, and mappings
- **Rule Builder**: Chat-based interface for creating classification rules
- **History**: View and manage classification history
- **Settings**: Configure media servers, *arr apps, AI, and notifications

## Dark Theme

The application uses a dark theme inspired by Radarr/Sonarr:

- Background: `#1a1d24`
- Sidebar: `#12141a`
- Cards: `#242731`
- Primary: `#3b82f6` (blue)
- Success: `#22c55e` (green)
- Warning: `#f59e0b` (amber)
- Error: `#ef4444` (red)

## API Integration

The frontend communicates with the backend API at `http://localhost:21324` (configurable via `.env`).

API endpoints are organized in `src/api/`:
- `libraries.js` - Library management
- `mediaServer.js` - Media server configuration
- `settings.js` - Application settings
- `classification.js` - Classification history
- `ruleBuilder.js` - AI rule builder

## License

See LICENSE file in the root directory.
