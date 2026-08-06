# Tournament Central Development Launcher
$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$scriptPath = Join-Path $projectRoot 'scripts\start-tournament-central.ps1'

if (-not (Test-Path $scriptPath)) {
  Write-Error "Starter script not found at $scriptPath"
  exit 1
}

if (-not $env:TOURNAMENT_CENTRAL_PORT) {
  $env:TOURNAMENT_CENTRAL_PORT = '4000'
}

& $scriptPath
