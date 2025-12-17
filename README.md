# Classifarr

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GitHub Stars](https://img.shields.io/github/stars/cloudbyday90/Classifarr?style=social)](https://github.com/cloudbyday90/Classifarr/stargazers)

> AI-powered media classification for the *arr ecosystem

---

## 📚 Table of Contents

- [What is Classifarr?](#what-is-classifarr)
- [Features](#features)
- [How It Works](#how-it-works)
- [Supported Libraries](#supported-libraries)
- [Deployment Options](#deployment-options)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Credits & Acknowledgments](#credits--acknowledgments)

---

## 🎯 What is Classifarr?

Classifarr is an AI-powered media classification platform for the *arr ecosystem. It automatically routes incoming requests from Overseerr/Jellyseerr to the correct Radarr/Sonarr library using AI and machine learning. It analyzes metadata like genres, language, ratings, keywords, and production companies to determine the best library - and learns from corrections to get smarter over time.

---

## ✨ Features

- ✅ **AI-powered classification** using local LLM (Ollama)
- ✅ **Learns from corrections** (machine learning)
- ✅ **Customizable library definitions** stored in PostgreSQL
- ✅ **Supports multiple libraries** (Anime, Family, Kids, Reality TV, Comedy/Live/Game Shows, etc.)
- ✅ **Discord notifications** with poster images
- ✅ **Works with Overseerr/Jellyseerr webhooks**
- ✅ **PostgreSQL** for persistent storage & learning
- ✅ **n8n** for workflow automation
- ✅ **Two deployment options**: Full Stack or Core Only

---

## 🔄 How It Works

```
Overseerr Request 
    → Webhook to Classifarr (n8n)
    → Fetch TMDB metadata
    → AI classifies using your library definitions
    → Check for similar past corrections (learning)
    → Route to correct Radarr/Sonarr instance
    → Notify via Discord
    → User can correct if wrong → System learns
```

---

## 📁 Supported Libraries

Classifarr supports fully customizable libraries. Here are some examples:

### 🎬 Movies

- **Movies** (default)
- **Anime Movies**
- **Family**
- **Christmas and Hallmark**
- **Comedy and Standup**

### 📺 TV Shows

- **TV Shows** (default)
- **Anime**
- **Kids TV**
- **Reality and Docuseries**
- **Comedy/Live/Game Shows**

> **Note:** These are just examples - libraries are fully customizable!

---

## 🚀 Deployment Options

### Full Stack (New Users)

Perfect for users starting fresh or wanting an all-in-one solution.

**Includes:**
- Classifarr components
- n8n (workflow automation)
- PostgreSQL (database)

**Benefits:**
- Single Docker Compose file
- Pre-configured and ready to go
- No external dependencies needed

### Core Only (Existing Setup)

Ideal for users who already have n8n and PostgreSQL running.

**Includes:**
- Classifarr components only

**Benefits:**
- Connects to your existing infrastructure
- Minimal footprint
- Flexible integration

---

## 📋 Requirements

- **Docker** & **Docker Compose**
- **Overseerr** or **Jellyseerr**
- **Radarr** / **Sonarr** (with multiple root folders configured)
- **Ollama** (for local AI - recommend `qwen2.5:14b` or similar)
- **Discord server** (for notifications)

---

## 📦 Installation

> **Coming Soon!**
> 
> Detailed installation instructions will be provided here, including:
> - Docker Compose setup
> - Environment variable configuration
> - Ollama model setup
> - Webhook configuration

---

## ⚙️ Configuration

> **Coming Soon!**
> 
> Configuration guide will include:
> - Library definition setup
> - Discord webhook configuration
> - Radarr/Sonarr API connections
> - n8n workflow import
> - Ollama model selection

---

## 🗺️ Roadmap

- [ ] Web UI for managing library definitions
- [ ] Support for Lidarr (music)
- [ ] Support for Readarr (books)
- [ ] Auto-tagging in Radarr/Sonarr
- [ ] Quality profile recommendations
- [ ] Multi-user support
- [ ] Plex/Jellyfin library sync

---

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, improving documentation, or proposing new features, your help is appreciated.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the project's coding standards and includes appropriate tests.

---

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Credits & Acknowledgments

Classifarr is built on the shoulders of giants and wouldn't be possible without these amazing projects:

- **[The *arr Ecosystem](https://wiki.servarr.com/)** - Radarr, Sonarr, and the entire *arr family
- **[Overseerr](https://overseerr.dev/)** - Request management for Plex
- **[Jellyseerr](https://github.com/Fallenbagel/jellyseerr)** - Request management for Jellyfin
- **[n8n](https://n8n.io/)** - Workflow automation platform
- **[Ollama](https://ollama.com/)** - Local LLM inference
- **[PostgreSQL](https://www.postgresql.org/)** - The world's most advanced open source database
- **[TMDB](https://www.themoviedb.org/)** - Movie and TV show metadata

Special thanks to the open source community for making projects like this possible! 🎉

---

<div align="center">
  Made with ❤️ for the *arr community
</div>
