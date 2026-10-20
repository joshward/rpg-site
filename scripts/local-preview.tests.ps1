# Standalone Windows regression checks; no 1Password, Neon or database access.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'local-preview.ps1'

function Assert-True($value, [string]$message) {
  if (-not $value) { throw $message }
}

$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$null, [ref]$parseErrors) | Out-Null
Assert-True (@($parseErrors).Count -eq 0) 'Launcher must parse in Windows PowerShell.'

# A decline must return before Git, op or any other preflight command.
& {
  function Read-Host { return 'no' }
  function git { throw 'Git must not run after a declined confirmation.' }
  function op { throw 'op must never run in this test.' }
  . $launcher -ConfirmApproval
}
& {
  function Read-Host { return '' }
  function git { throw 'Git must not run after an empty confirmation.' }
  function op { throw 'op must never run in this test.' }
  . $launcher -ConfirmApproval
}

# Running without either approval mode must fail before preflight.
& {
  function git { throw 'Git must not run before approval.' }
  function op { throw 'op must never run in this test.' }
  $blocked = $false
  try { . $launcher } catch { $blocked = $_.Exception.Message -like 'Ask the human to approve*' }
  Assert-True $blocked 'An unapproved launch must fail closed.'
}

# Yes reaches preflight, but fake Git stops it without inspecting local secrets.
& {
  function Read-Host { return 'yes' }
  function git { throw 'approved-preflight-reached' }
  function op { throw 'op must never run in this test.' }
  $reached = $false
  try { . $launcher -ConfirmApproval } catch { $reached = $_.Exception.Message -eq 'approved-preflight-reached' }
  Assert-True $reached 'An explicit yes must advance to preflight.'
}

& (Join-Path $PSScriptRoot 'local-preview-orca.tests.ps1')
Write-Output 'Local preview approval and Orca launch checks passed (no secrets or DB access).'
