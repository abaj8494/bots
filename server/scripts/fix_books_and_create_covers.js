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

// Create simple SVG cover
function createSVGCover(title, author, filename) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4a6cf7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3a5ce5;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="200" height="300" fill="url(#grad)"/>
  <rect x="10" y="10" width="180" height="280" fill="none" stroke="white" stroke-width="2"/>
  <text x="100" y="50" font-family="serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">
    <tspan x="100" dy="0">${title.length > 20 ? title.substring(0, 20) + '...' : title}</tspan>
  </text>
  <text x="100" y="250" font-family="serif" font-size="12" fill="white" text-anchor="middle">
    <tspan x="100" dy="0">${author.length > 25 ? author.substring(0, 25) + '...' : author}</tspan>
  </text>
</svg>`;
  
  const coverPath = path.join(__dirname, '../covers', filename);
  fs.writeFileSync(coverPath, svg);
  console.log(`Created cover: ${filename}`);
}

async function fixBooksAndCreateCovers() {
  console.log('Fixing books and creating covers...');
  
  try {
    // Fix Gettysburg Address
    console.log('Fixing Gettysburg Address...');
    const gettyburgPath = path.join(__dirname, '../txt/gettysburg-address-fixed.txt');
    const gettyburgText = fs.readFileSync(gettyburgPath, 'utf8');
    const cleanGettyburgText = cleanText(gettyburgText);
    const gettyburgWordCount = getWordCount(cleanGettyburgText);
    
    await pool.query(
      `UPDATE books SET content = $1, word_count = $2 WHERE title = $3`,
      [cleanGettyburgText, gettyburgWordCount, 'The Gettysburg Address']
    );
    console.log(`✓ Fixed Gettysburg Address (${gettyburgWordCount} words)`);
    
    // Create SVG covers for new books
    const newBooks = [
      { title: 'The Declaration of Independence', author: 'Thomas Jefferson', filename: 'declaration-of-independence.svg' },
      { title: 'The Gettysburg Address', author: 'Abraham Lincoln', filename: 'gettysburg-address.svg' },
      { title: 'On the Origin of Species', author: 'Charles Darwin', filename: 'origin-of-species.svg' },
      { title: 'The Critique of Pure Reason', author: 'Immanuel Kant', filename: 'critique-of-pure-reason.svg' },
      { title: 'The Communist Manifesto', author: 'Karl Marx and Friedrich Engels', filename: 'communist-manifesto.svg' },
      { title: 'The Bhagavad Gita', author: 'Vyasa', filename: 'bhagavad-gita.svg' }
    ];
    
    console.log('Creating SVG covers...');
    for (const book of newBooks) {
      createSVGCover(book.title, book.author, book.filename);
    }
    
    console.log('✓ All covers created successfully!');
    
    // Update cover image paths in database
    console.log('Updating cover image paths in database...');
    for (const book of newBooks) {
      await pool.query(
        `UPDATE books SET cover_image = $1 WHERE title = $2`,
        [`/static/images/covers/${book.filename}`, book.title]
      );
    }
    console.log('✓ Cover image paths updated in database!');
    
    console.log('\n✅ All fixes and covers completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixBooksAndCreateCovers();
