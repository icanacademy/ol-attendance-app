#!/bin/bash

# Attendance Tracker Launcher
# This script starts both the backend and frontend servers and opens the app

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$APP_DIR/server"
CLIENT_DIR="$APP_DIR/client"

# Load port from .env if available, otherwise use defaults
if [ -f "$SERVER_DIR/.env" ]; then
    source "$SERVER_DIR/.env"
fi

BACKEND_PORT="${PORT:-5001}"
FRONTEND_PORT="5174"
FRONTEND_URL="http://localhost:$FRONTEND_PORT"
BACKEND_URL="http://localhost:$BACKEND_PORT"

echo "=========================================="
echo "  Attendance Tracker Launcher"
echo "=========================================="

# Check if node_modules exist, if not install
if [ ! -d "$SERVER_DIR/node_modules" ]; then
    echo "Installing server dependencies..."
    cd "$SERVER_DIR" && npm install
fi

if [ ! -d "$CLIENT_DIR/node_modules" ]; then
    echo "Installing client dependencies..."
    cd "$CLIENT_DIR" && npm install
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $SERVER_PID 2>/dev/null
    kill $CLIENT_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend server
echo "Starting backend server on port 5001..."
cd "$SERVER_DIR" && npm run dev &
SERVER_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -s "$BACKEND_URL/api/attendance/health" > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

# Start frontend
echo "Starting frontend on port 5174..."
cd "$CLIENT_DIR" && npm run dev &
CLIENT_PID=$!

# Wait for frontend to be ready
echo "Waiting for frontend to start..."
for i in {1..30}; do
    if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
        echo "Frontend is ready!"
        break
    fi
    sleep 1
done

# Open in default browser (macOS)
echo "Opening app in browser..."
open "$FRONTEND_URL"

echo ""
echo "=========================================="
echo "  Servers are running!"
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo "  Press Ctrl+C to stop"
echo "=========================================="

# Wait for both processes
wait
