#!/bin/bash

# Define working directory
WORKSPACE="/var/www/cloud"
cd $WORKSPACE

# Set up logging
LOG_FILE="$WORKSPACE/server-startup.log"
exec > >(tee -a "$LOG_FILE") 2>&1
echo "$(date): Starting server deployment..."

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
./node_modules/.bin/tsc -p tsconfig.production.json || {
  echo "$(date): WARNING: TypeScript build had issues but we'll continue"
}

echo "$(date): Starting server..."
node dist/index.js 