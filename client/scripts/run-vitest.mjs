import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const vitestPath = resolve(__dirname, '../node_modules/vitest/vitest.mjs')
const args = process.argv.slice(2)

// Clean up NODE_OPTIONS - remove flags that can't be in NODE_OPTIONS
const nodeOptions = (process.env.NODE_OPTIONS || '')
  .split(' ')
  .filter(Boolean)
  .filter(opt => !opt.startsWith('--no-experimental-webstorage') && !opt.startsWith('--localstorage-file'))

process.env.NODE_OPTIONS = nodeOptions.join(' ')

// Just run vitest without experimental flags (not needed in Node 20)
const child = spawn(process.execPath, [vitestPath, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
