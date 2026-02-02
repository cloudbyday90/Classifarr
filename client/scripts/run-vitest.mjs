import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const vitestPath = resolve(__dirname, '../node_modules/vitest/vitest.mjs')
const args = process.argv.slice(2)

// jsdom 28.0.0+ no longer requires --no-experimental-webstorage flag
// The flag is not supported in Node.js 20.19.0+ which is required by jsdom 28.0.0
const nodeOptions = (process.env.NODE_OPTIONS || '')
  .split(' ')
  .filter(Boolean)

process.env.NODE_OPTIONS = nodeOptions.join(' ')

const child = spawn(process.execPath, [vitestPath, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
