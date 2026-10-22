/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { creationJournalLimits, encodeCreationJournalRecord, decodeCreationJournal } from '../lib/creationJournalFrames.mjs';
import { CREATION_JOURNAL_WRITER_QUERY } from '../lib/creationJournalWriterSource.mjs';
import { qualifyJournal } from './fixtures/creationJournalQualification.mjs';

const row = (sequence = 0, patch = {}) => ({ version: 1, sequence, source: 'a'.repeat(64), plan: 'b'.repeat(64),
  kind: sequence === 0 ? 'intent' : 'identity', identity: 'fictional-resource-1', ...patch });
const windows = { skip: process.platform !== 'win32' };
const rejects = fn => assert.throws(fn, { message: 'creation_journal_invalid' });
const frames = [0, 1, 2].map(sequence => encodeCreationJournalRecord(row(sequence)));
function opaqueFrame(payload) {
  const frame = Buffer.alloc(payload.length + 37); frame.writeUInt32LE(payload.length); payload.copy(frame, 36);
  createHash('sha256').update(payload).digest().copy(frame, 4); frame[frame.length - 1] = 10; return frame;
}
function largeFrame() {
  // Opaque native frame-budget fixture, intentionally not a valid semantic JSON record.
  const frame = Buffer.alloc(65536, 120); frame.writeUInt32LE(frame.length - 37); frame[frame.length - 1] = 10;
  createHash('sha256').update(frame.subarray(36, -1)).digest().copy(frame, 4); return frame;
}

test('canonical framed private records round-trip; a prefix grants no completion or native authority', () => {
  const decoded = decodeCreationJournal(Buffer.concat(frames), row());
  assert.deepEqual(decoded, [0, 1, 2].map(sequence => row(sequence)));
  assert.ok(Object.isFrozen(decoded) && decoded.every(Object.isFrozen));
  assert.equal(decodeCreationJournal(frames[0], row()).length, 1);
  assert.deepEqual(creationJournalLimits, { records: 32, recordBytes: 65536, totalBytes: 524288 });
});

test('truncation, corrupt hash, oversized lengths, sequence and binding drift refuse the entire read', () => {
  for (let cut = 0; cut < frames[0].length; cut++) rejects(() => decodeCreationJournal(frames[0].subarray(0, cut), row()));
  const corrupt = Buffer.from(frames[0]); corrupt[40] ^= 1;
  const huge = Buffer.from(frames[0]); huge.writeUInt32LE(65536);
  for (const bytes of [corrupt, huge, Buffer.concat([frames[0], frames[0]]), Buffer.concat([frames[0], frames[1], Buffer.from([0])]),
    Buffer.concat([frames[0], encodeCreationJournalRecord(row(1, { source: 'c'.repeat(64) }))]),
    Buffer.concat([frames[0], encodeCreationJournalRecord(row(1, { identity: 'fictional-other' }))]),
    Buffer.concat([frames[0], encodeCreationJournalRecord(row(1, { plan: 'c'.repeat(64) }))]),
    Buffer.alloc(creationJournalLimits.totalBytes + 1)]) rejects(() => decodeCreationJournal(bytes, row()));
  const all = Array.from({ length: 32 }, (_, i) => encodeCreationJournalRecord(row(i)));
  assert.equal(decodeCreationJournal(Buffer.concat(all), row()).length, 32);
  rejects(() => decodeCreationJournal(Buffer.concat([...all, frames[0]]), row()));
  for (const payload of [Buffer.from([0xc3, 0x28]), Buffer.from('{'), Buffer.from('null'),
    Buffer.from(` ${JSON.stringify(row())}`), Buffer.from(JSON.stringify(row()).replace('{', '{"version":1,'))]) {
    rejects(() => decodeCreationJournal(opaqueFrame(payload), row()));
  }
});

test('contracts reject accessors, proxies, extras and coerced values without reading private properties', () => {
  let reads = 0;
  const proxy = new Proxy({}, { getOwnPropertyDescriptor() { reads++; throw new Error('private'); }, getPrototypeOf() { reads++; } });
  rejects(() => encodeCreationJournalRecord(proxy)); rejects(() => decodeCreationJournal(frames[0], proxy));
  rejects(() => decodeCreationJournal(proxy, row()));
  for (const key of Object.keys(row())) {
    const getter = row(); Object.defineProperty(getter, key, { get() { reads++; throw new Error('private'); } });
    rejects(() => encodeCreationJournalRecord(getter));
  }
  for (const value of [null, [], Object.create(row()), row(-1), row(32), row(0, { version: 2 }), row(0, { extra: true }),
    row(0, { source: { toString() { reads++; } } }), row(0, { identity: 'real-target' }), row(0, { kind: 'remove' })]) {
    rejects(() => encodeCreationJournalRecord(value));
  }
  assert.equal(reads, 0);
});

test('source modules are inert, fixed file-only declarations with no provider or existing receipt binding', () => {
  for (const name of ['creationJournalFrames.mjs', 'creationJournalIdentitySource.mjs', 'creationJournalWriterSource.mjs']) {
    const source = readFileSync(new URL(`../lib/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /node:(?:fs|child_process|net|http)|process\.|\.tmp|Import-Module|Get-VM\b|New-VM\b|Remove-VM\b|New-VHD\b|Set-Acl|Set-VM\b/);
  }
  assert.doesNotMatch(CREATION_JOURNAL_WRITER_QUERY, /FileMode\.(?:Append|Create|Truncate|OpenOrCreate)\b|SetAccessControl/);
  const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.equal(manifest.scripts['test:tooling:creation-journal'], 'node --test scripts/__tests__/creation-journal.test.mjs');
  assert.ok(manifest.scripts['test:ci:preflight'].split(' ').includes('test:tooling:creation-journal'));
  assert.match(workflow, /run: npm run test:tooling:creation-journal(?:\r?\n|$)/);
});

test('Windows real CreateNew, protected DACL, competing creation and deny-write/delete sharing', windows, async () => {
  const result = await qualifyJournal(String.raw`
    $writer=[Classifarr.FileJournal.Writer]::Create($path);
    $collision=$false;$writeBlocked=$false;$deleteBlocked=$false;
    try{$other=[Classifarr.FileJournal.Writer]::Create($path);$other.Dispose()}catch{$collision=$true};
    try{$other=[IO.File]::OpenWrite($path);$other.Dispose()}catch{$writeBlocked=$true};
    try{[IO.File]::Delete($path)}catch{$deleteBlocked=$true};
    foreach($frame in $frames){$writer.Append($frame)};
    $before=$false;try{$null=$writer.Readback()}catch{$before=$true};
    $closeAttempted=$true;$writer.Dispose();$bytes=$writer.Readback();
    $again=$false;try{$writer.Dispose()}catch{$again=$true};
    $result=@{collision=$collision;writeBlocked=$writeBlocked;deleteBlocked=$deleteBlocked;before=$before;again=$again;
      attempted=$writer.Attempted;acknowledged=$writer.Acknowledged;readback=[Convert]::ToBase64String($bytes)};
  `, { frames });
  assert.deepEqual(Object.fromEntries(['collision', 'writeBlocked', 'deleteBlocked', 'before', 'again'].map(key => [key, result[key]])),
    { collision: true, writeBlocked: true, deleteBlocked: true, before: true, again: true });
  assert.equal(result.attempted, 3); assert.equal(result.acknowledged, 3);
  assert.equal(decodeCreationJournal(Buffer.from(result.readback, 'base64'), row()).length, 3);
});

test('Windows failed frame poisons the handle; no later write or readback can promote it', windows, async () => {
  const result = await qualifyJournal(String.raw`
    $writer=[Classifarr.FileJournal.Writer]::Create($path);$writer.Append($frames[0]);
    $bad=[byte[]](1,2,3);$blocked=0;
    try{$writer.Append($bad)}catch{$blocked++};try{$writer.Append($frames[0])}catch{$blocked++};
    $closeAttempted=$true;$writer.Dispose();try{$null=$writer.Readback()}catch{$blocked++};
    $result=@{blocked=$blocked;attempted=$writer.Attempted;acknowledged=$writer.Acknowledged};
  `, { frames });
  assert.deepEqual(result, { blocked: 3, attempted: 2, acknowledged: 1 });
});

test('Windows shortened owned fixture is not accepted even after an earlier successful flush', windows, async () => {
  const result = await qualifyJournal(String.raw`
    $writer=[Classifarr.FileJournal.Writer]::Create($path);$writer.Append($frames[0]);
    $closeAttempted=$true;$writer.Dispose();
    $damage=[IO.File]::OpenWrite($path);try{$damage.SetLength(12);$damage.Flush($true)}finally{$damage.Dispose()};
    $rejected=$false;try{$null=$writer.Readback()}catch{$rejected=$true};$result=@{rejected=$rejected};
  `, { frames });
  assert.equal(result.rejected, true);
});

test('Windows fixed path policy refuses aliases, streams, devices and unprotected/null descriptors', windows, async () => {
  const result = await qualifyJournal(String.raw`
    $blocked=0;
    foreach($bad in @(($path+':stream'),($root+'\..\journal.bin'),'\\server\share\journal.bin',($root+'\NUL'),($path+'.'),($path+' '))){
      try{[Classifarr.FileJournal.Identity]::PathGuard($bad)}catch{$blocked++}
    };
    $nullDacl=[Security.AccessControl.FileSecurity]::new();$nullDacl.SetSecurityDescriptorSddlForm('O:SYG:SYD:NO_ACCESS_CONTROL');
    foreach($bad in @([Security.AccessControl.FileSecurity]::new(),$nullDacl)){
      try{[Classifarr.FileJournal.Identity]::Private($bad)}catch{$blocked++}
    };
    $result=@{blocked=$blocked};
  `);
  assert.equal(result.blocked, 8);
});

test('Windows write/flush/close fault injection preserves attempt acknowledgements and always releases owned handles', windows, async () => {
  const cases = [
    ['stream.Write(bytes,0,bytes.Length);', 'Fault();', 0],
    ['stream.Write(bytes,0,bytes.Length);', 'stream.Write(bytes,0,bytes.Length-1);', 0],
    ['stream.Flush(true);', 'Fault();', 0],
    ['stream.Dispose(); closed=true;', 'stream.Dispose(); Fault(); closed=true;', 1],
    ['stream.Write(bytes,0,bytes.Length);', 'Fault();', 0, true],
  ];
  for (const [marker, replacement, acknowledged, secondaryClose = false] of cases) {
    assert.equal(CREATION_JOURNAL_WRITER_QUERY.split(marker).length, 2);
    const result = await qualifyJournal(String.raw`
      $writer=[Classifarr.FileJournal.Writer]::Create($path);$primary='none';$secondary='none';
      try{$writer.Append($frames[0])}catch{$primary='write'};
      $closeAttempted=$true;try{$writer.Dispose()}catch{if($primary -eq 'none'){$primary='close'}else{$secondary='close'}};
      $blocked=$false;try{$null=$writer.Readback()}catch{$blocked=$true};
      $result=@{primary=$primary;secondary=$secondary;blocked=$blocked;attempted=$writer.Attempted;acknowledged=$writer.Acknowledged};
    `, { source: CREATION_JOURNAL_WRITER_QUERY.replace(marker, replacement)
      .replace('stream.Dispose(); closed=true;', secondaryClose ? 'stream.Dispose(); Fault(); closed=true;' : 'stream.Dispose(); closed=true;')
      .replace('private readonly FileStream stream;', 'private static void Fault(){throw new IOException();} private readonly FileStream stream;'), frames });
    assert.equal(result.primary, acknowledged ? 'close' : 'write');
    assert.equal(result.secondary, secondaryClose ? 'close' : 'none');
    assert.equal(result.acknowledged, acknowledged); assert.equal(result.attempted, 1); assert.equal(result.blocked, true);
  }
});

test('Windows record and byte budgets stop before excess I/O, including checksum/trailer refusal', windows, async () => {
  for (const mode of ['count', 'bytes', 'checksum', 'trailer']) {
    const result = await qualifyJournal(String.raw`
      $writer=[Classifarr.FileJournal.Writer]::Create($path);$blocked=$false;
      $frame=$frames[0];
      if('${mode}' -eq 'checksum'){$frame[4]=$frame[4] -bxor 1};
      if('${mode}' -eq 'trailer'){$frame[$frame.Length-1]=0};
      try {foreach($index in 1..33){$writer.Append($frame)}}catch{$blocked=$true};
      $result=@{blocked=$blocked;attempted=$writer.Attempted;acknowledged=$writer.Acknowledged};
    `, { frames: mode === 'bytes' ? [largeFrame()] : [frames[0]] });
    assert.equal(result.blocked, true);
    assert.equal(result.acknowledged, mode === 'count' ? 32 : mode === 'bytes' ? 8 : 0);
    assert.equal(result.attempted, result.acknowledged + 1);
  }
});

test('Windows actual hard-link alias is refused; only the verified test-created alias is unlinked', windows, async () => {
  const result = await qualifyJournal(String.raw`
    $writer=[Classifarr.FileJournal.Writer]::Create($path);$writer.Append($frames[0]);
    $closeAttempted=$true;$writer.Dispose();$alias=[IO.Path]::Combine($root,'alias.bin');
    $null=New-Item -ItemType HardLink -Path $alias -Target $path;
    $blocked=$false;try{$null=$writer.MatchesFile()}catch{$blocked=$true};
    # Test-only raw metadata comparison for the TWO links just created here.
    # The production Identity.Of deliberately refuses both while link count is two.
    $method=[Classifarr.FileJournal.Identity].GetMethod('GetFileInformationByHandle',[Reflection.BindingFlags]'NonPublic,Static');
    $infoType=[Classifarr.FileJournal.Identity].GetNestedType('Info',[Reflection.BindingFlags]'NonPublic');
    $left=[IO.File]::Open($path,'Open','Read','Read');$right=[IO.File]::Open($alias,'Open','Read','Read');
    try {
      $a=[object[]]@($left.SafeFileHandle,[Activator]::CreateInstance($infoType));
      $b=[object[]]@($right.SafeFileHandle,[Activator]::CreateInstance($infoType));
      if(!$method.Invoke($null,$a) -or !$method.Invoke($null,$b)){throw 'fixture_retained'};
      foreach($field in @('Volume','IndexHigh','IndexLow','Attributes','Links')){
        $f=$infoType.GetField($field);if($f.GetValue($a[1]) -ne $f.GetValue($b[1])){throw 'fixture_retained'}
      };
      if($infoType.GetField('Links').GetValue($a[1]) -ne 2 -or
        ($infoType.GetField('Attributes').GetValue($a[1]) -band 0x400) -ne 0){throw 'fixture_retained'};
    } finally {$right.Dispose();$left.Dispose()};
    if([Classifarr.FileJournal.Identity]::Of($pin,$root,$true) -ne $rootIdentity){throw 'fixture_retained'};
    [IO.File]::Delete($alias);$result=@{blocked=$blocked;originalMatches=$writer.MatchesFile()};
  `, { frames });
  assert.deepEqual(result, { blocked: true, originalMatches: true });
});

test('Windows source-side injected identity mismatch and lost output are not promoted into acknowledgement', windows, async () => {
  const marker = '!=identity || read.Length!=expected.Length';
  assert.equal(CREATION_JOURNAL_WRITER_QUERY.split(marker).length, 2);
  const result = await qualifyJournal(String.raw`
    $writer=[Classifarr.FileJournal.Writer]::Create($path);$writer.Append($frames[0]);
    $closeAttempted=$true;$writer.Dispose();$blocked=$false;
    try{$null=$writer.Readback()}catch{$blocked=$true};$result=@{blocked=$blocked};
  `, { source: CREATION_JOURNAL_WRITER_QUERY.replace(marker, '==identity || read.Length!=expected.Length'), frames });
  assert.equal(result.blocked, true);
  assert.deepEqual(await qualifyJournal(String.raw`
    $writer=[Classifarr.FileJournal.Writer]::Create($path);$writer.Append($frames[0]);
  `, { frames, interruptOutput: true }), { status: 'capture_failed', cleanupObserved: true, acknowledgementAvailable: false });
});
