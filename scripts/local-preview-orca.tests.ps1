# Mock the Orca CLI: these tests never spawn a real terminal, call op, or touch a DB.
$ErrorActionPreference = 'Stop'
$helper = Join-Path $PSScriptRoot 'local-preview-orca.ps1'
$script:testRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:testMode = 'success'
$script:cliCalls = [Collections.Generic.List[object]]::new()

function Assert-Orca($value, [string]$message) { if (-not $value) { throw $message } }
function Get-NetTCPConnection { return $null }
function Test-Path {
  param([string]$LiteralPath)
  if ($LiteralPath -like '*.local-preview.json') { return $false }
  return Microsoft.PowerShell.Management\Test-Path -LiteralPath $LiteralPath
}
function orca-preview-test {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CliArgs)
  $script:cliCalls.Add($CliArgs)
  $global:LASTEXITCODE = 0
  $id = "repo::$script:testRepo"
  $result = @{}
  if ($CliArgs[0] -eq 'status') {
    $result = @{ target = @{ kind = $(if ($script:testMode -eq 'remote') { 'remote' } else { 'local' }) }; runtime = @{ state = 'ready'; reachable = $true } }
    if ($script:testMode -eq 'cli-error') { $global:LASTEXITCODE = 12 }
  } elseif ($CliArgs[0] -eq 'worktree') {
    $result = @{ worktree = @{ id = $id; hostId = 'local'; path = $(if ($script:testMode -eq 'wrong-workspace') { 'C:\unrelated' } else { $script:testRepo }) } }
  } elseif ($CliArgs[1] -eq 'create') {
    Assert-Orca ($CliArgs -contains "id:$id") 'Must create in the exact current workspace.'
    Assert-Orca ($CliArgs -contains 'powershell.exe') 'Must explicitly select the Windows shell.'
    Assert-Orca (-not ($CliArgs -contains '--command')) 'Do not submit startup commands before surface confirmation.'
    $result = @{ terminal = @{ handle = 'term_test'; worktreeId = $id; executionHostId = 'local'; surface = $(if ($script:testMode -eq 'background') { 'background' } else { 'visible' }) } }
  } elseif ($CliArgs[1] -eq 'send') {
    $result = @{ send = @{ accepted = ($script:testMode -ne 'send-rejected') } }
  }
  @{ ok = $true; result = $result } | ConvertTo-Json -Depth 8 -Compress
}

$oldCli = $env:ORCA_CLI_COMMAND
$oldExitCode = $global:LASTEXITCODE
try {
  $env:ORCA_CLI_COMMAND = 'orca-preview-test'
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($helper, [ref]$null, [ref]$parseErrors) | Out-Null
  Assert-Orca (@($parseErrors).Count -eq 0) 'Orca helper must parse in Windows PowerShell.'
  foreach ($launch in @('requested', 'check-only')) {
    $script:testMode = 'success'; $script:cliCalls.Clear()
    $result = & {
      if ($launch -eq 'check-only') { . $helper -CheckOnly }
      else { . $helper }
    } | ConvertFrom-Json
    Assert-Orca ($result.visible -and $result.commandAccepted -and -not $result.ready) 'Accepted input must not be reported as app readiness.'
    $send = @($script:cliCalls | Where-Object { $_[1] -eq 'send' })[0]
    $command = $send[([Array]::IndexOf($send, '--text') + 1)]
    if ($launch -eq 'requested') { Assert-Orca ($command -match '-Approved\b' -and $command -notmatch '-ConfirmApproval') 'A human-requested launch must not require a second typed confirmation.' }
    if ($launch -eq 'check-only') { Assert-Orca ($command -eq 'Write-Output ORCA_LOCAL_PREVIEW_TERMINAL_OK') 'Check-only must never start the app.' }
    Assert-Orca (@($script:cliCalls | Where-Object { $_[1] -eq 'create' }).Count -eq 1) 'Must create only one terminal.'
  }
  foreach ($failure in @('wrong-workspace', 'remote', 'background', 'send-rejected', 'cli-error')) {
    $script:testMode = $failure; $script:cliCalls.Clear(); $blocked = $false
    try { & { . $helper } | Out-Null } catch { $blocked = $true }
    Assert-Orca $blocked "Must fail closed for $failure."
    $creates = @($script:cliCalls | Where-Object { $_[1] -eq 'create' }).Count
    $sends = @($script:cliCalls | Where-Object { $_[1] -eq 'send' }).Count
    Assert-Orca ($creates -le 1 -and $sends -le 1) 'Must not retry an uncertain launch.'
    if ($failure -ne 'send-rejected') { Assert-Orca ($sends -eq 0) 'Unsafe workspace/surface/CLI must not receive any command.' }
    if ($failure -in @('wrong-workspace', 'remote', 'cli-error')) { Assert-Orca ($creates -eq 0) 'Invalid runtime/workspace must not create a terminal.' }
  }
} finally {
  $env:ORCA_CLI_COMMAND = $oldCli
  $global:LASTEXITCODE = $oldExitCode
}
Write-Output 'Orca preview workspace, visible-surface, approval and no-retry checks passed (mocked CLI only).'
