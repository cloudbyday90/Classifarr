/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
function text(value) {
  return String(value).replace(/[\r\n]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()!#|])/g, '\\$1');
}

export function formatMediaSyncRemediation(remediation) {
  if (!remediation) return '';
  let report = `### How to resolve\n\n${remediation.explanation}\n\n${remediation.scope}\n\n`;
  if (remediation.status === 'unavailable') report += 'Current item details could not be loaded. Refresh this report to retry.\n\n';
  if (remediation.status === 'no_current_records') report += 'No current matching unresolved records were found. They may have been repaired, removed or expired; this does not prove Plex is fixed.\n\n';
  for (const item of remediation.items) {
    const title = `${text(item.title)}${item.year ? ` (${item.year})` : ''}`;
    report += `- **${title}** — ${item.mediaType}; library: ${text(item.library)}. ${item.issue}\n`;
    report += item.plexUrl ? `  [Open ${title} in Plex](${item.plexUrl})\n` : '  Plex link is not available yet. Refreshing this report retries automatically.\n';
  }
  if (remediation.truncated) report += '\nOnly the first 50 retained items are shown. Later sync reports can expose remaining issues as these are resolved.\n';
  report += `\n${remediation.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n`;
  return report + `${remediation.recovery}\n\n${remediation.privacy}\n\n`;
}
