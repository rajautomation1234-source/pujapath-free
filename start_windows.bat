@echo off
setlocal
cd /d %~dp0

echo Starting PujaPath backend...
start "PujaPath Backend" cmd /k "cd backend && if not exist .venv python -m venv .venv && call .venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --reload --port 8000"

echo Starting PujaPath frontend...
start "PujaPath Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo Two terminals are opening.
echo Frontend: http://localhost:5173
 echo Backend:  http://127.0.0.1:8000/docs
pause
