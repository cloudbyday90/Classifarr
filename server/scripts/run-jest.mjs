import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const jestPath = resolve(__dirname, '../node_modules/jest/bin/jest.js')
const args = process.argv.slice(2)

const nodeOptions = (process.env.NODE_OPTIONS || '')
  .split(' ')
  .filter(Boolean)

const sanitizedOptions = []
for (let i = 0; i < nodeOptions.length; i += 1) {
  const option = nodeOptions[i]
  if (option === '--localstorage-file') {
    i += 1
    continue
  }
  if (option.startsWith('--localstorage-file=')) {
    continue
  }
  sanitizedOptions.push(option)
}

if (!sanitizedOptions.includes('--no-experimental-webstorage')) {
  sanitizedOptions.push('--no-experimental-webstorage')
}

process.env.NODE_OPTIONS = sanitizedOptions.join(' ')

const child = spawn(process.execPath, [jestPath, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
