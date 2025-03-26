cd /var/www/bots && cd server && npm run build && cd .. && cd client && npm run build && cd .. && cp -r client/build/* public/ && pm2 restart bookbot-api && sudo systemctl reload openresty
