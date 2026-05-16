/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import { isAbsolute, normalize } from 'node:path';

import {
  buildDockerBindMountArg,
  buildSchemaCheckContainerLabelFilter,
  createSchemaCheckRunSpec,
  SCHEMA_CHECK_CONTAINER_LABEL,
} from '../../../scripts/check-schema-snapshot-container.mjs';

describe('schema snapshot container helpers', () => {
  test('creates unique container/data paths for schema checks', () => {
    const runSpec = createSchemaCheckRunSpec({
      prefix: 'classifarr-schema-check',
      suffix: 'run 1',
      tempRoot: '/tmp/classifarr',
    });

    expect(runSpec.containerName).toBe('classifarr-schema-check-run-1');
    expect(normalize(runSpec.hostDataPath)).toBe(
      normalize('/tmp/classifarr/classifarr-schema-check-data-run-1')
    );
  });

  test('builds docker bind-mount args without shell-style colon interpolation', () => {
    const defaultMountArg = buildDockerBindMountArg('/tmp/schema-check');
    const customMountArg = buildDockerBindMountArg('/tmp/schema-check', '/custom/data');

    expect(defaultMountArg).toContain('type=bind,src=');
    expect(defaultMountArg).toContain(',dst=/app/data');
    expect(defaultMountArg).not.toContain(':/app/data');
    expect(customMountArg).toContain(',dst=/custom/data');
    expect(isAbsolute(defaultMountArg.split('src=')[1].split(',dst=')[0])).toBe(true);
  });

  test('labels schema-check containers so stale verification runs can be purged safely', () => {
    expect(SCHEMA_CHECK_CONTAINER_LABEL).toBe('io.classifarr.role=schema-snapshot-check');
    expect(buildSchemaCheckContainerLabelFilter()).toBe(
      'label=io.classifarr.role=schema-snapshot-check'
    );
  });
});
