/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Client, Server, ServerCredentials, credentials, status } from '@grpc/grpc-js';

const SECRET = 'synthetic-private-handler-detail';
const PAYLOAD = Buffer.from('ordinary-response');
const DEADLINE_MS = 2000;
const shapes = [
  { name: 'unary', requestStream: false, responseStream: false },
  { name: 'clientStream', requestStream: true, responseStream: false },
  { name: 'serverStream', requestStream: false, responseStream: true },
  { name: 'bidi', requestStream: true, responseStream: true },
];
const identity = value => value;

async function withRpc(shape, handler, run) {
  const server = new Server();
  let client;
  try {
    server.addService({
      check: {
        path: '/dependency.Security/Check', ...shape,
        requestSerialize: identity, requestDeserialize: identity,
        responseSerialize: identity, responseDeserialize: identity,
      },
    }, { check: handler });
    const port = await new Promise((resolve, reject) => {
      server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, boundPort) => {
        if (error) reject(error);
        else resolve(boundPort);
      });
    });
    client = new Client(`127.0.0.1:${port}`, credentials.createInsecure());
    await run(client);
  } finally {
    client?.close();
    server.forceShutdown();
  }
}

function request(client, shape) {
  const path = '/dependency.Security/Check';
  const options = { deadline: Date.now() + DEADLINE_MS };
  return new Promise((resolve, reject) => {
    const callback = (error, value) => {
      if (error) reject(error);
      else resolve(value);
    };
    if (!shape.requestStream && !shape.responseStream) {
      client.makeUnaryRequest(path, identity, identity, PAYLOAD, options, callback);
    } else if (shape.requestStream && !shape.responseStream) {
      const call = client.makeClientStreamRequest(path, identity, identity, options, callback);
      call.end(PAYLOAD);
    } else {
      const call = shape.requestStream
        ? client.makeBidiStreamRequest(path, identity, identity, options)
        : client.makeServerStreamRequest(path, identity, identity, PAYLOAD, options);
      const responses = [];
      call.on('data', value => responses.push(value));
      call.on('error', reject);
      call.on('end', () => resolve(Buffer.concat(responses)));
      if (shape.requestStream) call.end(PAYLOAD);
    }
  });
}

describe('gRPC handler error disclosure (GHSA-f596-whhp-79r4)', () => {
  test('does not opt in to upstream insecure debug error details', () => {
    expect(process.env.GRPC_NODE_DEBUG_SEND_ERROR_DETAILS).not.toBe('true');
  });

  describe.each(shapes)('$name', shape => {
    test.each([
      ['Error', () => new Error(SECRET)],
      ['message-bearing object', () => ({ message: SECRET })],
    ])('does not send thrown %s details over the wire', async (_label, makeError) => {
      await withRpc(shape, () => { throw makeError(); }, async client => {
        await expect(request(client, shape)).rejects.toMatchObject({
          code: status.UNKNOWN,
          details: 'Unknown error',
        });
      });
    });

    test('preserves successful responses', async () => {
      const handler = (call, callback) => {
        if (shape.requestStream) call.resume();
        if (shape.responseStream) {
          call.write(PAYLOAD);
          call.end();
        } else callback(null, PAYLOAD);
      };
      await withRpc(shape, handler, async client => {
        await expect(request(client, shape)).resolves.toEqual(PAYLOAD);
      });
    });

    test('preserves deliberately returned public application errors', async () => {
      const handler = (call, callback) => {
        if (shape.requestStream) call.resume();
        const error = { code: status.PERMISSION_DENIED, details: 'Public permission message' };
        if (shape.responseStream) call.emit('error', error);
        else callback(error);
      };
      await withRpc(shape, handler, async client => {
        await expect(request(client, shape)).rejects.toMatchObject({
          code: status.PERMISSION_DENIED, details: 'Public permission message',
        });
      });
    });
  });
});
