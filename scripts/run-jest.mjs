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
import { resolve } from 'node:path'

const serverDir = resolve(import.meta.dirname, '../server')
const serverRunJestScript = resolve(serverDir, 'scripts/run-jest.mjs')
const args = process.argv.slice(2)

const child = spawn(process.execPath, [serverRunJestScript, ...args], {
  cwd: serverDir,
  env: process.env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
