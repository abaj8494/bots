# BookBot Pre-Deployment Checklist

## 🚀 Performance Optimization Deployment

Before running the deployment script, ensure the following prerequisites are met:

### ✅ **System Requirements**

- [ ] **Block Storage Available**: `/mnt/blockstorage/bookbot` directory exists and is writable
  ```bash
  sudo mkdir -p /mnt/blockstorage/bookbot
  sudo chown $USER:$USER /mnt/blockstorage/bookbot
  ```

- [ ] **Database Access**: PostgreSQL is running and accessible
  ```bash
  psql $DATABASE_URL -c "SELECT version();"
  ```

- [ ] **Node.js Version**: Node.js v16+ is installed
  ```bash
  node --version
  ```

- [ ] **PM2 Installed**: Process manager is available
  ```bash
  pm2 --version
  ```

### ✅ **Environment Configuration**

- [ ] **Environment Variables**: All required variables are set in `server/.env`
  - `DATABASE_URL`
  - `OPENAI_API_KEY`
  - `JWT_SECRET`
  - `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`
  - Optional: `GITHUB_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `STRIPE_SECRET_KEY`

- [ ] **Database Connection**: Test database connectivity
  ```bash
  cd server && npm run setup-database
  ```

### ✅ **Performance Features**

- [ ] **pgvector Extension**: (Optional) For enhanced vector similarity search
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

- [ ] **Disk Space**: Ensure adequate space in `/mnt/blockstorage/bookbot`
  ```bash
  df -h /mnt/blockstorage/bookbot
  ```

### ✅ **Backup Strategy**

- [ ] **Current Backup**: Existing deployment is backed up
- [ ] **Database Backup**: Recent database backup exists
- [ ] **Environment Backup**: `.env` files are backed up securely

### ✅ **Network Configuration**

- [ ] **Ports Available**: 
  - Port 5001 (API server)
  - Port 3000 (Client dev server, if needed)

- [ ] **Reverse Proxy**: nginx/openresty configuration is ready
- [ ] **SSL Certificates**: HTTPS certificates are valid

### ✅ **Dependencies**

- [ ] **Server Dependencies**: All npm packages are installable
  ```bash
  cd server && npm install --dry-run
  ```

- [ ] **Client Dependencies**: React build dependencies available
  ```bash
  cd client && npm install --dry-run
  ```

### ✅ **Testing**

- [ ] **Unit Tests**: Core functionality tests pass (if applicable)
- [ ] **Integration Tests**: Database connectivity works
- [ ] **API Tests**: Critical endpoints respond correctly

---

## 🔧 **Deployment Commands**

### **Option 1: Full Optimized Deployment** (Recommended)
```bash
./deploy-optimized.sh
```

### **Option 2: Step-by-Step Deployment**
```bash
# 1. Setup storage
cd server && npm run setup-storage

# 2. Run migrations
npm run migrate

# 3. Build and deploy
cd .. && ./deploy.sh
```

### **Option 3: Manual Deployment**
```bash
# 1. Build server
cd server && npm run build

# 2. Build client
cd ../client && npm run build

# 3. Copy static files
cd .. && cp -r client/build/* public/

# 4. Restart services
pm2 restart bookbot-api
sudo systemctl reload openresty
```

---

## 🏥 **Post-Deployment Verification**

### **Health Checks**
- [ ] **Basic Health**: `curl http://localhost:5001/health`
- [ ] **Detailed Health**: `curl http://localhost:5001/health/detailed`
- [ ] **API Response**: `curl http://localhost:5001/api/books`

### **Performance Verification**
- [ ] **Storage Stats**: Check `/api/embeddings/stats`
- [ ] **Processing Queue**: Verify book processing works
- [ ] **Cache Performance**: Monitor response times

### **Monitoring Setup**
- [ ] **PM2 Status**: `pm2 status`
- [ ] **Logs Monitoring**: `pm2 logs bookbot-api`
- [ ] **Disk Usage**: Monitor `/mnt/blockstorage/bookbot` usage

---

## 🚨 **Rollback Plan**

If deployment fails:

1. **Stop New Services**:
   ```bash
   pm2 stop bookbot-api
   ```

2. **Restore from Backup**:
   ```bash
   cp -r /var/www/backups/bookbot/bookbot_TIMESTAMP/* /var/www/bots/
   ```

3. **Restart Previous Version**:
   ```bash
   pm2 start bookbot-api
   ```

4. **Verify Rollback**:
   ```bash
   curl http://localhost:5001/health
   ```

---

## 📊 **Performance Expectations**

After successful deployment:

- **Book Processing**: 2-3 minutes (vs 10+ minutes previously)
- **Query Response**: 50-100ms for cached books
- **Memory Usage**: ~50MB per book (vs 200+ MB previously)
- **Storage Efficiency**: 70-80% compression ratio
- **Zero Re-computation**: Embeddings persist across restarts

---

## 📞 **Support**

If issues arise during deployment:

1. Check the deployment logs
2. Verify all checklist items
3. Review PM2 logs: `pm2 logs bookbot-api`
4. Check health endpoints for detailed error information
5. Consider rolling back and investigating the issue

---

**Ready to deploy? Run: `./deploy-optimized.sh`** 🚀
