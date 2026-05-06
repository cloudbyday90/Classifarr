/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const srcRoot = path.resolve(__dirname, '../..')
const allowedDirectAxiosFiles = new Set([
  // Centralized API client is the only place direct axios usage is allowed.
  'api/index.js',
  'api/core.js',
  // Transport layer handles CSRF token injection and token refresh — requires direct axios.
  'api/apiTransport.js',
])

function collectSourceFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        continue
      }
      collectSourceFiles(fullPath, acc)
      continue
    }

    if (!['.vue', '.js', '.ts'].some(ext => entry.name.endsWith(ext))) {
      continue
    }

    if (entry.name.endsWith('.old.vue') || entry.name.endsWith('.old') || entry.name.includes('.old.')) {
      continue
    }

    acc.push(fullPath)
  }

  return acc
}

function toPosixRelative(filePath) {
  return path.relative(srcRoot, filePath).replaceAll('\\', '/')
}

describe('CSRF-safe client API usage', () => {
  it('prevents direct axios mutating calls outside shared API client', () => {
    const violations = []
    const sourceFiles = collectSourceFiles(srcRoot)
    const axiosImportRegex = /import\s+axios\s+from\s+['"]axios['"]/
    const axiosMutationRegex = /\baxios\.(post|put|patch|delete)\s*\(/
    const fetchMutationRegex = /fetch\s*\([\s\S]*?,\s*\{[\s\S]*?\bmethod\s*:\s*['"](POST|PUT|PATCH|DELETE)['"][\s\S]*?\}\s*\)/i

    for (const filePath of sourceFiles) {
      const relativePath = toPosixRelative(filePath)
      const source = fs.readFileSync(filePath, 'utf8')
      const isAllowlisted = allowedDirectAxiosFiles.has(relativePath)

      if (isAllowlisted) {
        continue
      }

      if (axiosImportRegex.test(source)) {
        violations.push(
          `${relativePath}: imports axios directly (use @/api shared client)`
        )
      }

      if (axiosMutationRegex.test(source)) {
        violations.push(
          `${relativePath}: uses axios mutating call outside shared API client`
        )
      }

      if (fetchMutationRegex.test(source)) {
        violations.push(
          `${relativePath}: uses fetch mutating call outside shared API client`
        )
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})
