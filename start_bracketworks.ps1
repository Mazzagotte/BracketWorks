# BracketWorks Development Launcher

$FrontendPath = Join-Path $PSScriptRoot "frontend"
$Port         = 3000
$BackendUrl   = "https://bracketworks-backend.onrender.com"

# Ensure Node.js is in PATH
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
}

Write-Host ""
Write-Host "  BracketWorks" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:$Port" -ForegroundColor Green
Write-Host "  Backend  : $BackendUrl" -ForegroundColor Yellow
Write-Host ""

# Start frontend in a new window
$cmd = "Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned; " +
       "cd '$FrontendPath'; " +
       "`$env:NEXT_PUBLIC_BACKEND_URL='$BackendUrl'; " +
       "npm run dev; " +
       "Read-Host 'Press Enter to close'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd

# Wait for frontend then open browser
Write-Host "Waiting for frontend to be ready..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        $ready = $true; break
    } catch {}
}

if ($ready) {
    Write-Host "Ready! Opening http://localhost:$Port" -ForegroundColor Green
} else {
    Write-Host "Frontend is taking a while - opening browser anyway (it may still be compiling)." -ForegroundColor Yellow
}
Start-Process "http://localhost:$Port"
