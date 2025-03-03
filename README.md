# BookBot - Prepopulate your GPT4o-mini context window with Public Domain books 

## Features

- customised GPT to be a knowledgable Arts Professor
- full auth including oauthv2 support for Github and Google logins
- email verification
- book grid with covers to select a book
- chunking to split large books into manageable partitions

## Usage

1. Register a new account or log in with Google/GitHub
2. Verify your email address (if registering with email/password)
3. Select a book from the Grid
4. Wait for embeddings to complete
5. Chat with the book

## TODOs
- [X] add a cap of 20 queries per book per day
- [X] add icon as real component of complex logarithm function
- [ ] fix unknown authors
- [ ] recreate svg covers as nfts
- [ ] add pricing tier option of 2.99 aud for when user surpasses 20 queries / day
   - with 2.99 aud they may request up to 300 queries per day
- [ ] engineer fine-tuned llm to be an expert on book contents
  - offer for 4.99 aud/month STUDY tier


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