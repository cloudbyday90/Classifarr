/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { IMAGE_INDEX_STUDY_PHASES, IMAGE_INDEX_STUDY_WAITS, studyIndexPhase } from './imageIndexStudyContract.mjs';
import { IMAGE_INDEXES } from '../services/imageIndexMaintenanceContract.mjs';

export async function readStudyProcessRss(pid, read = readFile) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    const text = await read(`/proc/${pid}/status`, 'utf8');
    const match = /^VmRSS:\s+(\d+) kB$/m.exec(text);
    const value = match ? Number(match[1]) * 1024 : null;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch { return null; } // A short-lived child may exit between observations.
}

export async function readStudyIndexActivity(query) {
  const rows = (await query(`SELECT p.phase,a.pid,a.wait_event_type FROM pg_stat_activity a
    LEFT JOIN pg_stat_progress_create_index p ON p.pid=a.pid
    WHERE a.datname=current_database() AND a.state='active' AND a.query=ANY($1::text[])`,
  [IMAGE_INDEXES.flatMap(index => [index.create, index.drop])])).rows;
  if (rows.length > 1) throw new Error('image_index_study_overlapping_ddl');
  return rows[0] ?? null;
}

export async function sampleStudyIndex(query, sampler, phase, workerPid) {
  const activity = await readStudyIndexActivity(query);
  const wait = activity?.wait_event_type ?? 'none';
  await sampler.sample(phase, { indexPhase: studyIndexPhase(activity?.phase),
    wait: IMAGE_INDEX_STUDY_WAITS.includes(wait) ? wait : 'other',
    workerBytes: await readStudyProcessRss(workerPid), postgresBytes: await readStudyProcessRss(activity?.pid) });
  return activity;
}

export function summarizeImageIndexSamples(samples) {
  const values = key => samples.map(row => row[key]).filter(Number.isFinite).sort((a, b) => a - b);
  const peak = key => values(key).at(-1) ?? null;
  const cpu = values('containerCores');
  return { samples: samples.length, containerPeakBytes: peak('containerBytes'), probePeakBytes: peak('rssBytes'),
    workerPeakBytes: peak('workerBytes'), postgresPeakBytes: peak('postgresBytes'),
    containerCpuP95: cpu[Math.ceil(cpu.length * 0.95) - 1] ?? null,
    phases: Object.fromEntries(IMAGE_INDEX_STUDY_PHASES.map(key => [key, samples.filter(row => row.indexPhase === key).length])),
    waits: Object.fromEntries(IMAGE_INDEX_STUDY_WAITS.map(key => [key, samples.filter(row => row.wait === key).length])) };
}
