<#
.SYNOPSIS
  Add backend/audit.db to .gitignore and stop tracking it in git (keeps local copy).

USAGE
  .\untrack_auditdb.ps1
#>

Set-StrictMode -Version Latest

if (!(Test-Path -Path ".git")) {
  Write-Error "This script must be run from the repository root. .git not found."
  exit 1
}

$ignoreLine = 'backend/audit.db'
if (-not (Test-Path .gitignore)) { New-Item -Path .gitignore -ItemType File | Out-Null }

$contents = Get-Content .gitignore -ErrorAction SilentlyContinue
if ($contents -notcontains $ignoreLine) {
  Add-Content -Path .gitignore -Value $ignoreLine
  Write-Host "Added backend/audit.db to .gitignore"
} else {
  Write-Host "backend/audit.db already present in .gitignore"
}

Write-Host "Removing backend/audit.db from git index (keeps local file)..."
git rm --cached backend/audit.db || Write-Host "git rm --cached failed or file not tracked"
git add .gitignore
git commit -m "Stop tracking backend/audit.db and add to .gitignore" || Write-Host "Nothing to commit or commit failed."
Write-Host "Done. The file will remain locally but no longer be tracked by git."
