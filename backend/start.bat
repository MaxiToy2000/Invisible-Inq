@echo off
REM Startup script for Windows to run the FastAPI backend with auto-reload
REM This avoids multiprocessing issues with neo4j on Windows

cd /d "%~dp0"

REM Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

REM Run using run.py which includes proper error handling and port checking
python run.py

pause

