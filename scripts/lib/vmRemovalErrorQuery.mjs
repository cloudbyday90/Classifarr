/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Function definitions only. No launcher, native imports, target I/O or module-load work.
export const VM_REMOVAL_ERROR_QUERY = String.raw`
function ConvertTo-RemovalErrorDetail($Record) {
  Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';
  $result=@{status='none';category=$null;errorId=$null;detailsPresent=$null;targetPresent=$null;
    nodes=[object[]]@();truncated=$false;cycle=$false;unsupported=$false;projectionFailed=$false};
  if($null -eq $Record){return $result};
  $nodes=$null;
  try {
    # Fixed CLR members bypass ETS shadows; never inspect Message, Data or arbitrary getters.
    $getType=[object].GetMethod('GetType');
    $recordType=[Management.Automation.ErrorRecord];$exceptionType=[Exception];
    $recordException=$recordType.GetProperty('Exception');
    $categoryProperty=$recordType.GetProperty('CategoryInfo');
    $categoryValue=[Management.Automation.ErrorCategoryInfo].GetProperty('Category');
    $idProperty=$recordType.GetProperty('FullyQualifiedErrorId');
    $detailsProperty=$recordType.GetProperty('ErrorDetails');$targetProperty=$recordType.GetProperty('TargetObject');
    $hresultProperty=$exceptionType.GetProperty('HResult');$innerProperty=$exceptionType.GetProperty('InnerException');
    $runtimeRecord=[Management.Automation.RuntimeException].GetProperty('ErrorRecord');
    $nativeCode=[ComponentModel.Win32Exception].GetProperty('NativeErrorCode');
    $actual=$getType.Invoke($Record,[object[]]@());
    if($actual -ne $recordType){$result.unsupported=$true;$result.status='unavailable';return $result};
    $category=$categoryProperty.GetValue($Record,$null);$result.category=[int]$categoryValue.GetValue($category,$null);
    $id=$idProperty.GetValue($Record,$null);
    $result.errorId=$(if($null -eq $id -or $id -ceq ''){'none'}elseif($id.Length -gt 2048){'oversize'}
      elseif($id -ceq 'PropertyNotFoundStrict'){'strict_property'}elseif($id -ceq 'VariableIsUndefined'){'strict_variable'}else{'other'});
    if($result.errorId -ceq 'oversize'){$result.truncated=$true};
    $result.detailsPresent=$null -ne $detailsProperty.GetValue($Record,$null);
    $result.targetPresent=$null -ne $targetProperty.GetValue($Record,$null);
    $queue=[Collections.Generic.Queue[object]]::new();$seen=[Collections.Generic.List[object]]::new();
    $links=[Collections.Generic.List[object]]::new();
    $nodes=[Collections.Generic.List[object]]::new();$recordCount=0;
    $queue.Enqueue(@{value=$Record;isRecord=$true;parent=$null;via='root';from=$null});
    while($queue.Count -gt 0){
      $entry=$queue.Dequeue();$item=$entry.value;if($null -eq $item){continue};
      if($null -ne $entry.from){$links.Add(@{from=$entry.from;to=$item})};
      $visited=$false;foreach($prior in $seen){if([object]::ReferenceEquals($prior,$item)){$visited=$true;break}};
      if($visited){continue};
      $type=$getType.Invoke($item,[object[]]@());
      if($entry.isRecord){
        if($type -ne $recordType){$result.unsupported=$true;continue};
        if($recordCount -ge 6){$result.truncated=$true;continue};$recordCount++;$seen.Add($item);
        $next=$recordException.GetValue($item,$null);
        if($null -ne $next){$queue.Enqueue(@{value=$next;isRecord=$false;parent=$entry.parent;via=$entry.via;from=$item})}
        else{$result.unsupported=$true};
        continue;
      };
      if($item -isnot [Exception]){$result.unsupported=$true;continue};
      if($nodes.Count -ge 6){$result.truncated=$true;continue};$seen.Add($item);
      $kind=switch -CaseSensitive ($type.FullName){
        'System.Exception'{'exception';break};'System.SystemException'{'system';break};
        'System.InvalidOperationException'{'invalid_operation';break};'System.IO.IOException'{'io';break};
        'System.UnauthorizedAccessException'{'access_denied';break};
        'System.Management.Automation.RuntimeException'{'runtime';break};
        'System.Management.Automation.ParentContainsErrorRecordException'{'parent_record';break};
        'System.Management.Automation.ParameterBindingException'{'parameter_binding';break};default{'other'}
      };
      $native=$null;if($item -is [ComponentModel.Win32Exception]){$kind='win32';$native=[int]$nativeCode.GetValue($item,$null)};
      $index=$nodes.Count;$nodes.Add(@{kind=$kind;via=$entry.via;parent=$entry.parent;
        hresult=[int]$hresultProperty.GetValue($item,$null);nativeErrorCode=$native});
      if($kind -ceq 'parent_record'){$result.unsupported=$true};
      $inner=$innerProperty.GetValue($item,$null);
      if($null -ne $inner){$queue.Enqueue(@{value=$inner;isRecord=$false;parent=$index;via='inner';from=$item})};
      if($type -eq [Management.Automation.RuntimeException]){
        $embedded=$runtimeRecord.GetValue($item,$null);
        if($null -ne $embedded){$queue.Enqueue(@{value=$embedded;isRecord=$true;parent=$index;via='record';from=$item})};
      }elseif($item -is [Management.Automation.IContainsErrorRecord]){$result.unsupported=$true};
    };
    # At most twelve private vertices. Keep cross-edges even to visited nodes:
    # ancestry on the first BFS path alone misses cycles behind shared shortcuts.
    $reach=[bool[,]]::new($seen.Count,$seen.Count);
    foreach($link in $links){
      $from=-1;$to=-1;
      for($i=0;$i -lt $seen.Count;$i++){
        if([object]::ReferenceEquals($seen[$i],$link.from)){$from=$i};
        if([object]::ReferenceEquals($seen[$i],$link.to)){$to=$i};
      };
      if($from -ge 0 -and $to -ge 0){$reach[$from,$to]=$true};
    };
    for($k=0;$k -lt $seen.Count;$k++){for($i=0;$i -lt $seen.Count;$i++){for($j=0;$j -lt $seen.Count;$j++){
      if($reach[$i,$k] -and $reach[$k,$j]){$reach[$i,$j]=$true};
    }}};
    for($i=0;$i -lt $seen.Count;$i++){if($reach[$i,$i]){$result.cycle=$true}};
    $result.nodes=$nodes.ToArray();
  } catch {
    $result.projectionFailed=$true;
    if($null -ne $nodes){$result.nodes=$nodes.ToArray()};
  };
  $partial=$result.truncated -or $result.cycle -or $result.unsupported -or $result.projectionFailed;
  $result.status=$(if($result.nodes.Count -eq 0){'unavailable'}elseif($partial){'partial'}else{'captured'});
  return $result;
}
`;
