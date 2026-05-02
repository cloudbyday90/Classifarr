/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * LibraryProfileService
 * Generates and manages library profiles for classification scoring.
 * 
 * Library Profiles store statistical distributions of content in each library
 * and are used to score incoming items against what already exists.
 */

const libraryProfileServiceShared = require('./libraryProfileService.shared');

const {
    ALL_RATINGS,
    LibraryProfileService,
    createLibraryProfileService,
} = libraryProfileServiceShared;

const libraryProfileService = createLibraryProfileService();

module.exports = libraryProfileService;
module.exports.ALL_RATINGS = ALL_RATINGS;
module.exports.LibraryProfileService = LibraryProfileService;
module.exports.createLibraryProfileService = createLibraryProfileService;
