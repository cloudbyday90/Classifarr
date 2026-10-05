/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildReleasePublicationNotes, extractReleaseNotes } from '../../../../scripts/lib/releasePublicationNotes.mjs';

const tag = 'v0.49.0-beta';
const evidenceNotes = `# Classifarr ${tag}\n\n## Release evidence\n\nVerified digest.`;

describe('reviewed release publication notes', () => {
  test('keeps detailed prose before evidence and excludes older notes', () => {
    const releaseNotes = `# Notes\n\n## ${tag}\n\n### Changes\n\nDetailed changes.\n\n### Upgrade\n\nBack up first.\n\n---\n\n## v0.48.4-beta\n\nOld notes.`;
    expect(buildReleasePublicationNotes({ releaseNotes, tag, evidenceNotes })).toBe(
      `# Classifarr ${tag}\n\n### Changes\n\nDetailed changes.\n\n### Upgrade\n\nBack up first.\n\n---\n\n## Release evidence\n\nVerified digest.`
    );
  });

  test('accepts CRLF, BOM and a final release without an older heading', () => {
    expect(extractReleaseNotes(`\uFEFF# Notes\r\n\r\n## ${tag}\r\n\r\nNotes.\r\n`, tag)).toBe('Notes.');
  });

  test.each(['```', '~~~~'])('ignores heading-shaped examples inside %s fences', fence => {
    const body = `Notes.\n\n${fence}md\n## v9.9.9\n${fence}\n\nMore notes.`;
    expect(extractReleaseNotes(`# Notes\n\n## ${tag}\n\n${body}\n\n## v0.48.4-beta\nOld.`, tag)).toBe(body);
  });

  test.each([
    '', undefined, `# Notes\n## ${tag}\n`, `## ${tag}\n\n---`,
    `## ${tag}\n\n${'x'.repeat(60 * 1024 + 1)}`,
    `## ${tag}\n\nNotes\n\n\x60\x60\x60\nUnclosed fence.`,
    'x'.repeat(2 * 1024 * 1024 + 1),
  ])('rejects absent, empty, oversized or malformed notes (%#)', markdown => {
    expect(() => extractReleaseNotes(markdown, tag)).toThrow('release_notes_invalid');
  });

  test('does not fall back to a matching historical section', () => {
    expect(() => extractReleaseNotes(`## v0.50.0-beta\nNewer.\n## ${tag}\nOlder.`, tag)).toThrow('release_notes_version_mismatch');
  });

  test('rejects duplicate adjacent release headings', () => {
    expect(() => extractReleaseNotes(`## ${tag}\nNotes.\n## ${tag}\nOther.`, tag)).toThrow('release_notes_duplicate_version');
  });

  test('refuses evidence for another tag', () => {
    expect(() => buildReleasePublicationNotes({ releaseNotes: `## ${tag}\nNotes.`, tag,
      evidenceNotes: evidenceNotes.replace(tag, 'v0.48.4-beta') })).toThrow('release_notes_evidence_mismatch');
  });
});
