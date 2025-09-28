#!/bin/bash

# Android Device Farm Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Setting up Android Device Farm..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is not supported. Please upgrade to Node.js 18+."
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Check if ADB is installed
if ! command -v adb &> /dev/null; then
    echo "❌ ADB is not installed or not in PATH. Please install Android SDK and add ADB to PATH."
    echo "   Download from: https://developer.android.com/studio/command-line/adb"
    exit 1
fi

echo "✅ ADB $(adb version | head -n1) detected"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Create environment files if they don't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend .env file..."
    cp backend/.env.example backend/.env
    echo "✅ Backend .env file created from example"
fi

if [ ! -f frontend/.env ]; then
    echo "📝 Creating frontend .env file..."
    cp frontend/.env.example frontend/.env
    echo "✅ Frontend .env file created from example"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/uploads/screenshots
mkdir -p backend/uploads/apks
mkdir -p backend/logs

# Check connected devices
echo "📱 Checking connected Android devices..."
DEVICE_COUNT=$(adb devices | grep -v "List of devices" | grep -c "device" || true)

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "⚠️  No Android devices detected."
    echo "   Please connect Android devices with USB debugging enabled."
    echo "   Run 'adb devices' to verify device connection."
else
    echo "✅ $DEVICE_COUNT Android device(s) detected:"
    adb devices | grep "device"
fi

# Build TypeScript for development
echo "🔨 Building TypeScript..."
cd backend && npm run build && cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "To start backend only:"
echo "  npm run dev:backend"
echo ""
echo "To start frontend only:"
echo "  npm run dev:frontend"
echo ""
echo "Web interface will be available at:"
echo "  http://localhost:3000"
echo ""
echo "API server will be available at:"
echo "  http://localhost:5000"
echo ""

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "⚠️  Remember to connect Android devices with USB debugging enabled!"
    echo "   Enable Developer Options and USB Debugging on your Android devices."
fi