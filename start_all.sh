#!/bin/bash

# Script to start all services for the admin dashboard

echo "=========================================="
echo "Starting All Services"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Check backend (port 8000)
if check_port 8000; then
    echo -e "${GREEN}✓ Backend already running on port 8000${NC}"
else
    echo -e "${YELLOW}⚠ Backend not running. Start it with:${NC}"
    echo "   cd backend && python main.py"
fi

# Check main app (port 3000 or 5173)
if check_port 3000 || check_port 5173; then
    echo -e "${GREEN}✓ Main app already running${NC}"
else
    echo -e "${YELLOW}⚠ Main app not running. Start it with:${NC}"
    echo "   npm run dev"
fi

# Check admin dashboard (port 3001)
if check_port 3001; then
    echo -e "${GREEN}✓ Admin dashboard already running on port 3001${NC}"
else
    echo -e "${YELLOW}⚠ Admin dashboard not running. Start it with:${NC}"
    echo "   cd admin && npm run dev"
fi

echo ""
echo "=========================================="
echo "Service URLs"
echo "=========================================="
echo -e "${BLUE}Main App:${NC}       http://localhost:3000"
echo -e "${BLUE}Admin Dashboard:${NC} http://localhost:3001"
echo -e "${BLUE}Backend API:${NC}     http://localhost:8000"
echo ""
echo "=========================================="
echo "Quick Commands"
echo "=========================================="
echo ""
echo "Start Backend:"
echo "  cd backend && python main.py"
echo ""
echo "Start Main App:"
echo "  npm run dev"
echo ""
echo "Start Admin Dashboard:"
echo "  cd admin && npm run dev"
echo ""
echo "Create Admin User:"
echo "  cd backend && python create_admin.py"
echo ""
echo "Verify Setup:"
echo "  python3 verify_admin_setup.py"
echo ""
echo "=========================================="
