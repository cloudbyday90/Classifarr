/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readGatewayPrivateDocument } from '../ollamaGateway/privateDocument.mjs';
import { observeDockerProviderBoundary } from '../ollamaGateway/dockerBoundaryObserver.mjs';

const controller = new AbortController();
process.once('SIGINT',() => controller.abort()); process.once('SIGTERM',() => controller.abort());
// eslint-disable-next-line n/no-process-exit -- bound offline file/socket reads even during shutdown.
const deadline = setTimeout(() => { process.stderr.write('gateway_boundary_deadline\n'); process.exit(1); },15000);
try {
  const [action,...extra] = process.argv.slice(2);
  if (action !== 'inspect' || extra.length) throw new Error();
  const config = await readGatewayPrivateDocument(process.env.CLASSIFARR_GATEWAY_BOUNDARY_CONFIG_FILE);
  const observation = await observeDockerProviderBoundary(config,{ signal: controller.signal });
  process.stdout.write(`${JSON.stringify(observation)}\n`);
  // Exit zero means observation completed, never permission to recover.
  if (!['stopped','not_stopped'].includes(observation.observation)) process.exitCode = 1;
} catch {
  process.stderr.write('gateway_boundary_config_invalid\n'); process.exitCode = 1;
} finally { clearTimeout(deadline); }
