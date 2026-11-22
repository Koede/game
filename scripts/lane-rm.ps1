<#
.SYNOPSIS  Removes a lane worktree safely: the node_modules junction goes first (only the link, never the shared modules).
#>
param([Parameter(Mandatory = $true)][string]$Lane, [string]$Parent = 'E:\Projects\hw-lanes', [switch]$DeleteBranch)
$ErrorActionPreference = 'Stop'
$main = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$wt = Join-Path $Parent $Lane
$nm = Join-Path $wt 'node_modules'
if (Test-Path $nm) { cmd /c rmdir "$nm" }
git -C $main worktree remove --force $wt
if ($DeleteBranch) { git -C $main branch -D "lane/$($Lane.ToLower())" }
