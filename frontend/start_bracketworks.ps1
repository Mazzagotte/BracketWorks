# Start Backend in new PowerShell window and keep it open with pause
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:/bracketworks-web/backend'; D:/bracketworks-web/.venv/Scripts/python.exe -m uvicorn app.main:app --reload; pause"

# Start Frontend in new PowerShell window and keep it open with pause
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:/bracketworks-web/frontend'; npm run dev; pause"

# Open the dashboard in your default browser (no extra PowerShell window)
Start-Process "cmd" "/c start http://localhost:3000"