/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function createResolvedLoader(dependency) {
  return async () => dependency;
}

async function loadResolvedDependency(loader) {
  if (typeof loader !== 'function') {
    throw new TypeError('loadResolvedDependency requires a loader function');
  }

  const loaded = await loader();
  return loaded?.default ?? loaded;
}

export {
  createResolvedLoader,
  loadResolvedDependency,
};
