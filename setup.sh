#!/bin/bash

# Daily Academic - Setup Script
# This script helps you set up the development environment

echo "🚀 Daily Academic Setup Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running from the correct directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the app/ directory"
    exit 1
fi

echo "Step 1: Setting up Backend"
echo "--------------------------"

# Check for Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi
print_success "Python 3 is installed"

# Backend setup
cd backend

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning ".env file created from .env.example"
        print_warning "Please edit backend/.env and add your Clerk keys!"
    else
        print_error ".env.example not found"
    fi
else
    print_success ".env file already exists"
fi

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    print_success "Python dependencies installed"
else
    print_error "Failed to install Python dependencies"
    exit 1
fi

cd ..

echo ""
echo "Step 2: Setting up Frontend"
echo "---------------------------"

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi
print_success "Node.js is installed"

# Frontend setup
cd frontend

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning ".env file created from .env.example"
        print_warning "Please edit frontend/.env and add your Clerk publishable key!"
    else
        print_error ".env.example not found"
    fi
else
    print_success ".env file already exists"
fi

# Install npm dependencies
echo ""
echo "Installing npm dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "npm dependencies installed"
else
    print_error "Failed to install npm dependencies"
    exit 1
fi

cd ..

echo ""
echo "================================"
echo "✨ Setup Complete!"
echo "================================"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Get your Clerk API keys:"
echo "   - Visit https://clerk.com and create an account"
echo "   - Create a new application"
echo "   - Enable Google and Microsoft OAuth"
echo "   - Copy your API keys"
echo ""
echo "2. Configure environment variables:"
echo "   - Edit backend/.env and add:"
echo "     CLERK_PUBLISHABLE_KEY=pk_test_..."
echo "     CLERK_SECRET_KEY=sk_test_..."
echo ""
echo "   - Edit frontend/.env and add:"
echo "     VITE_CLERK_PUBLISHABLE_KEY=pk_test_..."
echo ""
echo "3. Start the development servers:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   $ cd backend"
echo "   $ uvicorn main:app --reload --port 8000"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   $ cd frontend"
echo "   $ npm run dev"
echo ""
echo "4. Open http://localhost:5173 in your browser"
echo ""
echo "📚 Documentation:"
echo "   - QUICKSTART.md - Quick setup guide"
echo "   - README.md - Full documentation"
echo "   - EXAMPLES.md - Code examples"
echo "   - CHECKLIST.md - Verification checklist"
echo ""
print_success "Happy coding! 🎉"
