#!/bin/bash

echo "=========================================="
echo "Starting Backend Server"
echo "=========================================="

# Activate virtual environment
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Please create .env from env.example"
    echo ""
fi

# Start the server
echo "Starting server on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

python main.py
