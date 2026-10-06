/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ROLLUP_FIELDS, CGROUP_FIELDS } from '../../server/src/scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
function numbers(value, keys) {
  const result = {};
  if (object(value)) for (const key of keys) {
    if (Number.isSafeInteger(value[key]) && value[key] >= 0) result[key] = value[key];
  }
  return Object.keys(result).length ? result : undefined;
}

/** Explicit numeric projection; never retain process identities or raw kernel text. */
export function projectComparisonResident(value) {
  if (!object(value) || ![1, 2].includes(value.cgroupVersion) ||
      !['complete', 'partial', 'unavailable'].includes(value.status)) return undefined;
  const result = { status: value.status, cgroupVersion: value.cgroupVersion,
    ...numbers(value, ['durationMs']) };
  const cgroup = numbers(value.cgroup, CGROUP_FIELDS[value.cgroupVersion]);
  const self = numbers(value.self, Object.values(ROLLUP_FIELDS));
  if (cgroup) result.cgroup = cgroup;
  if (self) result.self = self;
  const processes = numbers(value.processes, ['listed', 'measured', 'unavailable']);
  if (processes && Object.keys(processes).length === 3 && processes.listed <= 128 &&
      processes.measured + processes.unavailable === processes.listed) {
    for (const key of ['postgres', 'other']) {
      const group = numbers(value.processes[key], ['count', 'rssBytes', 'pssBytes']);
      if (group && Object.keys(group).length === 3 && group.count <= processes.measured) processes[key] = group;
    }
    result.processes = processes;
  }
  if (result.status === 'complete' && (!cgroup || !self || self.rssBytes === undefined || self.pssBytes === undefined ||
      !processes?.postgres || !processes.other || processes.unavailable !== 0 ||
      processes.measured !== processes.postgres.count + processes.other.count + 1 ||
      (value.cgroupVersion === 1 ? cgroup.total_rss === undefined || cgroup.total_cache === undefined
        : cgroup.anon === undefined || cgroup.file === undefined))) return undefined;
  return result;
}
