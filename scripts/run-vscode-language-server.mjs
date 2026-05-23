/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const PACKAGE_NAME = 'vscode-langservers-extracted'
const PACKAGE_VERSION = '4.10.0'
const SUPPORTED_BINS = new Set([
  'vscode-css-language-server',
  'vscode-json-language-server',
  'vscode-eslint-language-server',
])

function getInstallDir() {
  return resolve(import.meta.dirname, '..', '.tmp', 'tools', PACKAGE_NAME, PACKAGE_VERSION)
}

function getPackageJsonPath() {
  return resolve(getInstallDir(), 'node_modules', PACKAGE_NAME, 'package.json')
}

function getLockPath() {
  return resolve(getInstallDir(), '.install.lock')
}

function getBinPath(binName) {
  return resolve(getInstallDir(), 'node_modules', PACKAGE_NAME, 'bin', binName)
}

async function ensureInstalled() {
  try {
    await access(getPackageJsonPath(), constants.F_OK)
    return
  } catch {
    // Install below.
  }

  const installDir = getInstallDir()
  const lockPath = getLockPath()
  await mkdir(installDir, { recursive: true })

  const manifestPath = resolve(installDir, 'package.json')
  try {
    await access(manifestPath, constants.F_OK)
  } catch {
    await writeFile(manifestPath, JSON.stringify({ private: true }, null, 2))
  }

  try {
    await writeFile(lockPath, String(process.pid), { flag: 'wx' })
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error
    }

    for (let attempt = 0; attempt < 240; attempt += 1) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
      try {
        await access(getPackageJsonPath(), constants.F_OK)
        return
      } catch {
        // Continue waiting for the other process to finish installing.
      }
    }

    throw new Error('Timed out waiting for vscode language server package installation lock')
  }

  try {
    await new Promise((resolvePromise, rejectPromise) => {
      const child = process.platform === 'win32'
        ? spawn('cmd.exe', ['/d', '/s', '/c', `npm install --no-save ${PACKAGE_NAME}@${PACKAGE_VERSION}`], {
            cwd: installDir,
            env: process.env,
            stdio: 'inherit',
          })
        : spawn('npm', ['install', '--no-save', `${PACKAGE_NAME}@${PACKAGE_VERSION}`], {
            cwd: installDir,
            env: process.env,
            stdio: 'inherit',
          })

      child.on('exit', (code) => {
        if (code === 0) {
          resolvePromise()
          return
        }
        rejectPromise(new Error(`npm install exited with code ${code ?? 1}`))
      })
    })
  } finally {
    await rm(lockPath, { force: true }).catch(() => {})
  }
}

async function main() {
  const [binName, ...args] = process.argv.slice(2)
  if (!SUPPORTED_BINS.has(binName)) {
    throw new Error(`Unsupported vscode language server binary: ${binName || '(missing)'}`)
  }

  await ensureInstalled()

  const child = spawn(process.execPath, [getBinPath(binName), ...args], {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })
}

main().catch((error) => {
  console.error(`[run-vscode-language-server] ${error.message}`)
  process.exit(1)
})
