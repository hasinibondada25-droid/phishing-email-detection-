@echo off
echo Starting Flask ML API...
start "Flask" cmd /c "python app\flask_backend.py"

timeout /t 3 /nobreak >nul

echo Starting Node.js Server...
start "Node" cmd /c "node server.js"

echo.
echo Both servers started!
echo - Flask API: http://127.0.0.1:5000
echo - Web UI: http://localhost:3000
echo.
pause