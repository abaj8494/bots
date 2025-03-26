import fs from 'fs';
import path from 'path';
import { createBook, getAllBooks } from '../models/Book';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Base URL for serving static files
const SERVER_URL = process.env.SERVER_URL || 'https://api.bots.abaj.ai';

// Book metadata
const bookMetadata: Record<string, { author: string, description: string }> = {
  '1984.txt': {
    author: 'George Orwell',
    description: 'A dystopian novel set in a totalitarian society where critical thought is suppressed under a totalitarian regime.'
  },
  'hamlet.txt': {
    author: 'William Shakespeare',
    description: 'The Tragedy of Hamlet, Prince of Denmark, a play about revenge, betrayal, and moral corruption.'
  },
  'brave-new-world.txt': {
    author: 'Aldous Huxley',
    description: 'A dystopian novel set in a futuristic World State, inhabited by genetically modified citizens and an intelligence-based social hierarchy.'
  },
  'the-great-gatsby.txt': {
    author: 'F. Scott Fitzgerald',
    description: 'A novel that follows a cast of characters living in the fictional town of West Egg on Long Island during the summer of 1922.'
  },
  'wealth-of-nations.txt': {
    author: 'Adam Smith',
    description: 'An economics book that describes the genesis of a modern economic system.'
  }
};

async function importBooks() {
  const txtDir = path.join(__dirname, '../../txt');
  const coversDir = path.join(__dirname, '../../covers');
  
  try {
    // Check if directories exist
    if (!fs.existsSync(txtDir)) {
      console.error(`Text directory not found: ${txtDir}`);
      return;
    }
    
    if (!fs.existsSync(coversDir)) {
      console.error(`Covers directory not found: ${coversDir}`);
      console.log('Will use default cover images');
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
    
    // Copy SVG files to public directory to make them accessible
    const publicDir = path.join(__dirname, '../../public/covers');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
      console.log(`Created public covers directory: ${publicDir}`);
    }
    
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
        
        // Get metadata
        const metadata = bookMetadata[file] || {
          author: 'Unknown',
          description: `A book titled ${title}`
        };
        
        // Check for corresponding cover file
        const coverFileName = file.replace('.txt', '.svg');
        const coverPath = path.join(coversDir, coverFileName);
        let coverImageUrl = `${SERVER_URL}/static/covers/default.svg`; // Default cover
        
        if (fs.existsSync(coverPath)) {
          // Copy the SVG file to public directory
          const targetPath = path.join(publicDir, coverFileName);
          fs.copyFileSync(coverPath, targetPath);
          console.log(`Copied cover image to: ${targetPath}`);
          coverImageUrl = `${SERVER_URL}/static/covers/${coverFileName}`;
        } else {
          console.log(`No cover image found for ${file}, using default`);
        }
        
        // Create book in database
        const newBook = await createBook({
          title,
          author: metadata.author,
          description: metadata.description,
          content,
          cover_image: coverImageUrl
        });
        
        console.log(`Imported book: ${title} by ${metadata.author} with cover: ${coverImageUrl}`);
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