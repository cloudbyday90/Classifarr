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

const scripts = process.argv.slice(2)

if (scripts.length === 0) {
  console.error('[run-workspace-tests] Pass one or more npm script names to run.')
  process.exit(1)
}

function runScript(scriptName) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const command = process.platform === 'win32'
      ? `npm run ${scriptName}`
      : 'npm'
    const args = process.platform === 'win32'
      ? []
      : ['run', scriptName]
    const child = spawn(command, args, {
      shell: process.platform === 'win32',
      stdio: 'inherit',
      env: process.env,
    })

    child.on('exit', (code, signal) => {
      resolve({
        code: code ?? 1,
        durationMs: Date.now() - startedAt,
        scriptName,
        signal,
      })
    })
  })
}

const results = []

for (const scriptName of scripts) {
  // Keep running all requested suites so one failure does not hide the rest.
  // This makes root-level test runs more informative in mixed client/server repos.
  results.push(await runScript(scriptName))
}

const failed = results.filter((result) => result.code !== 0)

if (results.length > 1) {
  console.log('\n[run-workspace-tests] Summary')
  for (const result of results) {
    const seconds = (result.durationMs / 1000).toFixed(1)
    const outcome = result.code === 0 ? 'PASS' : `FAIL (${result.code})`
    console.log(`- ${result.scriptName}: ${outcome} in ${seconds}s`)
  }
}

process.exit(failed.length > 0 ? failed[0].code : 0)
