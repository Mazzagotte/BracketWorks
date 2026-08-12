$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$appPath = Join-Path $repoRoot 'apps/tournament-central-web'
$backendScriptPath = Join-Path $repoRoot 'scripts/start-backend.ps1'
if (-not (Test-Path $appPath)) {
  Write-Error "Tournament Central app directory not found at $appPath"
  exit 1
}

$port = if ($env:TOURNAMENT_CENTRAL_PORT) { $env:TOURNAMENT_CENTRAL_PORT } else { '4000' }

# Keep TC and BW auth credentials aligned in development by targeting the same backend.
$sharedBackendUrl = if ($env:BACKEND_URL) {
  $env:BACKEND_URL
} elseif ($env:NEXT_PUBLIC_BACKEND_URL) {
  $env:NEXT_PUBLIC_BACKEND_URL
} else {
  'http://localhost:8001'
}

$env:BACKEND_URL = $sharedBackendUrl
$env:NEXT_PUBLIC_BACKEND_URL = $sharedBackendUrl

function Resolve-PnpmCommand {
  $pnpmCmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if ($pnpmCmd) {
    return [pscustomobject]@{ Executable = 'pnpm.cmd'; PrefixArgs = @() }
  }

  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) {
    return [pscustomobject]@{ Executable = 'pnpm'; PrefixArgs = @() }
  }

  $corepackCmd = Get-Command corepack.cmd -ErrorAction SilentlyContinue
  if ($corepackCmd) {
    try {
      & corepack.cmd pnpm --version *> $null
      if ($LASTEXITCODE -eq 0) {
        return [pscustomobject]@{ Executable = 'corepack.cmd'; PrefixArgs = @('pnpm') }
      }
    } catch {}
  }

  $corepack = Get-Command corepack -ErrorAction SilentlyContinue
  if ($corepack) {
    try {
      & corepack pnpm --version *> $null
      if ($LASTEXITCODE -eq 0) {
        return [pscustomobject]@{ Executable = 'corepack'; PrefixArgs = @('pnpm') }
      }
    } catch {}
  }

  return $null
}

function Invoke-Pnpm {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $script:PnpmExecutable @script:PnpmPrefixArgs @Arguments
}

function Install-DependenciesWithBuildApproval {
  param(
    [Parameter(Mandatory = $true)][string]$InstallReason
  )

  Write-Host "Installing Tournament Central dependencies ($InstallReason)..." -ForegroundColor Yellow
  $installOutput = Invoke-Pnpm -Arguments @('install') 2>&1
  $installExitCode = $LASTEXITCODE
  if ($installOutput) {
    $installOutput | ForEach-Object { Write-Host $_ }
  }

  if ($installExitCode -ne 0) {
    Write-Error 'Tournament Central dependency install failed.'
    exit $installExitCode
  }

  $requiresBuildApproval = $false
  foreach ($line in $installOutput) {
    if ("$line" -match 'Ignored build scripts:') {
      $requiresBuildApproval = $true
      break
    }
  }

  if (-not $requiresBuildApproval) {
    return
  }

  Write-Host 'Detected blocked dependency build scripts. Opening pnpm approve-builds...' -ForegroundColor Yellow
  Invoke-Pnpm -Arguments @('approve-builds')
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'pnpm approve-builds did not complete successfully.'
    exit $LASTEXITCODE
  }

  Write-Host 'Re-running dependency install after approvals...' -ForegroundColor Yellow
  Invoke-Pnpm -Arguments @('install')
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Tournament Central dependency install failed after approving builds.'
    exit $LASTEXITCODE
  }
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

function Get-BackendPortFromUrl {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $false)][int]$DefaultPort = 8001
  )

  try {
    $uri = [System.Uri]$Url
    if ($uri.Port -gt 0) {
      return [int]$uri.Port
    }
  } catch {}

  return $DefaultPort
}

function Test-IsLocalBackendUrl {
  param(
    [Parameter(Mandatory = $true)][string]$Url
  )

  try {
    $uri = [System.Uri]$Url
    return $uri.Host -in @('localhost', '127.0.0.1', '::1')
  } catch {
    return $false
  }
}

$portNumber = 0
if (-not [int]::TryParse($port, [ref]$portNumber)) {
  Write-Error "Invalid TOURNAMENT_CENTRAL_PORT value '$port'. Use a numeric port such as 4000."
  exit 1
}

$backendPortNumber = Get-BackendPortFromUrl -Url $sharedBackendUrl
$env:BACKEND_PORT = "$backendPortNumber"

if (Test-IsLocalBackendUrl -Url $sharedBackendUrl) {
  if (Test-PortInUse -Port $backendPortNumber) {
    Write-Host "Backend already listening on http://localhost:$backendPortNumber" -ForegroundColor DarkGreen
  } elseif (Test-Path $backendScriptPath) {
    Write-Host "Starting backend on http://localhost:$backendPortNumber" -ForegroundColor Cyan
    $backendLaunchCommand = "& '$backendScriptPath'"
    Start-Process powershell -ArgumentList @('-NoExit', '-Command', $backendLaunchCommand) | Out-Null
  } else {
    Write-Host "Backend launcher not found at $backendScriptPath" -ForegroundColor Yellow
    Write-Host 'Start backend manually before using Tournament Central.' -ForegroundColor Yellow
  }
} else {
  Write-Host "Using remote backend: $sharedBackendUrl" -ForegroundColor DarkCyan
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

@(
  (Join-Path $repoRoot '.tools\node-v22.22.3-win-x64'),
  'C:\Program Files\nodejs',
  (Join-Path $env:LOCALAPPDATA 'pnpm'),
  (Join-Path $env:APPDATA 'npm')
) | ForEach-Object {
  if ($_ -and (Test-Path $_) -and -not (($env:PATH -split ';') -contains $_)) {
    $env:PATH = "$_;$env:PATH"
  }
}

$pnpmCommand = Resolve-PnpmCommand
if (-not $pnpmCommand) {
  Write-Error 'pnpm not found. Install pnpm (npm install -g pnpm) or enable Corepack (corepack enable).'
  exit 1
}

$script:PnpmExecutable = $pnpmCommand.Executable
$script:PnpmPrefixArgs = $pnpmCommand.PrefixArgs

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
  Install-DependenciesWithBuildApproval -InstallReason $installReason

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
Write-Host "Using shared BW auth backend (same credentials as BracketWorks)." -ForegroundColor Green
& node $nextCli dev -p $port
