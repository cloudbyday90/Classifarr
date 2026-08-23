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

const scriptDir = import.meta.dirname
const npmCliPath = process.env.npm_execpath

if (!npmCliPath) {
  throw new Error('Run production policy-route asset checks through npm so npm_execpath is available.')
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    })

    child.on('error', rejectRun)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolveRun()
        return
      }

      rejectRun(new Error(`${command} ${args.join(' ')} exited with ${signal || `code ${code}`}`))
    })
  })
}

await run(process.execPath, [npmCliPath, 'run', 'build'])
await run(process.execPath, [
  resolve(scriptDir, 'run-playwright.mjs'),
  'test',
  '--config',
  'playwright.production.config.js',
])
