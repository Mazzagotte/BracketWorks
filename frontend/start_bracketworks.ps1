# Start Backend in new PowerShell window and keep it open with pause
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:/bracketworks/backend'; python -m uvicorn app.main:app --reload; pause"


# Auto-install Yarn if not present, then start frontend
if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
	Write-Host 'Yarn not found. Installing globally...'
	npm install -g yarn
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:/bracketworks/frontend'; yarn dev; pause"

# Open the dashboard in your default browser (no extra PowerShell window)
Start-Process cmd -ArgumentList "/c start http://localhost:3000"