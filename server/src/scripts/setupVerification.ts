import db from '../config/db';

/**
 * Script to set up verification-related database tables
 */
async function setupVerificationTables() {
  try {
    console.log('Setting up verification tables...');
    
    // Add is_verified column to users table if it doesn't exist
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE
    `);
    console.log('Added is_verified column to users table');
    
    // Create verification_tokens table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, token)
      )
    `);
    console.log('Created verification_tokens table');
    
    console.log('Verification tables setup complete!');
  } catch (error) {
    console.error('Error setting up verification tables:', error);
    process.exit(1);
  }
}

// Run the setup function
setupVerificationTables()
  .then(() => {
    console.log('Setup completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
  }); 