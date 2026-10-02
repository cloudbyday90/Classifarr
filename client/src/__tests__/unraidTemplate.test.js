/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const template = readFileSync(resolve(repositoryRoot, 'unraid/classifarr.xml'), 'utf8')
const dockerfile = readFileSync(resolve(repositoryRoot, 'Dockerfile'), 'utf8')

// This suite intentionally reads the shipped XML, not the Unraid-style Compose
// fixture. That fixture validates UID/GID compatibility, not command placement.
function readTemplate() {
  const document = new DOMParser().parseFromString(template, 'application/xml')
  expect(document.querySelector('parsererror')).toBeNull()
  expect(document.documentElement.tagName).toBe('Container')
  expect(document.documentElement.getAttribute('version')).toBe('2')
  return document.documentElement
}

function textOf(root, name) {
  const matches = [...root.children].filter(node => node.tagName === name)
  expect(matches, `exactly one ${name} field`).toHaveLength(1)
  return matches[0].textContent.trim()
}

describe('shipped Unraid template contract', () => {
  it('puts host mapping before the image and leaves the application command unset', () => {
    const root = readTemplate()
    expect(textOf(root, 'ExtraParams')).toBe('--add-host=host.docker.internal:host-gateway')
    expect(textOf(root, 'PostArgs')).toBe('')
  })

  it('retains the production startup entrypoint and default command', () => {
    const instructions = dockerfile.split(/\r?\n/).filter(line => /^(ENTRYPOINT|CMD)\s/.test(line))
    expect(instructions).toEqual([
      'ENTRYPOINT ["/sbin/tini", "--"]',
      'CMD ["/app/docker-entrypoint.sh"]',
    ])
  })

  it('preserves bridge networking, the image repository and unprivileged deployment', () => {
    const root = readTemplate()
    expect(textOf(root, 'Network')).toBe('bridge')
    expect(textOf(root, 'Privileged')).toBe('false')
    expect(textOf(root, 'Repository')).toBe('ghcr.io/cloudbyday90/classifarr:latest')
    expect(textOf(root, 'WebUI')).toBe('http://[IP]:[PORT:21324]')
    expect(template).not.toContain('docker.sock')
  })

  it('preserves required appdata and port mappings without requiring media mounts', () => {
    const root = readTemplate()
    const paths = [...root.querySelectorAll('Config[Type="Path"]')]
    const appdata = paths.filter(node => node.getAttribute('Target') === '/app/data')
    expect(appdata).toHaveLength(1)
    expect(appdata[0].getAttribute('Default')).toBe('/mnt/user/appdata/classifarr')
    expect(appdata[0].getAttribute('Mode')).toBe('rw')
    expect(appdata[0].getAttribute('Required')).toBe('true')
    for (const node of paths.filter(node => node !== appdata[0])) {
      expect(node.getAttribute('Required')).toBe('false')
    }
    const ports = [...root.querySelectorAll('Config[Type="Port"]')]
    expect(ports).toHaveLength(1)
    expect(ports[0].getAttribute('Target')).toBe('21324')
    expect(ports[0].getAttribute('Mode')).toBe('tcp')
  })

  it('keeps existing Unraid user/group defaults without requiring new settings', () => {
    const root = readTemplate()
    const variables = [...root.querySelectorAll('Config[Type="Variable"]')]
    expect(Object.fromEntries(variables.map(node => [node.getAttribute('Target'), node.getAttribute('Default')]))).toEqual({
      PUID: '99',
      PGID: '100',
      TZ: 'America/New_York',
      UMASK: '022',
      NODE_ENV: 'production',
    })
  })
})
