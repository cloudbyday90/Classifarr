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

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  resolvePolicyStorageClosureExecutionPlanSource,
} from './policyStorageClosureExecutionPlanSource.mjs';

function defaultFileExists(absolutePath) {
  // The source resolver admits only canonical repository-relative manifest paths.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- bounded read-only observation.
  return fs.existsSync(absolutePath);
}

function collectPolicyStorageClosurePathStateObservations({
  executionPlanArtifact = null,
  cwd = process.cwd(),
  fileExists = defaultFileExists,
} = {}) {
  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact,
  });
  const resolvedCwd = path.resolve(cwd);
  const observations = executionPlanSource.ok
    ? executionPlanSource.manifestPaths.map(repositoryPath => ({
      path: repositoryPath,
      exists: fileExists(path.resolve(resolvedCwd, repositoryPath)) === true,
    }))
    : [];

  return { executionPlanSource, observations };
}

export {
  collectPolicyStorageClosurePathStateObservations,
};
