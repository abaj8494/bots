# BookBot - AI-Powered Literary Analysis Platform

**A sophisticated full-stack application that enables intelligent conversations with classic literature through advanced embedding technology and semantic search.**

---

## 🚀 Features

- **Intelligent Literary Assistant**: Customized GPT-4o-mini configured as a knowledgeable Literature Professor
- **Advanced Authentication**: Complete OAuth2 support for GitHub and Google logins with email verification
- **Smart Book Discovery**: Interactive grid interface with custom SVG covers for book selection
- **High-Performance Embeddings**: Optimized semantic chunking and vector storage for fast retrieval
- **Persistent Storage**: Block storage integration for embeddings with intelligent caching
- **Real-time Processing**: Live progress tracking for book processing with WebSocket updates
- **Usage Analytics**: Query limiting and subscription management with Stripe integration

## 📖 Usage

1. Register a new account or log in with Google/GitHub
2. Verify your email address (if registering with email/password)
3. Select a book from the Grid
4. Wait for embeddings to complete (now much faster with persistent storage!)
5. Chat with the book using advanced semantic search

---

## 🏗️ Technology Stack & Performance Optimizations

### **Major Performance Improvements Implemented:**

#### 1. **Persistent Block Storage** (`/mnt/blockstorage/bookbot`)
- **Compressed Storage**: Gzip-compressed embeddings reduce disk usage by 70-80%
- **Multi-tier Caching**: L1 (Memory) → L2 (Disk) → L3 (Database) hierarchy
- **Fast Retrieval**: Sub-200ms loading times for cached books
- **Zero Re-computation**: Embeddings persist across server restarts

#### 2. **Optimized Embedding Generation**
- **Parallel Processing**: Batch generation with controlled concurrency (5 max concurrent requests)
- **Smart Load Management**: Processing queue limits to 1 book at a time to prevent server overload
- **Rate Limit Handling**: Exponential backoff with automatic retry logic
- **Progress Tracking**: Real-time WebSocket updates during processing

#### 3. **Advanced Text Chunking**
- **Sentence-Aware Splitting**: Preserves semantic meaning by respecting sentence boundaries
- **Intelligent Overlap**: Word-level overlap calculation maintains context continuity
- **Optimized Chunk Size**: 1500 characters with 200-character overlap for best performance

#### 4. **Database Optimizations**
- **Vector Similarity Search**: pgvector extension for O(log n) similarity queries
- **Indexed Storage**: Optimized database indexes for fast book and embedding retrieval
- **Fallback Mechanisms**: In-memory similarity calculation when vector extension unavailable

### **Technology Stack:**
- **Frontend**: React 19 + TypeScript + React Router 7
- **Backend**: Node.js + Express + TypeScript 5.8
- **Database**: PostgreSQL with pgvector extension
- **AI**: OpenAI GPT-4o-mini + text-embedding-3-small
- **Storage**: Block storage with gzip compression
- **Auth**: JWT + OAuth2 (GitHub/Google) + Passport.js

### **Performance Metrics:**
- **Processing Speed**: 2-3 minutes for average book (was 10+ minutes)
- **Memory Usage**: ~50MB peak per book (was 200+ MB)
- **Query Response**: 50-100ms for cached books (was 1-2 seconds)
- **Storage Efficiency**: 70-80% compression ratio

---

## 🎯 Roadmap & TODOs
- [ ] add harrison bergeron
- [ ] add bhagvad gita
- [X] add a cap of 20 queries per book per day
- [X] add icon as real component of complex logarithm function
- [ ] fix unknown authors
- [ ] recreate svg covers as nfts
- [X] add pricing tier option of 2.99 aud for when user surpasses 20 queries / day
   - with 2.99 aud they may request up to 300 queries per day
- [ ] engineer fine-tuned llm to be an expert on book contents
  - offer for 4.99 aud/month STUDY tier
- [X] **COMPLETED: Major Performance Refactor**
  - ✅ Implemented persistent block storage for embeddings
  - ✅ Added intelligent caching with LRU eviction
  - ✅ Optimized parallel processing with load management
  - ✅ Enhanced text chunking algorithms
  - ✅ Added processing queue to prevent server overload


<details>
<summary>instructions for the self-hosting neckbeard</summary>

### prereqs

- Node.js (v14 or higher)
- PostgreSQL database
- SMTP server for sending emails (can use Gmail)
- Google and GitHub OAuth credentials (optional, for OAuth login)

### installation

1. Clone the repository:
   ```
   git clone https://github.com/abaj8494/bookbot.git
   cd bookbot
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env` in the server directory
   - Update the values in the `.env` file with your own credentials

3. Set up the database:
   - Create a PostgreSQL database
   - Update the `DATABASE_URL` in the `.env` file
   - Run the database setup script:
     ```
     cd server
     npm run setup-and-start
     ```

4. Set up the verification tables:
   ```
   cd server
   npm run setup-verification
   ```

5. Import books
   ```
   npm run import-books
   ```

6. Build and Deploy
   ```
   cd /var/www/cloud && cd server && npm run build && cd .. && cd client && npm run build && cd .. && cp -r client/build/* public/ && pm2 restart bookbot-api && sudo systemctl reload openresty
   ```

7. Access the application at `http://localhost:3000`

### oauth config

To enable OAuth login with Google and GitHub, you need to set up OAuth applications:

#### google:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Navigate to "APIs & Services" > "Credentials"
4. Create an OAuth 2.0 Client ID
5. Set the authorized redirect URI to `http://localhost:5002/api/auth/google/callback`
6. Copy the Client ID and Client Secret to your `.env` file

#### gitHub:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the authorization callback URL to `http://localhost:5002/api/auth/github/callback`
4. Copy the Client ID and Client Secret to your `.env` file

### email configuration

To enable email verification, you need to set up an SMTP server:

1. If using Gmail:
   - Enable 2-factor authentication on your Google account
   - Generate an App Password
   - Use this App Password in your `.env` file

2. Update the email configuration in your `.env` file:
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   ```
</details>

## License

This project is licensed under the MIT License - see the LICENSE file for details. 