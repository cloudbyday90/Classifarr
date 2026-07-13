/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import viteConfig from '../../vite.config.js'

const getOnLog = () => viteConfig.build.rolldownOptions.onLog

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
