/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { win32 } from 'node:path';
import { registryCommand } from '../lib/registryCommand.mjs';
import { VM_REMOVAL_ERROR_QUERY } from '../lib/vmRemovalErrorQuery.mjs';
import { removalErrorLimits, emptyVmRemovalErrorDetail, projectVmRemovalErrorDetail,
  createVmRemovalErrorReport, projectVmRemovalErrorReport, appendVmRemovalSecondary } from '../lib/vmRemovalErrorContract.mjs';

const node = (patch = {}) => ({ kind: 'exception', via: 'root', parent: null, hresult: -2146233088, nativeErrorCode: null, ...patch });
const captured = (patch = {}) => ({ ...emptyVmRemovalErrorDetail(), status: 'captured', category: 7,
  errorId: 'other', detailsPresent: false, targetPresent: false, nodes: [node()], ...patch });
const rejects = callback => assert.throws(callback, { message: 'vm_removal_error_invalid' });
const windows = { skip: process.platform !== 'win32' };

test('empty and captured pure DTOs grant no native capability or diagnosis', () => {
  assert.deepEqual(projectVmRemovalErrorDetail(emptyVmRemovalErrorDetail()), emptyVmRemovalErrorDetail());
  const report = createVmRemovalErrorReport(captured());
  assert.deepEqual(projectVmRemovalErrorReport(report), report);
  for (const key of ['rootCauseConfirmed', 'retryAllowed', 'liveOperationsEnabled']) {
    assert.equal(report[key], false); rejects(() => projectVmRemovalErrorReport({ ...report, [key]: true }));
  }
  assert.equal('cleanupComplete' in report, false); assert.equal('vmAbsent' in report, false);
  assert.equal('mutationAttempted' in report, false);
});

test('projection reads only bounded own data fields and never invokes private getters or proxy traps', () => {
  let reads = 0;
  const source = captured(); Object.defineProperty(source, 'private', { get() { reads++; throw new Error('private'); } });
  source.nodes[0].message = 'private C:\\secret S-1-private';
  source.raw = 'x'.repeat(1_000_000);
  const projected = projectVmRemovalErrorDetail(source);
  assert.equal(reads, 0); assert.doesNotMatch(JSON.stringify(projected), /private|secret|message|raw/);
  for (const key of Object.keys(captured())) {
    const value = captured(); Object.defineProperty(value, key, { get() { reads++; throw new Error('private'); } });
    rejects(() => projectVmRemovalErrorDetail(value));
  }
  const proxy = new Proxy({}, { getPrototypeOf() { reads++; throw new Error('private'); }, get() { reads++; throw new Error('private'); } });
  rejects(() => projectVmRemovalErrorDetail(proxy));
  const array = [node()]; Object.defineProperty(array, '0', { get() { reads++; throw new Error('private'); } });
  rejects(() => projectVmRemovalErrorDetail(captured({ nodes: array })));
  assert.equal(reads, 0);
});

test('invalid, inconsistent, inherited, sparse and unbounded details fail with opaque errors', () => {
  for (const value of [null, [], 'private', new Error('private'), Object.create(captured()),
    captured({ status: 'none' }), captured({ category: null }), captured({ category: 64 }), captured({ category: '7' }),
    captured({ errorId: 'private' }), captured({ errorId: 'oversize' }), captured({ status: 'partial' }),
    captured({ status: 'unavailable' }), captured({ nodes: [] }), captured({ nodes: Array(1) }),
    captured({ nodes: Array(7).fill(node()) }), captured({ nodes: [node({ hresult: 2147483648 })] }),
    captured({ nodes: [node({ hresult: NaN })] }), captured({ nodes: [node({ kind: 'private' })] }),
    captured({ nodes: [node({ nativeErrorCode: 5 })] }), captured({ nodes: [node({ kind: 'win32' })] }),
    captured({ nodes: [node({ via: 'inner', parent: 0 })] }),
    captured({ nodes: [node(), node({ via: 'inner', parent: 2 })] }),
    captured({ nodes: [node({ kind: 'parent_record' })] })]) rejects(() => projectVmRemovalErrorDetail(value));
});

test('global report node/secondary limits preserve primary evidence without mutating the input', () => {
  const primary = captured({ nodes: [node(), ...Array.from({ length: 5 }, (_, i) => node({ via: 'inner', parent: i }))] });
  const original = createVmRemovalErrorReport(primary); const saved = JSON.stringify(original);
  let result = original;
  for (const phase of ['journal', 'dispose', 'projection', 'journal', 'dispose']) result = appendVmRemovalSecondary(result, phase, captured());
  assert.equal(JSON.stringify(original), saved); assert.deepEqual(result.primary, primary);
  assert.equal(result.secondary.length, 4); assert.equal(result.secondaryTruncated, true);
  assert.ok(result.secondary.every(row => row.detail.status === 'unavailable' && row.detail.truncated && row.detail.nodes.length === 0));
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < removalErrorLimits.bytes);
  const report = createVmRemovalErrorReport(captured());
  const failed = appendVmRemovalSecondary(report, 'journal', { private: 'not a valid projection' });
  assert.deepEqual(failed.primary, report.primary); assert.equal(failed.secondary[0].detail.projectionFailed, true);
  const withNone = appendVmRemovalSecondary(report, 'dispose', emptyVmRemovalErrorDetail());
  assert.equal(withNone.secondary[0].detail.status, 'unavailable');
  rejects(() => appendVmRemovalSecondary(report, 'private', captured()));
  rejects(() => projectVmRemovalErrorReport({ ...report, secondaryTruncated: true }));
  rejects(() => projectVmRemovalErrorReport({ ...report, secondary: [{ phase: 'journal', detail: primary }] }));
});

test('secondary prefix truncation keeps valid links and separate native versus HRESULT codes', () => {
  const primary = captured({ nodes: [node(), node({ via: 'inner', parent: 0 }), node({ via: 'inner', parent: 1 })] });
  const secondary = captured({ nodes: [node({ kind: 'win32', nativeErrorCode: 5, hresult: -2147467259 }),
    ...Array.from({ length: 5 }, (_, i) => node({ via: 'inner', parent: i }))] });
  const result = appendVmRemovalSecondary(createVmRemovalErrorReport(primary), 'dispose', secondary);
  assert.equal(result.secondary[0].detail.status, 'partial'); assert.equal(result.secondary[0].detail.nodes.length, 3);
  assert.equal(result.secondary[0].detail.nodes[0].nativeErrorCode, 5);
  assert.equal(result.secondary[0].detail.nodes[0].hresult, -2147467259);
  assert.deepEqual(projectVmRemovalErrorReport(result), result);
});

test('malformed report metadata, secondary rows and completeness flags cannot be promoted', () => {
  const report = createVmRemovalErrorReport();
  for (const patch of [{ version: 2 }, { operation: 'private' }, { secondary: null }, { secondary: Array(5).fill({}) },
    { secondary: [{ phase: 'private', detail: captured() }] },
    { secondary: [{ phase: 'journal', detail: emptyVmRemovalErrorDetail() }] }, { secondaryTruncated: 'true' }]) {
    rejects(() => projectVmRemovalErrorReport({ ...report, ...patch }));
  }
  for (const patch of [{ truncated: 1 }, { cycle: 'false' }, { unsupported: null }, { projectionFailed: undefined },
    { category: -1 }, { category: Infinity }, { errorId: null }, { detailsPresent: 0 }, { targetPresent: 'true' }]) {
    rejects(() => projectVmRemovalErrorDetail(captured(patch)));
  }
  const unavailable = { ...emptyVmRemovalErrorDetail(), status: 'unavailable', unsupported: true };
  assert.deepEqual(projectVmRemovalErrorDetail(unavailable), unavailable);
  assert.deepEqual(projectVmRemovalErrorReport(report), report);
  const accessor = { ...report }; Object.defineProperty(accessor, 'primary', { get() { assert.fail('must not invoke report accessors'); } });
  rejects(() => projectVmRemovalErrorReport(accessor));
});

test('modules have no launcher, import-time I/O, native binding, provider command or optional enablement', () => {
  const contract = readFileSync(new URL('../lib/vmRemovalErrorContract.mjs', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../lib/vmRemovalErrorQuery.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(contract + source, /node:(?:fs|child_process|net|http)|process\.|registryCommand|\.tmp|fixture-plan|DllImport|Add-Type|Import-Module|Invoke-Expression|Get-VM\b|Remove-VM\b|New-VM\b|New-VHD\b|Set-Acl|Get-Acl|Get-WinEvent|FileStream|Get-Item/);
  assert.doesNotMatch(VM_REMOVAL_ERROR_QUERY, /GetProperty\('(?:Message|Data|ScriptStackTrace|InvocationInfo)'\)/);
  assert.equal(VM_REMOVAL_ERROR_QUERY.match(/function /g)?.length, 1);
});

test('the dependency-free contract suite is wired into local preflight and the actual CI workflow', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.equal(manifest.scripts['test:tooling:vm-errors'], 'node --test scripts/__tests__/vm-removal-error-contract.test.mjs');
  assert.ok(manifest.scripts['test:ci:preflight'].split(' ').includes('test:tooling:vm-errors'));
  assert.match(workflow, /run: npm run test:tooling:vm-errors(?:\r?\n|$)/);
});

async function invokeSynthetic(input) {
  assert.match(process.env.SystemRoot, /^[A-Za-z]:\\[A-Za-z0-9 ._()\\-]+$/);
  const env = { systemroot: process.env.SystemRoot, windir: process.env.SystemRoot,
    psmodulepath: win32.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules') };
  const bootstrap = String.raw`[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);& ([scriptblock]::Create([Console]::In.ReadToEnd()))`;
  const result = await registryCommand(win32.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(bootstrap, 'utf16le').toString('base64')],
    { env, input: `Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';try{${input}}catch{
      @{fixtureFailure=$true;line=[int]$_.InvocationInfo.ScriptLineNumber}|ConvertTo-Json -Compress;exit 1;
    }`, timeoutMs: 20000, maxBytes: 65536 });
  let failureLine = null;
  if (!result.ok) { try { const v = JSON.parse(result.stdout); if (v.fixtureFailure === true && Number.isSafeInteger(v.line)) failureLine = v.line; } catch {} }
  assert.equal(result.ok, true, `in-memory PowerShell fixture failed at line ${failureLine ?? 'unavailable'}`); assert.equal(result.stderr, '');
  return JSON.parse(result.stdout.trim().replace(/^\uFEFF/, ''));
}

let fixturePromise;
function fixtures() {
  return fixturePromise ??= invokeSynthetic(VM_REMOVAL_ERROR_QUERY + String.raw`
    $rows=[ordered]@{};$script:shadowReads=0;
    function Synthetic-Record([Exception]$exception,[string]$id='private-id'){
      return [Management.Automation.ErrorRecord]::new($exception,$id,[Management.Automation.ErrorCategory]::InvalidOperation,'private target');
    }
    $leaf=[ComponentModel.Win32Exception]::new(5,'private native message');
    $rows.none=ConvertTo-RemovalErrorDetail $null;
    $rows.invalid=ConvertTo-RemovalErrorDetail ([pscustomobject]@{Exception='private'});
    $syntheticError=Synthetic-Record ([Exception]::new('private C:\secret S-1-private'));
    $syntheticError.ErrorDetails=[Management.Automation.ErrorDetails]::new('private details');
    $rows.generic=ConvertTo-RemovalErrorDetail $syntheticError;
    $rows.nested=ConvertTo-RemovalErrorDetail (Synthetic-Record ([Exception]::new('private outer',$leaf)));
    $rows.strict=ConvertTo-RemovalErrorDetail (Synthetic-Record $leaf 'PropertyNotFoundStrict');
    $rows.variable=ConvertTo-RemovalErrorDetail (Synthetic-Record $leaf 'VariableIsUndefined');
    $rows.oversize=ConvertTo-RemovalErrorDetail (Synthetic-Record $leaf ('x'*2049));
    $rows.emptyId=ConvertTo-RemovalErrorDetail (Synthetic-Record $leaf '');
    $chain=[Exception]::new('private');foreach($number in 1..12){$chain=[Exception]::new('private',$chain)};
    $rows.deep=ConvertTo-RemovalErrorDetail (Synthetic-Record $chain);
    $seedRuntime=[Management.Automation.RuntimeException]::new('private seed',$leaf);$seed=$seedRuntime.ErrorRecord;
    $rows.placeholder=ConvertTo-RemovalErrorDetail $seed;
    $runtime=[Management.Automation.RuntimeException]::new('private runtime',$leaf,$seed);
    $root=[Management.Automation.ErrorRecord]::new($seed,$runtime);
    $rows.embedded=ConvertTo-RemovalErrorDetail $root;
    $shared=[Management.Automation.RuntimeException]::new('private shared',$leaf,(Synthetic-Record $leaf));
    $rows.shared=ConvertTo-RemovalErrorDetail ([Management.Automation.ErrorRecord]::new($seed,$shared));
    $rightChain=[Exception]::new('private');foreach($number in 1..12){$rightChain=[Exception]::new('private',$rightChain)};
    $branched=[Management.Automation.RuntimeException]::new('private branches',$chain,(Synthetic-Record $rightChain));
    $rows.branched=ConvertTo-RemovalErrorDetail ([Management.Automation.ErrorRecord]::new($seed,$branched));
    $recordChain=Synthetic-Record $leaf;
    foreach($number in 1..12){
      $holder=[Management.Automation.RuntimeException]::new('private record chain',$null,$recordChain);
      $recordChain=[Management.Automation.ErrorRecord]::new($seed,$holder);
    };
    $rows.recordChain=ConvertTo-RemovalErrorDetail $recordChain;
    # Test-only in-memory mutation builds a cycle; production never writes reflection fields.
    $field=[Management.Automation.RuntimeException].GetField('_errorRecord',[Reflection.BindingFlags]'Instance,NonPublic');
    if($null -eq $field){throw 'synthetic runtime field unavailable'};$field.SetValue($runtime,$root);
    $rows.cycle=ConvertTo-RemovalErrorDetail $root;
    # A shortcut reaches B before A's later path; a visited-only BFS must not hide A<->B.
    $a=[Management.Automation.RuntimeException]::new('private A');$b=[Management.Automation.RuntimeException]::new('private B');
    $recordA=[Management.Automation.ErrorRecord]::new($seed,$a);$recordB=[Management.Automation.ErrorRecord]::new($seed,$b);
    $field.SetValue($a,$recordB);$field.SetValue($b,$recordA);
    $shortcut=[Management.Automation.RuntimeException]::new('private shortcut',$a,$recordB);
    $rows.shortcutCycle=ConvertTo-RemovalErrorDetail ([Management.Automation.ErrorRecord]::new($seed,$shortcut));
    $unsupported=[Management.Automation.CmdletInvocationException]::new((Synthetic-Record $leaf));
    $unsupported|Add-Member ScriptProperty ErrorRecord {$script:shadowReads++;throw 'private getter'} -Force;
    $rows.unsupported=ConvertTo-RemovalErrorDetail ([Management.Automation.ErrorRecord]::new($seed,$unsupported));
    $field.SetValue($runtime,$seed);
    foreach($name in @('HResult','InnerException','Message','Data','ErrorRecord')){
      $runtime|Add-Member ScriptProperty $name {$script:shadowReads++;throw 'private getter'} -Force;
    };
    $runtime|Add-Member ScriptMethod GetType {$script:shadowReads++;throw 'private method'} -Force;
    foreach($name in @('Exception','CategoryInfo','FullyQualifiedErrorId','ErrorDetails','TargetObject')){
      $root|Add-Member ScriptProperty $name {$script:shadowReads++;throw 'private getter'} -Force;
    };
    $root|Add-Member ScriptMethod GetType {$script:shadowReads++;throw 'private method'} -Force;
    $rows.shadowed=ConvertTo-RemovalErrorDetail $root;
    try{throw [Exception]::new('private operation failure')}catch{$saved=$_;$rows.caught=ConvertTo-RemovalErrorDetail $saved};
    $rows.journal=ConvertTo-RemovalErrorDetail (Synthetic-Record ([ComponentModel.Win32Exception]::new(32,'private journal')));
    $rows.dispose=ConvertTo-RemovalErrorDetail (Synthetic-Record ([IO.IOException]::new('private disposal')));
    @{major=$PSVersionTable.PSVersion.Major;shadowReads=$script:shadowReads;rows=$rows}|ConvertTo-Json -Depth 9 -Compress
  `);
}

test('Windows PowerShell5.1 AST contains only function definitions and Set-StrictMode, with no target commands', windows, async () => {
  const data = Buffer.from(VM_REMOVAL_ERROR_QUERY, 'utf16le').toString('base64');
  const result = await invokeSynthetic(`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput(
    [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${data}')),[ref]$tokens,[ref]$errors);
    @{errors=$errors.Count;commands=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.CommandAst]},$true)|ForEach-Object{$_.GetCommandName()});
      statements=$ast.EndBlock.Statements.Count;definition=($ast.EndBlock.Statements[0] -is [Management.Automation.Language.FunctionDefinitionAst])}|ConvertTo-Json -Compress`);
  assert.equal(result.errors, 0); assert.deepEqual(result.commands, ['Set-StrictMode']);
  assert.equal(result.statements, 1); assert.equal(result.definition, true);
});

test('Windows synthetic errors retain real typed codes, finite classifications and no private payload', windows, async () => {
  const result = await fixtures(); assert.equal(result.major, 5); assert.equal(result.shadowReads, 0);
  for (const value of Object.values(result.rows)) projectVmRemovalErrorDetail(value);
  assert.equal(result.rows.none.status, 'none'); assert.equal(result.rows.invalid.status, 'unavailable');
  assert.equal(result.rows.generic.status, 'captured'); assert.equal(result.rows.generic.detailsPresent, true);
  assert.equal(result.rows.generic.targetPresent, true); assert.equal(result.rows.generic.errorId, 'other');
  assert.deepEqual(result.rows.nested.nodes.map(v => [v.hresult, v.nativeErrorCode]), [[-2146233088, null], [-2147467259, 5]]);
  assert.equal(result.rows.strict.errorId, 'strict_property'); assert.equal(result.rows.variable.errorId, 'strict_variable');
  assert.equal(result.rows.oversize.errorId, 'oversize'); assert.equal(result.rows.oversize.truncated, true);
  assert.equal(result.rows.emptyId.errorId, 'none');
  assert.doesNotMatch(JSON.stringify(result), /private|secret|S-1-|C:|ErrorDetails|FullyQualifiedErrorId|TargetObject/);
});

test('Windows embedded/placeholder/shared/cyclic and over-budget graphs are bounded without arbitrary getters', windows, async () => {
  const { rows } = await fixtures();
  assert.equal(rows.deep.nodes.length, 6); assert.equal(rows.deep.truncated, true); assert.equal(rows.deep.status, 'partial');
  assert.equal(rows.placeholder.nodes[0].kind, 'parent_record'); assert.equal(rows.placeholder.unsupported, true);
  assert.equal(rows.embedded.nodes.length, 3); assert.deepEqual(rows.embedded.nodes.map(v => v.via), ['root', 'inner', 'record']);
  assert.equal(rows.shared.status, 'captured'); assert.equal(rows.shared.nodes.length, 2); assert.equal(rows.shared.cycle, false);
  assert.equal(rows.branched.nodes.length, 6); assert.equal(rows.branched.truncated, true);
  assert.ok(rows.branched.nodes.some(value => value.via === 'record'));
  assert.equal(rows.recordChain.nodes.length, 6); assert.equal(rows.recordChain.truncated, true);
  assert.equal(rows.cycle.cycle, true); assert.equal(rows.cycle.status, 'partial');
  assert.equal(rows.shortcutCycle.cycle, true); assert.equal(rows.shortcutCycle.status, 'partial');
  assert.equal(rows.unsupported.unsupported, true); assert.equal(rows.shadowed.status, 'partial');
});

test('fault-injected projection failures preserve already captured nodes or report unavailable, never raw errors', windows, async () => {
  const cases = [
    { marker: "$getType=[object].GetMethod('GetType');", status: 'unavailable', nodes: 0 },
    { marker: '$inner=$innerProperty.GetValue($item,$null);', status: 'partial', nodes: 1 },
  ];
  for (const fixture of cases) {
    assert.equal(VM_REMOVAL_ERROR_QUERY.split(fixture.marker).length, 2);
    const source = VM_REMOVAL_ERROR_QUERY.replace(fixture.marker, `throw 'private synthetic projection failure';${fixture.marker}`);
    const result = await invokeSynthetic(source + `
      $value=[Management.Automation.ErrorRecord]::new([Exception]::new('private'), 'private', [Management.Automation.ErrorCategory]::InvalidOperation,$null);
      ConvertTo-RemovalErrorDetail $value|ConvertTo-Json -Depth 6 -Compress`);
    const projected = projectVmRemovalErrorDetail(result);
    assert.equal(projected.status, fixture.status); assert.equal(projected.nodes.length, fixture.nodes);
    assert.equal(projected.projectionFailed, true); assert.doesNotMatch(JSON.stringify(projected), /private/);
  }
});

test('real catch projection survives mocked journal and disposal failures as separate secondary evidence', windows, async () => {
  const { rows } = await fixtures(); const primary = projectVmRemovalErrorDetail(rows.caught);
  const original = createVmRemovalErrorReport(primary);
  const journal = appendVmRemovalSecondary(original, 'journal', rows.journal);
  const disposal = appendVmRemovalSecondary(journal, 'dispose', rows.dispose);
  assert.deepEqual(disposal.primary, primary); assert.deepEqual(original.secondary, []);
  assert.deepEqual(disposal.secondary.map(v => v.phase), ['journal', 'dispose']);
  assert.equal(disposal.secondary[0].detail.nodes[0].nativeErrorCode, 32);
  assert.equal(disposal.secondary[1].detail.nodes[0].kind, 'io');
});
