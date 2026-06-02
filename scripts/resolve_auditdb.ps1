<#
.SYNOPSIS
  Backup and resolve merge conflict for backend/audit.db by accepting 'theirs' or 'ours'.

USAGE
  .\resolve_auditdb.ps1 -Choice theirs
  .\resolve_auditdb.ps1 -Choice ours -ForceKill

PARAMETERS
  -Choice  : 'theirs' to accept upstream/main version, 'ours' to keep current branch version. Default: 'theirs'
  -ForceKill : If set, attempts to stop Node processes before checkout (may be necessary on Windows when file is locked).
#>

[CmdletBinding()]
param(
  [ValidateSet('theirs','ours')]
  [string]$Choice = 'theirs',
  [switch]$ForceKill
)

Set-StrictMode -Version Latest

Write-Host "Backing up backend/audit.db..."
if (!(Test-Path -Path "backend/audit.db")) {
  Write-Error "backend/audit.db not found in repository root. Run from repository root."
  exit 1
}

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Path tmp -Force | Out-Null
try {
  Copy-Item -Path backend\audit.db -Destination ("tmp\audit.db.$ts.bak") -ErrorAction Stop
  Write-Host "Backup created: tmp\audit.db.$ts.bak"
} catch {
  Write-Warning "Backup failed: $_.Exception.Message"
}

if ($ForceKill) {
  Write-Host "Stopping node processes (force)..."
  Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force }
}

Write-Host "Resolving merge by accepting '$Choice' for backend/audit.db"
git checkout --$Choice -- backend/audit.db
if ($LASTEXITCODE -ne 0) {
  Write-Error "git checkout failed. If file is locked, try running without Git Bash (PowerShell as admin) or reboot."
  exit 2
}

git add backend/audit.db
git commit -m "Resolve merge: accept $Choice for backend/audit.db" || Write-Host "Nothing to commit or commit failed."

Write-Host "Merge resolution attempted. Please run 'git status' and 'git log --oneline -n 5' to verify."
Write-Host "To untrack the DB file permanently, run scripts\untrack_auditdb.ps1"
