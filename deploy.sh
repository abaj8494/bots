#!/bin/bash

# Legacy deployment script - redirects to optimized version
echo "🚀 BookBot Deployment"
echo "Redirecting to optimized deployment script..."
echo ""

# Check if optimized script exists
if [ -f "./deploy-optimized.sh" ]; then
    echo "✅ Using performance-optimized deployment script"
    ./deploy-optimized.sh "$@"
else
    echo "⚠️  Optimized script not found, using legacy deployment..."
    echo "Note: This will not include persistent storage optimizations"
    
    cd /var/www/bots && \
    cd server && npm run build && \
    cd .. && cd client && npm run build && \
    cd .. && cp -r client/build/* public/ && \
    pm2 restart bookbot-api && \
    sudo systemctl reload openresty
    
    echo "✅ Legacy deployment completed"
    echo "💡 For better performance, use: ./deploy-optimized.sh"
fi
