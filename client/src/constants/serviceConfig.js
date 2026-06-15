/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Service-to-settings URL mapping
export const SERVICE_SETTINGS_MAP = {
  aiProvider: '/settings?tab=ai',
  imageEmbeddings: '/settings?tab=rag',
  mediaServer: '/settings?tab=mediaserver',
  radarr: '/settings?tab=radarr',
  sonarr: '/settings?tab=sonarr',
  tmdb: '/settings?tab=tmdb',
  omdb: '/settings?tab=omdb',
  discordBot: '/settings?tab=discord',
  webhook: '/settings?tab=webhooks',
  tavily: '/settings?tab=web-search',
  queueWorker: '/system/health'
}

// Human-readable service names
export const SERVICE_NAMES = {
  aiProvider: 'AI Provider',
  imageEmbeddings: 'Image Embeddings',
  mediaServer: 'Media Server',
  radarr: 'Radarr',
  sonarr: 'Sonarr',
  tmdb: 'TMDB',
  omdb: 'OMDb',
  discordBot: 'Discord Bot',
  webhook: 'Webhook',
  tavily: 'Web Search',
  queueWorker: 'Queue Worker'
}
