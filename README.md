# BookBot

BookBot is a full-stack web application that connects publicly available books to the OpenAI API, allowing users to chat with books using AI.

## Features

- Browse a collection of classic books
- Chat with books using OpenAI's GPT-4o-mini model
- User authentication system
- Responsive UI

## Tech Stack

- **Frontend**: React, TypeScript, CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **AI**: OpenAI API (GPT-4o-mini)

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL
- OpenAI API key

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd bookbot
```

### 2. Set up the database

Create a PostgreSQL database named `bookbot`:

```bash
createdb bookbot
```

### 3. Configure environment variables

Create a `.env` file in the `server` directory with the following variables:

```
PORT=5001
NODE_ENV=development
DATABASE_URL=postgres://<username>:<password>@localhost:5432/bookbot
JWT_SECRET=your_jwt_secret_key_change_this_in_production
OPENAI_API_KEY=your_openai_api_key
```

Replace `<username>` and `<password>` with your PostgreSQL credentials.

### 4. Install dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 5. Add book text files

Place `.txt` files of books you want to import in the `server/txt` directory. The application comes with several classic books:

- 1984.txt
- brave-new-world.txt
- hamlet.txt
- the-great-gatsby.txt
- wealth-of-nations.txt

### 6. Run the application

#### Option 1: Run with automatic book import

```bash
cd server
npm run setup-and-start
```

This will:
1. Import all books from the `txt` directory into the database
2. Start the server on port 5001

#### Option 2: Run server and client separately

Terminal 1:
```bash
cd server
npm run dev
```

Terminal 2:
```bash
cd client
npm start
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Browse the available books
3. Select a book to chat with
4. Ask questions about the book and get AI-powered responses

## API Endpoints

### Books

- `GET /api/books` - Get all books
- `GET /api/books/:id` - Get a specific book
- `POST /api/books` - Add a new book (requires authentication)
- `PUT /api/books/:id` - Update a book (requires authentication)
- `DELETE /api/books/:id` - Delete a book (requires authentication)

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user (requires authentication)
- `POST /api/auth/apikey` - Save or update OpenAI API key (requires authentication)
- `GET /api/auth/apikey` - Check if user has an API key (requires authentication)

### Chat

- `POST /api/chat/:bookId` - Send a message to chat with a book (requires authentication)
- `GET /api/chat/:bookId` - Get chat history for a book (requires authentication)
- `DELETE /api/chat/:bookId` - Delete chat history for a book (requires authentication)

## License

MIT 