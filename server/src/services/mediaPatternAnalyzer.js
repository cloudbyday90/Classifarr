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

/**
 * Media Server Pattern Analyzer
 * 
 * Analyzes media server metadata patterns from detected content groups to generate
 * intelligent rule suggestions based on actual library organization.
 * 
 * Supports: Plex, Emby, Jellyfin
 */

const mediaPatternAnalyzerShared = require('./mediaPatternAnalyzer.shared');

const { MediaPatternAnalyzer, createMediaPatternAnalyzer } = mediaPatternAnalyzerShared;

const mediaPatternAnalyzer = createMediaPatternAnalyzer();

module.exports = mediaPatternAnalyzer;
module.exports.MediaPatternAnalyzer = MediaPatternAnalyzer;
module.exports.createMediaPatternAnalyzer = createMediaPatternAnalyzer;
