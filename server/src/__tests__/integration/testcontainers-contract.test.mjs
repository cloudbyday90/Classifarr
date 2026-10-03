/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { ImageName, getContainerRuntimeClient } from 'testcontainers';
import { readRuntime } from './runtime.mjs';

const digest = `sha256:${'a'.repeat(64)}`;
const otherDigest = `sha256:${'b'.repeat(64)}`;
const deadline = () => AbortSignal.timeout(5_000);

describe('Testcontainers dependency contracts', () => {
  test.each([
    ['pgvector/pgvector:0.8.7-pg18', 'pgvector/pgvector', '0.8.7-pg18'],
    ['registry.example:5000/team/pgvector:0.8.7-pg18', 'team/pgvector', '0.8.7-pg18'],
  ])('retains tag and digest independently for %s', (tagged, image, tag) => {
    const reference = `${tagged}@${digest}`;
    const parsed = ImageName.fromString(reference);
    expect(parsed).toMatchObject({ image, tag, digest, string: reference });
    expect(parsed.equals(ImageName.fromString(reference))).toBe(true);
    expect(parsed.equals(ImageName.fromString(`${tagged}@${otherDigest}`))).toBe(false);
    expect(parsed.equals(ImageName.fromString(tagged))).toBe(false);
  });

  test.each([
    `pgvector/pgvector@${digest}`,
    'pgvector/pgvector:0.8.7-pg18',
    digest,
  ])('keeps existing reference spelling: %s', reference => {
    expect(ImageName.fromString(reference).string).toBe(reference);
  });

  test('closing a reader closes its real Docker log transport', async () => {
    const { container: client } = await getContainerRuntimeClient();
    const container = client.getById(readRuntime().containerId);
    let transport;
    let reader;
    try {
      // Wrap only the public Docker logs boundary to observe the actual transport.
      reader = await client.logs({
        id: container.id,
        logs: async options => {
          transport = await container.logs(options);
          return transport;
        },
      });
      const [chunk] = await once(reader, 'data', { signal: deadline() });
      expect(String(chunk).length).toBeGreaterThan(0);
      expect(transport.destroyed).toBe(false);
      const closed = once(transport, 'close', { signal: deadline() });
      reader.destroy();
      await closed;
      expect(transport.destroyed).toBe(true);
      expect((await client.inspect(container)).State.Running).toBe(true);
    } finally {
      reader?.destroy();
      transport?.destroy();
    }
  });

  test('early cancellation disposes a transport that attaches afterward', async () => {
    const { container: client } = await getContainerRuntimeClient();
    const transport = new PassThrough();
    const { promise, resolve } = Promise.withResolvers();
    let reader;
    try {
      reader = await client.logs({ id: 'synthetic-delayed-log-stream', logs: () => promise });
      const readerClosed = once(reader, 'close', { signal: deadline() });
      reader.destroy();
      await readerClosed;
      const transportClosed = once(transport, 'close', { signal: deadline() });
      resolve(transport);
      await transportClosed;
      expect(transport.destroyed).toBe(true);
    } finally {
      resolve(transport);
      reader?.destroy();
      transport.destroy();
    }
  });
});
