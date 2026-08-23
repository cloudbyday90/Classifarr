/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import viteConfig from '../../vite.config.js'

const getOnLog = () => viteConfig.build.rolldownOptions.onLog
const getCodeSplittingGroups = () => viteConfig.build.rolldownOptions.output.codeSplitting.groups
const getCodeSplittingGroup = name => getCodeSplittingGroups().find(group => group.name === name)

describe('Vite build warning policy', () => {
  it('allows only the two known VueUse invalid annotations', () => {
    const defaultHandler = vi.fn()

    getOnLog()('warn', {
      code: 'INVALID_ANNOTATION',
      id: 'C:/workspace/client/node_modules/@vueuse/core/dist/index.js',
      loc: { line: 3362, column: 1 },
      message: 'Known upstream VueUse annotation',
    }, defaultHandler)

    expect(defaultHandler).not.toHaveBeenCalled()
  })

  it('forwards a new VueUse invalid annotation to Vite', () => {
    const defaultHandler = vi.fn()
    const log = {
      code: 'INVALID_ANNOTATION',
      id: 'C:/workspace/client/node_modules/@vueuse/core/dist/index.js',
      loc: { line: 9999, column: 1 },
      message: 'Unexpected VueUse annotation',
    }

    getOnLog()('warn', log, defaultHandler)

    expect(defaultHandler).toHaveBeenCalledWith('warn', log)
  })

  it('forwards invalid annotations from every other dependency', () => {
    const defaultHandler = vi.fn()
    const log = {
      code: 'INVALID_ANNOTATION',
      id: 'C:/workspace/client/node_modules/other-package/index.js',
      loc: { line: 3362, column: 1 },
      message: 'Invalid third-party annotation',
    }

    getOnLog()('warn', log, defaultHandler)

    expect(defaultHandler).toHaveBeenCalledWith('warn', log)
  })

  it('forwards non-warning build logs unchanged', () => {
    const defaultHandler = vi.fn()
    const log = {
      code: 'PLUGIN_TIMINGS',
      message: 'Build timing report',
    }

    getOnLog()('info', log, defaultHandler)

    expect(defaultHandler).toHaveBeenCalledWith('info', log)
  })
})

describe('Vite route code-splitting policy', () => {
  it('uses Rolldown code splitting instead of deprecated manual chunks', () => {
    const output = viteConfig.build.rolldownOptions.output

    expect(output).toHaveProperty('codeSplitting')
    expect(output).not.toHaveProperty('manualChunks')
  })

  it('keeps vendor groups ahead of route groups', () => {
    expect(getCodeSplittingGroup('vue-vendor')).toMatchObject({ priority: 30 })
    expect(getCodeSplittingGroup('socket')).toMatchObject({ priority: 30 })
    expect(getCodeSplittingGroup('policy-authoring')).toMatchObject({ priority: 20 })
  })

  it('separates policy routes by their operator workflow on Windows paths', () => {
    const authoring = getCodeSplittingGroup('policy-authoring')
    const maintenance = getCodeSplittingGroup('policy-maintenance')
    const insights = getCodeSplittingGroup('policy-insights')

    expect(authoring.test('C:\\workspace\\client\\src\\views\\PolicyList.vue')).toBe(true)
    expect(authoring.test('C:\\workspace\\client\\src\\views\\PresetsManager.vue')).toBe(true)
    expect(maintenance.test('C:\\workspace\\client\\src\\views\\PolicyNativeIntentReconciliation.vue')).toBe(true)
    expect(maintenance.test('C:\\workspace\\client\\src\\views\\PolicyHistoricRouteSafetyRefresh.vue')).toBe(true)
    expect(insights.test('C:\\workspace\\client\\src\\views\\Evidence.vue')).toBe(true)
    expect(insights.test('C:\\workspace\\client\\src\\views\\PolicyList.vue')).toBe(false)
  })

  it('uses entry-aware recursive route groups to avoid loading unrelated lazy routes', () => {
    for (const name of ['rag-settings', 'settings-route', 'policy-authoring', 'policy-maintenance', 'policy-insights']) {
      expect(getCodeSplittingGroup(name)).toMatchObject({
        entriesAware: true,
        includeDependenciesRecursively: true,
      })
    }
  })
})
