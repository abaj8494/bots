const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Clean Project Gutenberg text
function cleanText(text) {
  const startMarkers = [
    "*** START OF THE PROJECT GUTENBERG EBOOK",
    "*** START OF THIS PROJECT GUTENBERG EBOOK",
    "***START OF THE PROJECT GUTENBERG EBOOK"
  ];
  
  const endMarkers = [
    "*** END OF THE PROJECT GUTENBERG EBOOK", 
    "*** END OF THIS PROJECT GUTENBERG EBOOK",
    "***END OF THE PROJECT GUTENBERG EBOOK"
  ];
  
  let startPos = 0;
  for (const marker of startMarkers) {
    const pos = text.indexOf(marker);
    if (pos !== -1) {
      const newlinePos = text.indexOf('\n', pos);
      if (newlinePos !== -1) {
        startPos = newlinePos + 1;
      }
      break;
    }
  }
  
  let endPos = text.length;
  for (const marker of endMarkers) {
    const pos = text.indexOf(marker);
    if (pos !== -1) {
      endPos = pos;
      break;
    }
  }
  
  let clean = text.substring(startPos, endPos).trim();
  
  // Clean up extra whitespace
  clean = clean.replace(/\n\s*\n\s*\n+/g, '\n\n');
  clean = clean.replace(/[ \t]+/g, ' ');
  
  return clean;
}

// Calculate word count
function getWordCount(text) {
  return text.trim().split(/\s+/).length;
}

const booksToAdd = [
  {
    filename: 'declaration-of-independence.txt',
    title: 'The Declaration of Independence',
    author: 'Thomas Jefferson',
    description: 'The founding document of American independence, declaring the thirteen American colonies free from British rule.',
    cover_image: '/static/images/covers/declaration-of-independence.svg'
  },
  {
    filename: 'gettysburg-address.txt',
    title: 'The Gettysburg Address', 
    author: 'Abraham Lincoln',
    description: 'Lincoln\'s famous speech delivered during the American Civil War at the dedication of the Soldiers\' National Cemetery.',
    cover_image: '/static/images/covers/gettysburg-address.svg'
  },
  {
    filename: 'origin-of-species.txt',
    title: 'On the Origin of Species',
    author: 'Charles Darwin', 
    description: 'Darwin\'s groundbreaking work on evolutionary biology and natural selection.',
    cover_image: '/static/images/covers/origin-of-species.svg'
  },
  {
    filename: 'critique-of-pure-reason.txt',
    title: 'The Critique of Pure Reason',
    author: 'Immanuel Kant',
    description: 'Kant\'s seminal work in philosophy examining the limits and scope of human knowledge.',
    cover_image: '/static/images/covers/critique-of-pure-reason.svg'
  },
  {
    filename: 'communist-manifesto.txt',
    title: 'The Communist Manifesto',
    author: 'Karl Marx and Friedrich Engels',
    description: 'The foundational political pamphlet outlining the theory and program of communism.',
    cover_image: '/static/images/covers/communist-manifesto.svg'
  },
  {
    filename: 'bhagavad-gita.txt',
    title: 'The Bhagavad Gita',
    author: 'Vyasa',
    description: 'Ancient Hindu scripture that is part of the epic Mahabharata, containing spiritual and philosophical teachings.',
    cover_image: '/static/images/covers/bhagavad-gita.svg'
  }
];

async function addBooksToDatabase() {
  console.log('Adding new books to database...');
  
  for (const bookInfo of booksToAdd) {
    try {
      console.log(`Processing ${bookInfo.title}...`);
      
      // Read the text file
      const textPath = path.join(__dirname, '../txt', bookInfo.filename);
      const rawText = fs.readFileSync(textPath, 'utf8');
      const cleanContent = cleanText(rawText);
      const wordCount = getWordCount(cleanContent);
      
      // Check if book already exists
      const existingBook = await pool.query(
        'SELECT id FROM books WHERE title = $1 AND author = $2',
        [bookInfo.title, bookInfo.author]
      );
      
      if (existingBook.rows.length > 0) {
        console.log(`  ⚠️  ${bookInfo.title} already exists, skipping...`);
        continue;
      }
      
      // Insert into database
      const result = await pool.query(
        `INSERT INTO books (title, author, description, content, cover_image, word_count)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, author`,
        [bookInfo.title, bookInfo.author, bookInfo.description, cleanContent, bookInfo.cover_image, wordCount]
      );
      
      console.log(`  ✓ Added ${bookInfo.title} (ID: ${result.rows[0].id}, Words: ${wordCount})`);
      
    } catch (error) {
      console.error(`  ✗ Error adding ${bookInfo.title}:`, error.message);
    }
  }
  
  console.log('\nFinished adding books to database!');
  process.exit(0);
}

addBooksToDatabase().catch(console.error);


