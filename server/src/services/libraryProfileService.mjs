/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import libraryProfileServiceShared from './libraryProfileService.shared.js';

const {
	ALL_RATINGS,
	LibraryProfileService,
	createLibraryProfileService,
} = libraryProfileServiceShared;

const libraryProfileService = createLibraryProfileService();

export default libraryProfileService;
export {
	ALL_RATINGS,
	LibraryProfileService,
	createLibraryProfileService,
};
