/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Shared base methods for Sonarr and Radarr service classes.
 * Exports a factory function that receives httpGet and a service name label
 * and returns an object with shared methods suitable for Object.assign in
 * the service constructor.
 */

export function createArrBaseMethods({ httpGet, serviceName }) {
  async function getRootFolders(url, apiKey) {
    try {
      const response = await httpGet(`${url}/api/v3/rootfolder`, {
        headers: { 'X-Api-Key': apiKey },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch root folders: ${error.message}`);
    }
  }

  async function getQualityProfiles(url, apiKey) {
    try {
      const response = await httpGet(`${url}/api/v3/qualityprofile`, {
        headers: { 'X-Api-Key': apiKey },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch quality profiles: ${error.message}`);
    }
  }

  async function getTags(url, apiKey) {
    try {
      const response = await httpGet(`${url}/api/v3/tag`, {
        headers: { 'X-Api-Key': apiKey },
      });
      return response.data.map((tag) => ({ id: tag.id, label: tag.label }));
    } catch (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }
  }

  async function validatePathInRootFolder(url, apiKey, destinationPath) {
    try {
      const rootFolders = await getRootFolders(url, apiKey);
      const normalizedDest = destinationPath.replace(/[/\\]+$/, '');

      for (const folder of rootFolders) {
        const normalizedRoot = folder.path.replace(/[/\\]+$/, '');
        if (
          normalizedDest.startsWith(normalizedRoot + '/') ||
          normalizedDest.startsWith(normalizedRoot + '\\') ||
          normalizedDest === normalizedRoot
        ) {
          return {
            isValid: true,
            matchedRootFolder: folder.path,
            freeSpace: folder.freeSpace,
            destinationPath,
          };
        }
      }

      return {
        isValid: false,
        availableRootFolders: rootFolders.map((f) => f.path),
        destinationPath,
        error: `Path "${destinationPath}" is not within any configured ${serviceName} root folder`,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to validate root folder: ${error.message}`,
        destinationPath,
      };
    }
  }

  return { getRootFolders, getQualityProfiles, getTags, validatePathInRootFolder };
}
