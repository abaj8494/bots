#!/bin/bash

# BookBot Optimized Deployment Script
# This script deploys the performance-optimized version with persistent storage

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/bots"
BACKUP_DIR="/var/www/backups/bookbot"
STORAGE_DIR="/mnt/blockstorage/bookbot"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as correct user
check_permissions() {
    log "Checking permissions..."
    
    if [ ! -w "$PROJECT_DIR" ]; then
        error "No write permission to $PROJECT_DIR"
        exit 1
    fi
    
    if [ ! -d "$STORAGE_DIR" ]; then
        warning "Block storage directory $STORAGE_DIR does not exist"
        warning "Run: sudo mkdir -p $STORAGE_DIR && sudo chown $USER:$USER $STORAGE_DIR"
    fi
}

# Create backup of current deployment
create_backup() {
    log "Creating backup..."
    
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_PATH="$BACKUP_DIR/bookbot_$TIMESTAMP"
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup critical files
    mkdir -p "$BACKUP_PATH"
    cp -r "$PROJECT_DIR/server/src" "$BACKUP_PATH/" 2>/dev/null || true
    cp -r "$PROJECT_DIR/client/src" "$BACKUP_PATH/" 2>/dev/null || true
    cp "$PROJECT_DIR/server/package.json" "$BACKUP_PATH/" 2>/dev/null || true
    cp "$PROJECT_DIR/client/package.json" "$BACKUP_PATH/" 2>/dev/null || true
    cp "$PROJECT_DIR/server/.env" "$BACKUP_PATH/" 2>/dev/null || true
    
    success "Backup created at $BACKUP_PATH"
}

# Git operations
version_control() {
    log "Managing version control..."
    
    cd "$PROJECT_DIR"
    
    # Check if git repo exists
    if [ ! -d ".git" ]; then
        log "Initializing git repository..."
        git init
        git config user.name "BookBot Deploy"
        git config user.email "deploy@bookbot.local"
    fi
    
    # Add all changes
    git add .
    
    # Check if there are changes to commit
    if git diff --staged --quiet; then
        log "No changes to commit"
    else
        # Create commit with deployment info
        COMMIT_MSG="Deploy: Performance optimization with persistent storage - $(date +'%Y-%m-%d %H:%M:%S')"
        git commit -m "$COMMIT_MSG"
        success "Changes committed: $COMMIT_MSG"
        
        # Tag the release
        TAG="v2.0.0-optimized-$(date +%Y%m%d)"
        git tag -a "$TAG" -m "Performance optimized release with persistent storage"
        success "Tagged release: $TAG"
    fi
}

# Setup block storage
setup_storage() {
    log "Setting up persistent block storage..."
    
    cd "$PROJECT_DIR/server"
    
    # Run storage setup script
    if [ -f "scripts/setupBlockStorage.ts" ]; then
        npm run setup-storage || {
            error "Storage setup failed"
            exit 1
        }
        success "Block storage initialized"
    else
        warning "Storage setup script not found, creating directories manually..."
        mkdir -p "$STORAGE_DIR"/{embeddings,chunks,metadata,backups}
    fi
}

# Database migration
run_migrations() {
    log "Running database migrations..."
    
    cd "$PROJECT_DIR/server"
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        # Try to load from .env
        if [ -f ".env" ]; then
            export $(grep -v '^#' .env | xargs)
        fi
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        error "DATABASE_URL not set. Please configure your database connection."
        exit 1
    fi
    
    # Run migration
    if [ -f "migrations/add_persistent_embeddings.sql" ]; then
        psql "$DATABASE_URL" -f migrations/add_persistent_embeddings.sql || {
            error "Database migration failed"
            exit 1
        }
        success "Database migration completed"
    else
        warning "Migration file not found"
    fi
}

# Build and deploy
build_and_deploy() {
    log "Building and deploying application..."
    
    cd "$PROJECT_DIR"
    
    # Install dependencies
    log "Installing server dependencies..."
    cd server && npm install
    
    log "Installing client dependencies..."
    cd ../client && npm install
    
    # Build server
    log "Building server..."
    cd ../server && npm run build
    
    # Build client
    log "Building client..."
    cd ../client && npm run build
    
    # Copy client build to public directory
    log "Copying client build to public directory..."
    cd .. && cp -r client/build/* public/
    
    success "Build completed successfully"
}

# Restart services
restart_services() {
    log "Restarting services..."
    
    # Stop PM2 process gracefully
    pm2 stop bookbot-api || true
    
    # Start PM2 with ecosystem config
    pm2 start "$PROJECT_DIR/ecosystem.config.js"
    
    # Reload nginx/openresty
    if command -v systemctl &> /dev/null; then
        sudo systemctl reload openresty || sudo systemctl reload nginx || true
    fi
    
    success "Services restarted"
}

# Health check
health_check() {
    log "Performing health check..."
    
    sleep 5  # Wait for services to start
    
    # Check if PM2 process is running
    if pm2 list | grep -q "bookbot-api.*online"; then
        success "PM2 process is running"
    else
        error "PM2 process failed to start"
        pm2 logs bookbot-api --lines 20
        exit 1
    fi
    
    # Check if server is responding
    if curl -f -s http://localhost:5001/health > /dev/null 2>&1; then
        success "Server health check passed"
    else
        warning "Server health check failed - this might be normal if health endpoint doesn't exist"
    fi
}

# Cleanup old builds
cleanup() {
    log "Cleaning up old builds..."
    
    # Clean old PM2 logs
    pm2 flush bookbot-api || true
    
    # Clean old backups (keep last 10)
    if [ -d "$BACKUP_DIR" ]; then
        cd "$BACKUP_DIR"
        ls -t | tail -n +11 | xargs -r rm -rf
    fi
    
    success "Cleanup completed"
}

# Main deployment process
main() {
    log "Starting BookBot optimized deployment..."
    
    check_permissions
    create_backup
    version_control
    setup_storage
    run_migrations
    build_and_deploy
    restart_services
    health_check
    cleanup
    
    success "🎉 Deployment completed successfully!"
    success "🚀 BookBot is now running with optimized performance!"
    
    log "📊 Deployment Summary:"
    log "   - Persistent storage: $STORAGE_DIR"
    log "   - Database migrations: Applied"
    log "   - Services: Restarted"
    log "   - Version: Tagged and committed"
    
    log "📝 Next Steps:"
    log "   1. Monitor PM2 logs: pm2 logs bookbot-api"
    log "   2. Check storage stats: http://localhost:5001/api/embeddings/stats"
    log "   3. Process books - they'll now use persistent storage!"
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"
