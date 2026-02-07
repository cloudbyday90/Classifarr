/*
 * Issue 285 Execution Library
 * Deterministic helpers for dataset export, pair building, evaluation, packaging.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createGzip } from 'node:zlib';

export function nowIsoUtc() {
  return new Date().toISOString();
}

export async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

export function stableStringify(value) {
  // Stable JSON stringify for metadata (keys sorted recursively).
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function sha256Hex(input) {
  const h = crypto.createHash('sha256');
  h.update(input);
  return h.digest('hex');
}

export async function sha256FileHex(filePath) {
  return await new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => h.update(chunk));
    stream.on('end', () => resolve(h.digest('hex')));
  });
}

export function mulberry32(seed) {
  // Deterministic RNG for reproducible sampling.
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseIntStrict(value, name) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid int for ${name}: ${value}`);
  return n;
}

export function parseFloatStrict(value, name) {
  const n = Number.parseFloat(String(value));
  if (!Number.isFinite(n)) throw new Error(`Invalid float for ${name}: ${value}`);
  return n;
}

export function parseArgs(argv, spec) {
  // Minimal flag parser:
  // spec: { flagName: { type: 'string'|'int'|'float'|'bool', default, required } }
  const out = {};
  const args = [...argv];

  for (const [k, v] of Object.entries(spec)) {
    if (Object.prototype.hasOwnProperty.call(v, 'default')) out[k] = v.default;
  }

  while (args.length > 0) {
    const token = args.shift();
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected arg: ${token}`);
    }
    const key = token.slice(2);
    if (!(key in spec)) {
      throw new Error(`Unknown flag: --${key}`);
    }
    const type = spec[key].type;
    if (type === 'bool') {
      out[key] = true;
      continue;
    }
    const next = args.shift();
    if (next === undefined) throw new Error(`Missing value for --${key}`);
    if (type === 'int') out[key] = parseIntStrict(next, key);
    else if (type === 'float') out[key] = parseFloatStrict(next, key);
    else out[key] = String(next);
  }

  for (const [k, v] of Object.entries(spec)) {
    if (v.required && (out[k] === undefined || out[k] === null || out[k] === '')) {
      throw new Error(`Missing required flag: --${k}`);
    }
  }
  return out;
}

export async function writeJson(filePath, obj) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

export async function writeText(filePath, text) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, text, 'utf8');
}

export async function writeJsonl(filePath, rows) {
  await ensureDir(path.dirname(filePath));
  const lines = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  await fsp.writeFile(filePath, lines, 'utf8');
}

export async function readJson(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function readJsonl(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  return raw
    .split(/\r?\n/g)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => JSON.parse(l));
}

export function extractNames(items, limit) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items
    .slice(0, limit)
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.name || item.title || null;
      return null;
    })
    .filter(Boolean);
}

export function safeGet(obj, dottedPath, defaultValue = null) {
  if (!obj) return defaultValue;
  const keys = dottedPath.split('.');
  let cur = obj;
  for (const k of keys) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return defaultValue;
    cur = cur[k];
  }
  return cur === undefined ? defaultValue : cur;
}

export function formatEmbeddingTextV2(metadata, opts = {}) {
  // Mirrors server/src/services/embeddingService.js formatForEmbedding()
  // but allows excluding "Classified: ..." for query-like text.
  const includeClassified = Boolean(opts.includeClassified);
  const parts = [];

  if (metadata?.title) parts.push(`Title: ${metadata.title}`);
  if (metadata?.year) parts.push(`Year: ${metadata.year}`);

  const mt = metadata?.media_type;
  if (mt) parts.push(`Type: ${mt === 'movie' ? 'Movie' : 'TV Series'}`);

  const genres = extractNames(metadata?.genres, 5);
  if (genres.length) parts.push(`Genres: ${genres.join(', ')}`);

  const certification = safeGet(metadata, 'certification') ?? safeGet(metadata, 'content_rating');
  if (certification) parts.push(`Rating: ${certification}`);

  if (metadata?.original_language) parts.push(`Language: ${metadata.original_language}`);

  const studios = extractNames(safeGet(metadata, 'production_companies', []), 3);
  if (studios.length) parts.push(`Studio: ${studios.join(', ')}`);

  const collection = safeGet(metadata, 'belongs_to_collection');
  if (collection) {
    const name = typeof collection === 'object' ? collection.name : collection;
    if (name) parts.push(`Franchise: ${name}`);
  }

  const cast = extractNames(safeGet(metadata, 'cast', []), 3);
  if (cast.length) parts.push(`Cast: ${cast.join(', ')}`);

  const keywords = extractNames(metadata?.keywords, 8);
  if (keywords.length) parts.push(`Keywords: ${keywords.join(', ')}`);

  const voteAverage = safeGet(metadata, 'vote_average');
  if (voteAverage !== null && voteAverage !== undefined && !Number.isNaN(Number.parseFloat(voteAverage))) {
    parts.push(`Score: ${Number.parseFloat(voteAverage).toFixed(1)}/10`);
  }

  if (includeClassified && metadata?.library_name) {
    parts.push(`Classified: ${metadata.library_name}`);
  }

  if (metadata?.overview) {
    const o = String(metadata.overview);
    const truncated = o.length > 300 ? `${o.slice(0, 300)}...` : o;
    parts.push(`Synopsis: ${truncated}`);
  }

  return parts.join(' | ').trim();
}

function writeOctal(buf, offset, length, value) {
  // Tar header numeric fields are octal ASCII, typically NUL-terminated.
  const s = value.toString(8);
  const padded = s.padStart(length - 1, '0').slice(- (length - 1));
  buf.write(padded, offset, length - 1, 'ascii');
  buf[offset + length - 1] = 0; // NUL terminator
}

function tarHeader({ name, size, typeflag, mode, mtime }) {
  // Minimal USTAR header for reproducible archives.
  // https://www.gnu.org/software/tar/manual/html_node/Standard.html
  const header = Buffer.alloc(512, 0);

  const normalized = name.replace(/\\/g, '/');
  let n = normalized;
  let prefix = '';

  if (Buffer.byteLength(n, 'utf8') > 100) {
    // Split into prefix/name if possible (max 155/100).
    const idx = n.lastIndexOf('/');
    if (idx <= 0) {
      throw new Error(`Path too long for tar header (no prefix split): ${n}`);
    }
    prefix = n.slice(0, idx);
    n = n.slice(idx + 1);
    if (Buffer.byteLength(n, 'utf8') > 100 || Buffer.byteLength(prefix, 'utf8') > 155) {
      throw new Error(`Path too long for tar header: ${normalized}`);
    }
  }

  header.write(n, 0, 100, 'utf8');
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0); // uid
  writeOctal(header, 116, 8, 0); // gid
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, mtime);

  // checksum field is initially spaces.
  header.fill(0x20, 148, 156);

  header.write(String(typeflag || '0')[0], 156, 1, 'ascii');

  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');

  if (prefix) header.write(prefix, 345, 155, 'utf8');

  // Compute checksum.
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  const chk = sum.toString(8).padStart(6, '0');
  header.write(chk, 148, 6, 'ascii');
  header[154] = 0; // NUL
  header[155] = 0x20; // space

  return header;
}

async function writeToStream(stream, buf) {
  if (buf.length === 0) return;
  if (stream.write(buf)) return;
  await new Promise((resolve, reject) => {
    stream.once('drain', resolve);
    stream.once('error', reject);
  });
}

async function streamFileToStream(filePath, outStream) {
  const rs = fs.createReadStream(filePath);
  try {
    for await (const chunk of rs) {
      await writeToStream(outStream, chunk);
    }
  } finally {
    try { rs.destroy(); } catch {}
  }
}

export async function deterministicTarGzDirectory(srcDir, outTarGzPath) {
  // Create a deterministic .tar.gz without relying on system tar behavior.
  // Rules:
  // - File order: sorted lexicographically by POSIX relative path.
  // - Header metadata: uid/gid=0, mtime=0, fixed mode (dirs 755, files 644).
  // - gzip header mtime=0.
  const root = path.resolve(srcDir);
  await ensureDir(path.dirname(outTarGzPath));

  const outStream = fs.createWriteStream(outTarGzPath);
  const gzip = createGzip({ level: 9, mtime: 0 });
  gzip.pipe(outStream);

  const entries = [];

  async function walk(absDir, relDir) {
    const dirents = await fsp.readdir(absDir, { withFileTypes: true });
    dirents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const d of dirents) {
      const abs = path.join(absDir, d.name);
      const rel = relDir ? `${relDir}/${d.name}` : d.name;
      if (d.isSymbolicLink()) {
        throw new Error(`Symlinks are not supported for packaging: ${rel}`);
      }
      if (d.isDirectory()) {
        entries.push({ kind: 'dir', rel });
        await walk(abs, rel);
      } else if (d.isFile()) {
        entries.push({ kind: 'file', rel, abs });
      }
    }
  }

  await walk(root, '');
  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  try {
    // Ensure top-level "." directory exists in archive viewers (optional but harmless).
    await writeToStream(gzip, tarHeader({ name: './', size: 0, typeflag: '5', mode: 0o755, mtime: 0 }));

    for (const e of entries) {
      if (e.kind === 'dir') {
        const dirName = `${e.rel.replace(/\\/g, '/')}/`;
        await writeToStream(gzip, tarHeader({ name: dirName, size: 0, typeflag: '5', mode: 0o755, mtime: 0 }));
        continue;
      }

      const st = await fsp.stat(e.abs);
      const size = Number(st.size);
      await writeToStream(gzip, tarHeader({ name: e.rel, size, typeflag: '0', mode: 0o644, mtime: 0 }));
      await streamFileToStream(e.abs, gzip);

      const pad = (512 - (size % 512)) % 512;
      if (pad) await writeToStream(gzip, Buffer.alloc(pad, 0));
    }

    // Two 512-byte blocks of zeros mark end-of-archive.
    await writeToStream(gzip, Buffer.alloc(1024, 0));

    await new Promise((resolve, reject) => {
      outStream.on('error', reject);
      gzip.on('error', reject);
      outStream.on('close', resolve);
      gzip.end();
    });
  } catch (e) {
    // Best-effort cleanup of partially written file.
    try { outStream.destroy(); } catch {}
    try { gzip.destroy(); } catch {}
    try { await fsp.unlink(outTarGzPath); } catch {}
    throw e;
  }
}

