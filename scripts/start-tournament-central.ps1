$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$appPath = Join-Path $repoRoot 'apps/tournament-central-web'
if (-not (Test-Path $appPath)) {
  Write-Error "Tournament Central app directory not found at $appPath"
  exit 1
}

$port = if ($env:TOURNAMENT_CENTRAL_PORT) { $env:TOURNAMENT_CENTRAL_PORT } else { '4000' }
if (-not $env:NEXT_PUBLIC_BACKEND_URL) {
  $env:NEXT_PUBLIC_BACKEND_URL = 'http://localhost:8001'
}

function Test-PortInUse {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

function Test-LocalHttpReady {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  try {
    $null = Invoke-WebRequest -Uri ("http://localhost:{0}" -f $Port) -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

$portNumber = 0
if (-not [int]::TryParse($port, [ref]$portNumber)) {
  Write-Error "Invalid TOURNAMENT_CENTRAL_PORT value '$port'. Use a numeric port such as 4000."
  exit 1
}

if (Test-PortInUse -Port $portNumber) {
  if (Test-LocalHttpReady -Port $portNumber) {
    Write-Host "Tournament Central is already running at http://localhost:$portNumber. Not restarting." -ForegroundColor Green
  } else {
    Write-Host "Port $portNumber is already in use. Assuming an existing local server and not restarting." -ForegroundColor Yellow
  }
  exit 0
}

Set-Location $repoRoot
$appNextPath = Join-Path $appPath 'node_modules\next\dist\bin\next'
$rootNextPath = Join-Path $repoRoot 'node_modules\next\dist\bin\next'
$statePath = Join-Path $appPath '.bw-frontend-install-state.json'
$lockPath = Join-Path $repoRoot 'pnpm-lock.yaml'
$packagePath = Join-Path $appPath 'package.json'
$manifestPath = if (Test-Path $lockPath) { $lockPath } else { $packagePath }

if (-not (Test-Path $manifestPath)) {
  Write-Error "Tournament Central dependency manifest not found at $manifestPath"
  exit 1
}

$dependencyHash = (Get-FileHash -Path $manifestPath -Algorithm SHA256).Hash
$installNeeded = $false
$installReason = ''

if ((-not (Test-Path $appNextPath)) -and (-not (Test-Path $rootNextPath))) {
  $installNeeded = $true
  $installReason = 'Next.js runtime is missing'
} elseif (-not (Test-Path $statePath)) {
  $installNeeded = $true
  $installReason = 'dependency state file is missing'
} else {
  try {
    $state = Get-Content -Path $statePath -Raw | ConvertFrom-Json
    if (-not $state.DependencyHash) {
      $installNeeded = $true
      $installReason = 'dependency state is incomplete'
    } elseif ($state.DependencyHash -ne $dependencyHash) {
      $installNeeded = $true
      $installReason = 'dependency manifest changed'
    }
  } catch {
    $installNeeded = $true
    $installReason = 'dependency state is unreadable'
  }
}

if ($installNeeded) {
  Write-Host "Installing Tournament Central dependencies ($installReason)..." -ForegroundColor Yellow
  & pnpm install
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Tournament Central dependency install failed.'
    exit $LASTEXITCODE
  }

  if ((-not (Test-Path $appNextPath)) -and (-not (Test-Path $rootNextPath))) {
    Write-Error 'Next.js CLI not found after dependency install. Run pnpm install from repository root.'
    exit 1
  }

  $stateJson = @{
    InstalledAt = (Get-Date).ToString('O')
    DependencyHash = $dependencyHash
    Manifest = (Split-Path -Leaf $manifestPath)
  } | ConvertTo-Json -Compress
  Set-Content -Path $statePath -Value $stateJson -Encoding UTF8
} else {
  Write-Host 'Tournament Central dependencies match saved state. Skipping install.' -ForegroundColor DarkGreen
}

Set-Location $appPath
$nextCli = if (Test-Path $appNextPath) { $appNextPath } else { $rootNextPath }
if (-not (Test-Path $nextCli)) {
  Write-Error 'Next.js CLI not found after dependency install. Run pnpm install from repository root.'
  exit 1
}

Write-Host "Starting Tournament Central on http://localhost:$port" -ForegroundColor Cyan
Write-Host "Backend URL: $($env:NEXT_PUBLIC_BACKEND_URL)" -ForegroundColor DarkCyan
& node $nextCli dev -p $port
