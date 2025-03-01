const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Create a new pool using the connection string from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateBookCovers() {
  try {
    // Get all books
    const { rows: books } = await pool.query('SELECT id, title FROM books');
    
    console.log('Found books:', books);
    
    // Update each book's cover image
    for (const book of books) {
      const title = book.title.toLowerCase().replace(/\s+/g, '-');
      const coverPath = `/static/images/covers/${title}.svg`;
      
      // Update the book record
      const result = await pool.query(
        'UPDATE books SET cover_image = $1 WHERE id = $2 RETURNING *',
        [coverPath, book.id]
      );
      
      console.log(`Updated book ${book.id} (${book.title}) with cover: ${coverPath}`);
    }
    
    console.log('All book covers updated successfully!');
  } catch (error) {
    console.error('Error updating book covers:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the function
updateBookCovers(); 