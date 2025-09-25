#!/usr/bin/env ts-node

/**
 * Setup script for persistent block storage
 * This script initializes the directory structure for storing embeddings
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const STORAGE_BASE_PATH = '/mnt/blockstorage/bookbot';
const SUBDIRS = ['embeddings', 'chunks', 'metadata', 'backups'];

async function setupBlockStorage() {
  console.log('🚀 Setting up persistent block storage...\n');
  
  try {
    // Check if base path exists and is writable
    try {
      await fs.access(STORAGE_BASE_PATH, fs.constants.F_OK | fs.constants.W_OK);
      console.log(`✅ Base storage path exists and is writable: ${STORAGE_BASE_PATH}`);
    } catch (error) {
      console.error(`❌ Error accessing storage path: ${STORAGE_BASE_PATH}`);
      console.error('Please ensure the block storage is mounted and writable.');
      console.error('You may need to run: sudo mkdir -p /mnt/blockstorage/bookbot && sudo chown $USER:$USER /mnt/blockstorage/bookbot');
      process.exit(1);
    }
    
    // Create subdirectories
    for (const subdir of SUBDIRS) {
      const dirPath = path.join(STORAGE_BASE_PATH, subdir);
      
      try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dirPath}`);
      } catch (error) {
        console.error(`❌ Error creating directory ${dirPath}:`, error);
        process.exit(1);
      }
    }
    
    // Create a test file to verify write permissions
    const testFilePath = path.join(STORAGE_BASE_PATH, 'test_write.txt');
    try {
      await fs.writeFile(testFilePath, 'Test write access');
      await fs.unlink(testFilePath);
      console.log('✅ Write permissions verified');
    } catch (error) {
      console.error('❌ Write permission test failed:', error);
      process.exit(1);
    }
    
    // Create a README file with information
    const readmePath = path.join(STORAGE_BASE_PATH, 'README.md');
    const readmeContent = `# BookBot Persistent Storage

This directory contains persistent embeddings and related data for the BookBot application.

## Structure

- \`embeddings/\`: Compressed embedding vectors (.json.gz files)
- \`chunks/\`: Compressed text chunks (.json.gz files)  
- \`metadata/\`: Book metadata and processing information (.json files)
- \`backups/\`: Backup copies of important data

## File Naming Convention

- Embeddings: \`book_{bookId}_embeddings.json.gz\`
- Chunks: \`book_{bookId}_chunks.json.gz\`
- Metadata: \`book_{bookId}_metadata.json\`

## Maintenance

- Files are automatically created during book processing
- Old files can be safely deleted to free up space
- Backup important books before major system updates

Generated on: ${new Date().toISOString()}
`;
    
    await fs.writeFile(readmePath, readmeContent);
    console.log(`✅ Created README: ${readmePath}`);
    
    // Display storage information
    console.log('\n📊 Storage Setup Complete:');
    console.log(`📁 Base Path: ${STORAGE_BASE_PATH}`);
    console.log(`📂 Subdirectories: ${SUBDIRS.join(', ')}`);
    
    // Check disk space
    try {
      const stats = await fs.stat(STORAGE_BASE_PATH);
      console.log(`📈 Storage initialized successfully`);
    } catch (error) {
      console.warn('⚠️  Could not retrieve storage stats:', error);
    }
    
    console.log('\n🎉 Block storage setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run database migration: npm run migrate');
    console.log('2. Start the server: npm run dev');
    console.log('3. Process books - they will now be stored persistently!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupBlockStorage();
}

export { setupBlockStorage };
