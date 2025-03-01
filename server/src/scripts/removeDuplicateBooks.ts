import db from '../config/db';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function removeDuplicateBooks() {
  try {
    console.log('Starting duplicate book removal process...');
    
    // Find duplicate books based on title
    const findDuplicatesQuery = `
      SELECT LOWER(title) as lower_title, COUNT(*), ARRAY_AGG(id ORDER BY id) as ids, ARRAY_AGG(title) as titles
      FROM books
      GROUP BY LOWER(title)
      HAVING COUNT(*) > 1
    `;
    
    const duplicates = await db.query(findDuplicatesQuery);
    
    if (duplicates.rows.length === 0) {
      console.log('No duplicate books found.');
      return;
    }
    
    console.log(`Found ${duplicates.rows.length} duplicate book titles.`);
    
    // For each set of duplicates, keep the first one and delete the rest
    for (const duplicate of duplicates.rows) {
      const { lower_title, ids, titles } = duplicate;
      const [keepId, ...removeIds] = ids;
      
      console.log(`Processing duplicate title: "${lower_title}"`);
      console.log(`Title variations: ${titles.join(', ')}`);
      console.log(`Keeping book with ID: ${keepId}`);
      console.log(`Removing books with IDs: ${removeIds.join(', ')}`);
      
      // Delete duplicate books
      const deleteQuery = `
        DELETE FROM books
        WHERE id = ANY($1::int[])
      `;
      
      const result = await db.query(deleteQuery, [removeIds]);
      console.log(`Deleted ${result.rowCount} duplicate books for title: "${lower_title}"`);
    }
    
    console.log('Duplicate book removal completed successfully.');
  } catch (error) {
    console.error('Error removing duplicate books:', error);
  }
}

// Run the function
removeDuplicateBooks().catch(console.error); 