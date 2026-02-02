import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const vitestPath = resolve(__dirname, '../node_modules/vitest/vitest.mjs')
const args = process.argv.slice(2)

const child = spawn(process.execPath, [vitestPath, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
