/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { studyIo,studyCpu } from './studyResource.mjs';
import { parseQualificationPressure } from './archiveQualificationProbe.mjs';

const memoryKeys = {
  1:['total_rss','total_cache','total_inactive_file','total_dirty','total_writeback','total_pgfault','total_pgmajfault','total_pgpgin','total_pgpgout'],
  2:['anon','file','inactive_file','file_dirty','file_writeback','pgfault','pgmajfault','pgscan','pgsteal','workingset_refault_file'],
};
const unsigned = value => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw Error('pressure_counter_invalid');
  return Number(value);
};
export function pressureMemory(text,version) {
  if (![1,2].includes(version) || typeof text !== 'string' || Buffer.byteLength(text)>65536) throw Error('pressure_counter_invalid');
  const values={};
  for (const line of text.trim().split('\n')) {
    const [key,value,...extra]=line.trim().split(/\s+/);
    if (!memoryKeys[version].includes(key)) continue;
    if (Object.hasOwn(values,key) || extra.length) throw Error('pressure_counter_invalid');
    values[key]=unsigned(value);
  }
  if (!Object.keys(values).length) throw Error('pressure_counter_invalid');
  return values;
}
export function pressureIo(text,version) {
  if (![1,2].includes(version) || typeof text!=='string' || Buffer.byteLength(text)>65536) throw Error('pressure_counter_invalid');
  const seen=new Set(),devices=new Map();let total;
  for (const line of text.trim().split('\n').filter(Boolean)) {
    const [device,...parts]=line.trim().split(/\s+/);
    if (version===1 && device==='Total') {
      if (seen.has('Total') || parts.length!==1) throw Error('pressure_counter_invalid');
      total=unsigned(parts[0]);seen.add('Total');continue;
    }
    if (!/^\d+:\d+$/.test(device)) throw Error('pressure_counter_invalid');
    if (version===2 && devices.has(device)) throw Error('pressure_counter_invalid');
    const keys=devices.get(device) ?? new Set();devices.set(device,keys);
    const entries=version===1 ? [parts] : parts.map(part=>part.split('='));
    for (const [key,value,...extra] of entries) {
      if (keys.has(key) || extra.length) throw Error('pressure_counter_invalid');
      unsigned(value);keys.add(key);
    }
  }
  for (const keys of devices.values()) for (const key of version===1 ? ['Read','Write'] : ['rbytes','wbytes']) {
    if (!keys.has(key)) throw Error('pressure_counter_invalid');
  }
  if (!devices.size && total>0) throw Error('pressure_counter_invalid');
  // A readable empty file means no attributed device rows, not no physical I/O.
  return studyIo(text,version);
}
export function pressureCpu(text,version) {
  if (![1,2].includes(version) || typeof text!=='string' || Buffer.byteLength(text)>65536) throw Error('pressure_counter_invalid');
  const keys=new Set();
  for (const line of text.trim().split('\n')) {
    const [key,value,...extra]=line.trim().split(/\s+/);
    if (!/^[a-z_]+$/.test(key) || keys.has(key) || extra.length) throw Error('pressure_counter_invalid');
    unsigned(value);keys.add(key);
  }
  const values=studyCpu(text,version);
  if (!Object.keys(values).length) throw Error('pressure_counter_invalid');return values;
}
const reason = error => error?.code==='ENOENT' ? 'absent' : ['EACCES','EPERM'].includes(error?.code) ? 'denied' :
  error?.message==='pressure_budget' ? 'budget_exhausted' : error?.message==='pressure_counter_invalid' ? 'invalid' : 'read_failed';

/** Fixed paths only, no discovery, mutation, raw paths/errors or overlapping sums. */
export function createPressureAccounting({version,read,now=()=>performance.now()}) {
  if (![1,2].includes(version)) throw Error('pressure_version_invalid');
  const root=version===2 ? '/sys/fs/cgroup' : '/sys/fs/cgroup/memory';
  return async()=>{
    const started=now(), result={version,interfaces:{}};
    const collect=async(name,candidates,parse)=>{
      const attempts=[];
      for (const [interfaceName,path] of candidates) {
        let raw;
        try {
          if (now()-started>=100) throw Error('pressure_budget');
          raw=await read(path);
        } catch(error) {attempts.push({interface:interfaceName,status:reason(error)});continue;}
        try {
          if (typeof raw!=='string' || Buffer.byteLength(raw)>65536) throw Error('pressure_counter_invalid');
          const values=parse(raw);
          result.interfaces[name]={status:'available',interface:interfaceName,values,attempts}; return;
        } catch { attempts.push({interface:interfaceName,status:'invalid'}); }
      }
      result.interfaces[name]={status:'unavailable',attempts};
    };
    await collect('memory',[[`v${version}_memory`,`${root}/memory.stat`]],text=>pressureMemory(text,version));
    await collect('pressure',[[`v${version}_pressure`,`${root}/memory.pressure`]],parseQualificationPressure);
    await collect('io',version===2 ? [['v2_io','/sys/fs/cgroup/io.stat']] : [
      ['v1_throttle','/sys/fs/cgroup/blkio/blkio.throttle.io_service_bytes'],
      ['v1_service','/sys/fs/cgroup/blkio/blkio.io_service_bytes'],
      ['v1_service_recursive','/sys/fs/cgroup/blkio/blkio.io_service_bytes_recursive'],
    ],text=>pressureIo(text,version));
    await collect('cpu',version===2 ? [['v2_cpu','/sys/fs/cgroup/cpu.stat']] : [
      ['v1_cpu','/sys/fs/cgroup/cpu/cpu.stat'],['v1_cpu_combined','/sys/fs/cgroup/cpu,cpuacct/cpu.stat'],
    ],text=>pressureCpu(text,version));
    result.durationMs=Math.max(0,now()-started); return result;
  };
}

export function pressureDelta(before,after) {
  const result={};
  for (const name of ['memory','pressure','io','cpu']) {
    const first=before?.interfaces?.[name],last=after?.interfaces?.[name];
    if (before?.version!==after?.version || first?.status!=='available' || last?.status!=='available' || first.interface!==last.interface) {
      result[name]={status:'unavailable'};continue;
    }
    const values={};let reset=false;
    // Memory values include gauges. Only fixed event counters have meaningful deltas.
    for (const [key,value] of Object.entries(first.values)) {
      if (name==='memory' && !/^(?:total_)?(?:pgfault|pgmajfault|pgpgin|pgpgout|pgscan|pgsteal|workingset_refault_file)$/.test(key)) continue;
      if (!Number.isFinite(last.values[key])) continue;
      if (last.values[key]<value) reset=true;else values[key]=last.values[key]-value;
    }
    result[name]=reset ? {status:'counter_reset'} : {status:'available',interface:first.interface,values};
  }
  return result;
}
