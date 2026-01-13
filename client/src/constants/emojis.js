/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
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

/**
 * Curated emoji options for custom presets
 * Organized into categories for better user experience
 */
export const EMOJI_OPTIONS = [
  {
    label: 'Movies',
    emojis: [
      { value: '🎬', label: 'Clapperboard' },
      { value: '🎞️', label: 'Film Frames' },
      { value: '🎥', label: 'Movie Camera' },
      { value: '📽️', label: 'Film Projector' }
    ]
  },
  {
    label: 'TV Shows',
    emojis: [
      { value: '📺', label: 'Television' },
      { value: '📡', label: 'Satellite' }
    ]
  },
  {
    label: 'Genres',
    emojis: [
      { value: '🎭', label: 'Theater Masks' },
      { value: '💥', label: 'Action' },
      { value: '😰', label: 'Thriller' },
      { value: '🔍', label: 'Mystery' },
      { value: '💕', label: 'Romance' },
      { value: '👻', label: 'Horror' },
      { value: '🤣', label: 'Comedy' },
      { value: '🧠', label: 'Psychological' },
      { value: '🦸', label: 'Superhero' },
      { value: '🌌', label: 'Sci-Fi' },
      { value: '🧟', label: 'Zombie' },
      { value: '🧛', label: 'Vampire' },
      { value: '🕵️', label: 'Spy' },
      { value: '💰', label: 'Heist' },
      { value: '🥋', label: 'Martial Arts' }
    ]
  },
  {
    label: 'Themes/Seasonal',
    emojis: [
      { value: '🎄', label: 'Christmas/Holiday' },
      { value: '🎃', label: 'Halloween' },
      { value: '🦃', label: 'Thanksgiving' },
      { value: '💘', label: "Valentine's" },
      { value: '🐰', label: 'Easter' },
      { value: '☀️', label: 'Summer' },
      { value: '❄️', label: 'Winter' }
    ]
  },
  {
    label: 'Quality/Awards',
    emojis: [
      { value: '⭐', label: 'Star' },
      { value: '🏆', label: 'Trophy' },
      { value: '🏅', label: 'Award' },
      { value: '💎', label: 'Gem' }
    ]
  },
  {
    label: 'General',
    emojis: [
      { value: '📁', label: 'Folder' },
      { value: '🎯', label: 'Target' },
      { value: '🔖', label: 'Bookmark' },
      { value: '📦', label: 'Package' }
    ]
  },
  {
    label: 'Regional (Flags)',
    emojis: [
      { value: '🇺🇸', label: 'USA' },
      { value: '🇬🇧', label: 'UK' },
      { value: '🇯🇵', label: 'Japan' },
      { value: '🇰🇷', label: 'Korea' },
      { value: '🇮🇳', label: 'India' },
      { value: '🇫🇷', label: 'France' },
      { value: '🌍', label: 'International' }
    ]
  },
  {
    label: 'Special Interest',
    emojis: [
      { value: '🎤', label: 'Stand-up/Music' },
      { value: '🎸', label: 'Music' },
      { value: '🍳', label: 'Food/Cooking' },
      { value: '��', label: 'Science' },
      { value: '📚', label: 'Documentary/Educational' },
      { value: '🙏', label: 'Faith/Spiritual' },
      { value: '👽', label: 'Conspiracy/UFO' }
    ]
  }
]

/**
 * Default emoji for new custom presets
 * Using clapperboard as default since this is a media classification app
 */
export const DEFAULT_EMOJI = '🎬'
