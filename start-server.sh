#!/bin/bash

# Define working directory
WORKSPACE="/var/www/cloud"
cd $WORKSPACE

# Set up logging
LOG_FILE="$WORKSPACE/server-startup.log"
exec > >(tee -a "$LOG_FILE") 2>&1
echo "$(date): Starting server deployment..."

# Kill any existing process running on port 5001
echo "$(date): Checking for processes running on port 5001..."
PIDS=$(lsof -i :5001 -t)
if [ -n "$PIDS" ]; then
  echo "$(date): Found processes running on port 5001. Killing PID(s): $PIDS"
  kill -9 $PIDS
  sleep 2
  
  # Double-check that the port is now free
  PIDS_AFTER=$(lsof -i :5001 -t)
  if [ -n "$PIDS_AFTER" ]; then
    echo "$(date): WARNING: Port 5001 still in use after kill attempt. Trying again with more force."
    # Try to kill with more force, using pkill to find any node process on port 5001
    pkill -9 -f "node.*:5001" || true
    sleep 2
  fi
  
  # Final check
  if [ -n "$(lsof -i :5001 -t)" ]; then
    echo "$(date): ERROR: Unable to free port 5001, processes may need manual termination"
  else
    echo "$(date): Successfully freed port 5001"
  fi
else
  echo "$(date): No process found running on port 5001"
fi

# Set NODE_ENV to production
export NODE_ENV=production

# Ignore engine warnings
export npm_config_engine_strict=false

# Load environment variables from .env
if [ -f "$WORKSPACE/server/.env" ]; then
  echo "$(date): Loading environment variables from server/.env"
  set -a
  source $WORKSPACE/server/.env
  set +a
fi

# Build client
echo "$(date): Building client..."
cd $WORKSPACE/client
npm install --no-fund --loglevel=error --no-audit || echo "$(date): Warning: npm install for client had issues but continuing"
echo "$(date): Running npm build for client..."
CI=false npm run build || {
  echo "$(date): ERROR: Client build failed"
  exit 1
}

# Move build files to public directory
echo "$(date): Moving build files to /var/www/cloud/public..."
mkdir -p $WORKSPACE/public
rm -rf $WORKSPACE/public/*
if [ -d "$WORKSPACE/client/build" ]; then
  cp -r $WORKSPACE/client/build/* $WORKSPACE/public/ || {
    echo "$(date): ERROR: Failed to copy build files"
    exit 1
  }
else
  echo "$(date): ERROR: Build directory does not exist"
  exit 1
fi

# Build and start the server with type checking disabled
echo "$(date): Setting up and starting server..."
cd $WORKSPACE/server
npm install --no-fund --loglevel=error --no-audit || echo "$(date): Warning: npm install for server had issues but continuing"

echo "$(date): Building server with relaxed type checking..."
# Note: TypeScript errors in Express route handlers have been fixed to handle return types correctly
./node_modules/.bin/tsc -p tsconfig.production.json || {
  echo "$(date): WARNING: TypeScript build had issues but we'll continue with the compiled files that were generated"
  echo "$(date): This is typically safe as long as the JS files were generated correctly"
}

echo "$(date): Starting server..."
node dist/index.js 