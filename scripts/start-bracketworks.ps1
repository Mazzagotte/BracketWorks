$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$appPath = Join-Path $repoRoot 'apps/bracketworks'
if (-not (Test-Path $appPath)) {
  Write-Error "BracketWorks app directory not found at $appPath"
  exit 1
}

$appNextPath = Join-Path $appPath 'node_modules\next\dist\bin\next'
$rootNextPath = Join-Path $repoRoot 'node_modules\next\dist\bin\next'
$statePath = Join-Path $appPath '.bw-frontend-install-state.json'
$lockPath = Join-Path $appPath 'package-lock.json'
$packagePath = Join-Path $appPath 'package.json'
$manifestPath = if (Test-Path $lockPath) { $lockPath } else { $packagePath }

if (-not (Test-Path $manifestPath)) {
  Write-Error "Frontend dependency manifest not found at $manifestPath"
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
  Set-Location $repoRoot
  Write-Host "Installing frontend dependencies ($installReason)..." -ForegroundColor Yellow
  & npm.cmd install --include=dev --no-audit --no-fund --prefer-offline
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Frontend dependency install failed.'
    exit $LASTEXITCODE
  }

  if ((-not (Test-Path $appNextPath)) -and (-not (Test-Path $rootNextPath))) {
    Write-Error 'Next.js runtime binary is still missing after install.'
    exit 1
  }

  $stateJson = @{
    InstalledAt = (Get-Date).ToString('O')
    DependencyHash = $dependencyHash
    Manifest = (Split-Path -Leaf $manifestPath)
  } | ConvertTo-Json -Compress
  Set-Content -Path $statePath -Value $stateJson -Encoding UTF8
} else {
  Write-Host 'Frontend dependencies match saved state. Skipping install.' -ForegroundColor DarkGreen
}

Set-Location $appPath
& npm.cmd run dev
