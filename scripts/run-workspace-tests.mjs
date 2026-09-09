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

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const scriptFile = import.meta.filename
const NPM_SCRIPT_NAME = /^[A-Za-z0-9][A-Za-z0-9:_-]*$/u

function isDirectExecution() {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === scriptFile
}

/**
 * Creates a shell-free npm invocation. Windows requires cmd.exe to launch the
 * npm.cmd shim, so script names are restricted before being supplied to cmd.
 */
export function createNpmRunInvocation(scriptName, { platform = process.platform } = {}) {
  if (typeof scriptName !== 'string' || !NPM_SCRIPT_NAME.test(scriptName)) {
    throw new TypeError('Workspace test script names must contain only letters, numbers, colons, underscores, or hyphens.')
  }

  if (platform === 'win32') {
    return Object.freeze({
      command: 'cmd.exe',
      args: Object.freeze(['/d', '/s', '/c', 'npm.cmd', 'run', scriptName]),
    })
  }

  return Object.freeze({
    command: 'npm',
    args: Object.freeze(['run', scriptName]),
  })
}

export function runScript(scriptName, {
  now = Date.now,
  platform = process.platform,
  spawnProcess = spawn,
} = {}) {
  return new Promise((resolve) => {
    const startedAt = now()
    const invocation = createNpmRunInvocation(scriptName, { platform })
    let settled = false
    const settle = (code, signal = null) => {
      if (settled) return
      settled = true
      resolve({
        code: code ?? 1,
        durationMs: now() - startedAt,
        scriptName,
        signal,
      })
    }
    const child = spawnProcess(invocation.command, invocation.args, {
      shell: false,
      stdio: 'inherit',
      env: process.env,
    })

    child.once('error', () => settle(1))
    child.once('exit', settle)
  })
}

export async function runWorkspaceTests(scripts, options = {}) {
  if (!Array.isArray(scripts) || scripts.length === 0) {
    throw new TypeError('Pass one or more npm script names to run.')
  }

  const results = []

  for (const scriptName of scripts) {
    // Keep running all requested suites so one failure does not hide the rest.
    // This makes root-level test runs more informative in mixed client/server repos.
    results.push(await runScript(scriptName, options))
  }

  return Object.freeze(results)
}

export function summarizeResults(results) {
  const failed = results.filter((result) => result.code !== 0)

  if (results.length > 1) {
    console.log('\n[run-workspace-tests] Summary')
    for (const result of results) {
      const seconds = (result.durationMs / 1000).toFixed(1)
      const outcome = result.code === 0 ? 'PASS' : `FAIL (${result.code})`
      console.log(`- ${result.scriptName}: ${outcome} in ${seconds}s`)
    }
  }

  return failed.length > 0 ? failed[0].code : 0
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const results = await runWorkspaceTests(argv)
    return summarizeResults(results)
  } catch (error) {
    console.error(`[run-workspace-tests] ${error.message}`)
    return 1
  }
}

if (isDirectExecution()) {
  process.exit(await main())
}
