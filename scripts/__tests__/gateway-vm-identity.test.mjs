/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { vmCreationQuery } from '../lib/gatewayVmCreationQuery.mjs';
import { planVmCreation, VM_CREATION_BOOTSTRAP } from '../lib/gatewayVmCreation.mjs';
import { registryCommand } from '../lib/registryCommand.mjs';

const query = () => vmCreationQuery(planVmCreation({ vmParent: 'C:\\Fixture VMs', diskParent: 'D:\\Fixture Disks' }));
function fragment(start, end) {
  const text = query();
  assert.equal(text.split(start).length, 2); assert.equal(text.split(end).length, 2);
  assert.ok(text.indexOf(end) > text.indexOf(start));
  return text.slice(text.indexOf(start), text.indexOf(end));
}
const lookup = "$sid=[Security.Principal.NTAccount]::new('NT VIRTUAL MACHINE',[string]$id).Translate([Security.Principal.SecurityIdentifier]).Value";
const cases = [
  { sid: 'S-1-5-83-1-1-2-3-4', accepted: true },
  { sid: 'S-1-5-83-1-4294967295-0-42-7', accepted: true },
  ...['S-1-5-83-0', 'S-1-5-83-0-1-2-3-4', 'S-1-4-83-1-1-2-3-4', 'S-1-5-80-1-1-2-3-4',
    'S-1-5-83-1-1-2-3', 'S-1-5-83-1-1-2-3-4-5', 'S-1-5-83-1-1-2-no-4', ''].map(sid => ({ sid, accepted: false })),
  { sid: '', accepted: false, fail: true },
  { sid: 'S-1-5-83-1-1-2-3-4', accepted: false, emptyId: true },
];

test('production SID pattern accepts per-VM identity and refuses group, old namespace and malformed results', () => {
  const source = fragment('  function Resolve-CreatedVmSid(', '  function Assert-Off');
  const pattern = source.match(/\$sid -notmatch '([^']+)'/);
  assert.ok(pattern);
  const validate = new RegExp(pattern[1]);
  for (const value of cases.filter(v => !v.fail && !v.emptyId)) assert.equal(validate.test(value.sid), value.accepted, value.sid);
  assert.equal(source.split(lookup).length, 2);
});

const invoke = input => registryCommand(join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(VM_CREATION_BOOTSTRAP, 'utf16le').toString('base64')],
  { input, timeoutMs: 10000, maxBytes: 65536 });

test('Windows runs the production SID resolver, mocking only native translation', { skip: process.platform !== 'win32' }, async () => {
  const source = fragment('  function Resolve-CreatedVmSid(', '  function Assert-Off');
  assert.equal(source.split(lookup).length, 2);
  const nativeStub = "if($case.fail){throw 'synthetic translation failure'}; $sid=$case.sid";
  const runnable = source.replace(lookup, nativeStub);
  assert.doesNotMatch(runnable, /NTAccount/);
  const data = Buffer.from(JSON.stringify(cases.map(v => ({ fail: false, emptyId: false, ...v })))).toString('base64');
  const captured = await invoke(`Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';${runnable}
    $cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json;
    $results=@(foreach($case in $cases){try{$id=$(if($case.emptyId){[guid]::Empty}else{[guid]'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'});$value=Resolve-CreatedVmSid $id;
      @{accepted=$true;same=($value -ceq $case.sid)}}catch{@{accepted=$false;reason=([string]$_.Exception.Message -ceq 'vm_sid_unavailable')}}});
    ConvertTo-Json -InputObject $results -Compress`);
  assert.equal(captured.ok, true); assert.equal(captured.stderr, '');
  const values = JSON.parse(captured.stdout);
  assert.equal(values.length, cases.length);
  values.forEach((v, i) => { assert.equal(v.accepted, cases[i].accepted, cases[i].sid); assert.equal(v.accepted ? v.same : v.reason, true); });
});

test('Windows checks the real adapter predicate with typed null/empty IDs and contradictory evidence', { skip: process.platform !== 'win32' }, async () => {
  const source = fragment('  function Test-DisconnectedVmAdapter(', '  function Assert-Off');
  const captured = await invoke(`Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';${source}
    $empty=[guid]::Empty;$assigned=[guid]'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    $cases=@(
      @{adapters=@([pscustomobject]@{Connected=$false;SwitchName=$null;SwitchId=$null});expected=$true},
      @{adapters=@([pscustomobject]@{Connected=$false;SwitchName='';SwitchId=$empty});expected=$true},
      @{adapters=@();expected=$false},
      @{adapters=@($null);expected=$false},
      @{adapters=@([pscustomobject]@{Connected=$true;SwitchName='';SwitchId=$null});expected=$false},
      @{adapters=@([pscustomobject]@{Connected=$false;SwitchName='assigned';SwitchId=$null});expected=$false},
      @{adapters=@([pscustomobject]@{Connected=$false;SwitchName='';SwitchId=$assigned});expected=$false},
      @{adapters=@([pscustomobject]@{Connected='false';SwitchName='';SwitchId=$null});expected=$false},
      @{adapters=@([pscustomobject]@{Connected=$false;SwitchName='';SwitchId=[string]$empty});expected=$false},
      @{adapters=@([pscustomobject]@{Connected=$false;SwitchName=''});expected=$false},
      @{adapters=@([pscustomobject]@{SwitchName='';SwitchId=$null});expected=$false},
      @{adapters=@([pscustomobject]@{Connected=$false;SwitchId=$null});expected=$false},
      @{adapters=@([pscustomobject]@{Connected=$false;SwitchName='';SwitchId=$null},[pscustomobject]@{Connected=$false;SwitchName='';SwitchId=$null});expected=$false}
    );
    $results=@(foreach($case in $cases){$actual=$false;try{$actual=Test-DisconnectedVmAdapter $case.adapters}catch{$actual=$false};
      @{matched=($actual -is [bool] -and $actual -eq $case.expected)}});
    ConvertTo-Json -InputObject $results -Compress`);
  assert.equal(captured.ok, true); assert.equal(captured.stderr, '');
  const values = JSON.parse(captured.stdout);
  assert.equal(values.length, 13); assert.ok(values.every(v => v.matched));
});
