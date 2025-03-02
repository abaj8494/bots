# BookBot - Chat with Your Favorite Books

BookBot is an AI-powered application that allows users to chat with their favorite books. The application uses natural language processing to generate responses based on the content of the books.

## Features

- User authentication with email/password and OAuth (Google, GitHub)
- Email verification for new accounts
- Chat with books using AI
- Responsive UI for desktop and mobile

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- SMTP server for sending emails (can use Gmail)
- Google and GitHub OAuth credentials (optional, for OAuth login)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/bookbot.git
   cd bookbot
   ```

2. Install dependencies for both client and server:
   ```
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` in the server directory
   - Update the values in the `.env` file with your own credentials

4. Set up the database:
   - Create a PostgreSQL database
   - Update the `DATABASE_URL` in the `.env` file
   - Run the database setup script:
     ```
     cd server
     npm run setup-and-start
     ```

5. Set up the verification tables:
   ```
   cd server
   npm run setup-verification
   ```

6. Start the development servers:
   ```
   # Start the server (in one terminal)
   cd server
   npm run dev

   # Start the client (in another terminal)
   cd client
   npm start
   ```

7. Access the application at `http://localhost:3000`

### OAuth Configuration

To enable OAuth login with Google and GitHub, you need to set up OAuth applications:

#### Google OAuth Setup:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Navigate to "APIs & Services" > "Credentials"
4. Create an OAuth 2.0 Client ID
5. Set the authorized redirect URI to `http://localhost:5002/api/auth/google/callback`
6. Copy the Client ID and Client Secret to your `.env` file

#### GitHub OAuth Setup:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the authorization callback URL to `http://localhost:5002/api/auth/github/callback`
4. Copy the Client ID and Client Secret to your `.env` file

### Email Configuration

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

## Usage

1. Register a new account or log in with Google/GitHub
2. Verify your email address (if registering with email/password)
3. Select a book from the dropdown menu
4. Start chatting with the book!

## License

This project is licensed under the MIT License - see the LICENSE file for details. 