import { describe, expect, it } from '@jest/globals'

import {
  collectExplicitTestTargets,
  integrationConfigPath,
  isIntegrationTestPath,
  resolveJestArgs,
} from '../../scripts/run-jest.mjs'

describe('run-jest argument resolution', () => {
  it('detects integration test paths across relative and absolute forms', () => {
    expect(isIntegrationTestPath('src/__tests__/integration/sync-lock.test.js')).toBe(true)
    expect(isIntegrationTestPath('C:\\repo\\server\\src\\__tests__\\integration\\sync-lock.test.js')).toBe(true)
    expect(isIntegrationTestPath('src/__tests__/classification.test.js')).toBe(false)
  })

  it('collects explicit targets from runTestsByPath invocations', () => {
    expect(
      collectExplicitTestTargets([
        '--runTestsByPath',
        'src/__tests__/integration/sync-lock.test.js',
        'src/__tests__/integration/sync-404-handling.test.js',
        '--no-coverage',
      ])
    ).toEqual([
      'src/__tests__/integration/sync-lock.test.js',
      'src/__tests__/integration/sync-404-handling.test.js',
    ])
  })

  it('auto-selects the integration config for integration-only targeted runs', () => {
    expect(
      resolveJestArgs([
        '--runTestsByPath',
        'src/__tests__/integration/sync-lock.test.js',
        '--no-coverage',
      ])
    ).toEqual([
      '-c',
      integrationConfigPath,
      '--runTestsByPath',
      'src/__tests__/integration/sync-lock.test.js',
      '--no-coverage',
    ])
  })

  it('fails fast when unit and integration paths are mixed in one targeted run', () => {
    expect(() =>
      resolveJestArgs([
        '--runTestsByPath',
        'src/__tests__/libraries-routes.coverage.test.js',
        'src/__tests__/integration/sync-lock.test.js',
      ])
    ).toThrow(
      'Cannot mix integration and non-integration test paths in one run. Split the command or rerun the integration files with -c jest.integration.config.js.'
    )
  })
})
