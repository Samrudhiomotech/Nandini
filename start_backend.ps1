# Start Backend - Adaptive Choice Architecture API
Write-Host "Starting ACA Backend on http://localhost:8000" -ForegroundColor Cyan
Write-Host "API docs: http://localhost:8000/docs" -ForegroundColor Gray
& "c:\Users\omote\Nandini\.venv\Scripts\uvicorn.exe" backend.main:app --reload --host 0.0.0.0 --port 8000
