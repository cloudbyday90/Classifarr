/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const template = readFileSync(resolve(repositoryRoot, 'unraid/classifarr.xml'), 'utf8')
const dockerfile = readFileSync(resolve(repositoryRoot, 'Dockerfile'), 'utf8')
const profile = readFileSync(resolve(repositoryRoot, 'ca_profile.xml'), 'utf8')

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
    expect(textOf(root, 'Shell')).toBe('sh')
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

  it('offers unified or separate writable media mounts without guessing host paths', () => {
    const media = [...readTemplate().querySelectorAll('Config[Type="Path"]')]
      .filter(node => node.getAttribute('Target') !== '/app/data')
    expect(media.map(node => node.getAttribute('Target')).sort()).toEqual([
      '/data/media', '/data/movies', '/data/tv',
    ])
    for (const node of media) {
      expect(node.getAttribute('Mode')).toBe('rw')
      expect(node.getAttribute('Required')).toBe('false')
      expect(node.getAttribute('Default')).toBe('')
      expect(node.textContent.trim()).toBe('')
    }
  })

  it('has one canonical template and complete HTTPS submission metadata', () => {
    const root = readTemplate()
    expect(existsSync(resolve(repositoryRoot, 'templates/classifarr.xml'))).toBe(false)
    expect(textOf(root, 'TemplateURL')).toBe('https://raw.githubusercontent.com/cloudbyday90/Classifarr/main/unraid/classifarr.xml')
    expect(textOf(root, 'ReadMe')).toBe('https://github.com/cloudbyday90/Classifarr/blob/main/unraid/README.md')
    for (const field of ['TemplateURL', 'ReadMe', 'Icon', 'Support', 'Project', 'Registry']) {
      const url = new URL(textOf(root, field))
      expect(url.protocol).toBe('https:')
      expect(url.username).toBe('')
      expect(url.password).toBe('')
    }
    expect(textOf(root, 'License')).toBe('GPL-3.0-or-later')
    expect(textOf(root, 'Category')).toBe('MediaApp:Video Tools:')
  })

  it('describes the current beta line, movie/TV scope and optional AI concisely', () => {
    const root = readTemplate()
    expect(textOf(root, 'Beta')).toBe('true')
    expect(root.querySelectorAll('Branch')).toHaveLength(0)
    const overview = textOf(root, 'Overview')
    expect(overview.split(/\s+/).length).toBeLessThanOrEqual(100)
    expect(overview).toContain('movie and TV')
    expect(overview).toContain('Music is not supported')
    expect(overview).not.toMatch(/<[^>]+>|\[(?:br|b)\]/i)
    expect(textOf(root, 'Requires')).toContain('AI providers are optional')
    expect(textOf(root, 'Requires')).not.toMatch(/requires? (?:a )?separate Ollama/i)
    expect(textOf(root, 'Requires')).toContain('keep your saved appdata path, PUID/PGID and media mappings')
  })

  it('provides a valid root repository profile with real support and icon links', () => {
    const document = new DOMParser().parseFromString(profile, 'application/xml')
    expect(document.querySelector('parsererror')).toBeNull()
    const root = document.documentElement
    expect(root.tagName).toBe('CommunityApplications')
    expect(textOf(root, 'Profile').length).toBeGreaterThan(30)
    expect(textOf(root, 'WebPage')).toBe(textOf(readTemplate(), 'Project'))
    expect(textOf(root, 'Forum')).toBe(textOf(readTemplate(), 'Support'))
    expect(textOf(root, 'Icon')).toBe(textOf(readTemplate(), 'Icon'))
    expect(profile).not.toMatch(/YOUR_GITHUB_USERNAME|YOUR_REPO_NAME|YOUR_SUPPORT_TOPIC/)
  })

  it('keeps configuration entries unique, described and free of installation values', () => {
    const entries = [...readTemplate().querySelectorAll('Config')]
    const identities = entries.map(node => `${node.getAttribute('Type')}:${node.getAttribute('Target')}`)
    expect(new Set(identities).size).toBe(entries.length)
    for (const node of entries) {
      expect(node.getAttribute('Name')?.trim()).toBeTruthy()
      expect(node.getAttribute('Description')?.trim()).toBeTruthy()
      expect(node.textContent.trim()).toBe('')
    }
  })
})
