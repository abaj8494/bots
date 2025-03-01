import fs from 'fs';
import path from 'path';
import { createBook, getAllBooks } from '../models/Book';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Book metadata
const bookMetadata: Record<string, { author: string, description: string, coverImage: string }> = {
  '1984.txt': {
    author: 'George Orwell',
    description: 'A dystopian novel set in a totalitarian society where critical thought is suppressed under a totalitarian regime.',
    coverImage: 'https://example.com/1984.jpg'
  },
  'hamlet.txt': {
    author: 'William Shakespeare',
    description: 'The Tragedy of Hamlet, Prince of Denmark, a play about revenge, betrayal, and moral corruption.',
    coverImage: 'https://example.com/hamlet.jpg'
  },
  'brave-new-world.txt': {
    author: 'Aldous Huxley',
    description: 'A dystopian novel set in a futuristic World State, inhabited by genetically modified citizens and an intelligence-based social hierarchy.',
    coverImage: 'https://example.com/brave-new-world.jpg'
  },
  'the-great-gatsby.txt': {
    author: 'F. Scott Fitzgerald',
    description: 'A novel that follows a cast of characters living in the fictional town of West Egg on Long Island during the summer of 1922.',
    coverImage: 'https://example.com/great-gatsby.jpg'
  },
  'wealth-of-nations.txt': {
    author: 'Adam Smith',
    description: 'An economics book that describes the genesis of a modern economic system.',
    coverImage: 'https://example.com/wealth-of-nations.jpg'
  }
};

async function importBooks() {
  const txtDir = path.join(__dirname, '../../txt');
  
  try {
    // Check if directory exists
    if (!fs.existsSync(txtDir)) {
      console.error(`Directory not found: ${txtDir}`);
      return;
    }
    
    // Get all .txt files
    const files = fs.readdirSync(txtDir).filter(file => file.endsWith('.txt'));
    
    if (files.length === 0) {
      console.log('No .txt files found in the directory');
      return;
    }
    
    console.log(`Found ${files.length} .txt files to import`);
    
    // Get existing books to avoid duplicates
    const existingBooks = await getAllBooks();
    const existingTitles = new Set(existingBooks.map(book => book.title.toLowerCase()));
    
    // Import each file
    for (const file of files) {
      try {
        const filePath = path.join(txtDir, file);
        
        // Get title from filename (remove .txt extension)
        const title = file.replace('.txt', '').split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        // Skip if book already exists
        if (existingTitles.has(title.toLowerCase())) {
          console.log(`Book "${title}" already exists, skipping import`);
          continue;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Get metadata or use defaults
        const metadata = bookMetadata[file] || {
          author: 'Unknown',
          description: `A book titled ${title}`,
          coverImage: 'https://example.com/default.jpg'
        };
        
        // Create book in database
        const newBook = await createBook({
          title,
          author: metadata.author,
          description: metadata.description,
          content,
          cover_image: metadata.coverImage
        });
        
        console.log(`Imported book: ${title} by ${metadata.author}`);
      } catch (error) {
        console.error(`Error importing file ${file}:`, error);
      }
    }
    
    console.log('Book import completed');
  } catch (error) {
    console.error('Error during book import:', error);
  }
}

// Run the import function
importBooks().catch(console.error); 