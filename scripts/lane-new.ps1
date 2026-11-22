<#
.SYNOPSIS  Creates a lane worktree: git worktree + node_modules junction + generated indexes. No npm install, no copy of the 110 MB modules.
.EXAMPLE   powershell -File scripts/lane-new.ps1 -Lane B
#>
param(
  [Parameter(Mandatory = $true)][string]$Lane,
  [string]$Base = 'ccr-3c8b169f-e78nk2',
  [string]$Parent = 'E:\Projects\hw-lanes'
)
$ErrorActionPreference = 'Stop'
$main = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$wt = Join-Path $Parent $Lane
$branch = "lane/$($Lane.ToLower())"
New-Item -ItemType Directory -Force -Path $Parent | Out-Null
git -C $main worktree add -b $branch $wt $Base
if ($LASTEXITCODE -ne 0) { throw "git worktree add failed" }
New-Item -ItemType Junction -Path (Join-Path $wt 'node_modules') -Target (Join-Path $main 'node_modules') | Out-Null
Push-Location $wt
try { node scripts/gen-indexes.mjs } finally { Pop-Location }
$ports = @{ A = 0; B = 1; C = 2; D = 3; E = 4; F = 5; U = 6 }
$port = 5180 + $(if ($ports.ContainsKey($Lane.ToUpper())) { $ports[$Lane.ToUpper()] } else { 7 })
Write-Host "lane $Lane ready: $wt (branch $branch)"
Write-Host "  `$env:HW_LANE='$($Lane.ToUpper())'   dev: node scripts/build.mjs --watch --serve  -> http://localhost:$port  (build dir .cache\dist)"
Write-Host "  gates: bash scripts/local-check.sh --fast   |   node scripts/e2e-all.mjs --only=<area>   (builds to .cache\dist-e2e)"
