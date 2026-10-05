/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertReleaseTag } from './releaseCandidateEvidence.mjs';

/** Select reviewed prose from the tagged checkout, never an older release. */
export function extractReleaseNotes(markdown, tag) {
  assertReleaseTag(tag);
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown) > 2 * 1024 * 1024) {
    throw new Error('release_notes_invalid');
  }
  const lines = markdown.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').split('\n');
  let fence = null;
  let start = -1;
  let end = lines.length;
  for (const [index, line] of lines.entries()) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (marker) { fence = marker[1]; continue; }
    if (!/^##\s/.test(line)) continue;
    if (start < 0) {
      if (line.trimEnd() !== `## ${tag}`) throw new Error('release_notes_version_mismatch');
      start = index + 1;
    } else {
      if (line.trimEnd() === `## ${tag}`) throw new Error('release_notes_duplicate_version');
      end = index;
      break;
    }
  }
  if (start < 0 || fence) throw new Error('release_notes_invalid');
  const body = lines.slice(start, end).join('\n').trim().replace(/\n---\s*$/, '').trim();
  if (!body || body === '---' || Buffer.byteLength(body) > 60 * 1024) throw new Error('release_notes_invalid');
  return body;
}

export function buildReleasePublicationNotes({ releaseNotes, tag, evidenceNotes }) {
  const body = extractReleaseNotes(releaseNotes, tag);
  const header = `# Classifarr ${tag}\n\n`;
  if (typeof evidenceNotes !== 'string' || !evidenceNotes.startsWith(`${header}## Release evidence\n`)) {
    throw new Error('release_notes_evidence_mismatch');
  }
  return `${header}${body}\n\n---\n\n${evidenceNotes.slice(header.length)}`;
}
