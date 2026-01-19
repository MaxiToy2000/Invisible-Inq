#!/bin/bash

echo "=========================================="
echo "Admin Dashboard Setup Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if admin/.env exists
if [ ! -f "admin/.env" ]; then
    echo -e "${YELLOW}Creating admin/.env file...${NC}"
    cat > admin/.env << EOF
# Backend API URL
VITE_API_BASE_URL=http://localhost:8000
EOF
    echo -e "${GREEN}✓ Created admin/.env${NC}"
else
    echo -e "${GREEN}✓ admin/.env already exists${NC}"
fi

# Check if backend/.env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Warning: backend/.env not found${NC}"
    echo "Please create backend/.env from backend/env.example"
else
    echo -e "${GREEN}✓ backend/.env exists${NC}"
fi

# Check if node_modules exists in admin
if [ ! -d "admin/node_modules" ]; then
    echo -e "${YELLOW}Installing admin dependencies...${NC}"
    cd admin
    npm install
    cd ..
    echo -e "${GREEN}✓ Admin dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Admin dependencies already installed${NC}"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Create an admin user:"
echo "   cd backend"
echo "   python create_admin.py"
echo ""
echo "2. Start the backend (if not already running):"
echo "   cd backend"
echo "   python main.py"
echo ""
echo "3. Start the admin dashboard:"
echo "   cd admin"
echo "   npm run dev"
echo ""
echo "4. Access the admin dashboard at:"
echo "   http://localhost:3001"
echo ""
echo "=========================================="
