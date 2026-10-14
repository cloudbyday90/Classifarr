/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Ephemeral test key, never a production credential or checked-in certificate. */
export async function gatewayTlsFixture(ip = '127.0.0.1') {
  const directory = await mkdtemp(join(tmpdir(), 'classifarr-gateway-tls-'));
  const close = () => rm(directory, { recursive: true, force: true });
  try {
    const config = join(directory, 'openssl.cnf');
    await writeFile(config, '[req]\ndistinguished_name=dn\n[dn]\n');
    execFileSync(process.env.OPENSSL_BIN || 'openssl', ['req', '-config', config, '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem'), '-days', '1',
      '-subj', '/CN=Classifarr synthetic fixture', '-addext', `subjectAltName=IP:${ip}`,
      '-addext', 'basicConstraints=critical,CA:TRUE'], { stdio: 'pipe', windowsHide: true, timeout: 10000 });
    const cert = await readFile(join(directory, 'cert.pem'), 'utf8'), key = await readFile(join(directory, 'key.pem'), 'utf8');
    return { cert, key, directory, close };
  } catch (error) { await close(); throw error; }
}
