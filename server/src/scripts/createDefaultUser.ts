import db from '../config/db';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function createDefaultUser() {
  try {
    const email = process.env.DEFAULT_USER || 'root@abaj.ai';
    const password = process.env.DEFAULT_PASSWORD || 'toor';
    const username = 'admin';
    const isVerified = true;

    console.log(`Creating default user: ${email}`);

    // Check if the user already exists
    const checkQuery = 'SELECT * FROM users WHERE email = $1';
    const existingUser = await db.query(checkQuery, [email]);

    if (existingUser.rows.length > 0) {
      console.log(`Default user ${email} already exists. Skipping creation.`);
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert the default user
    const query = `
      INSERT INTO users (username, email, password, is_verified)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, created_at, is_verified
    `;

    const result = await db.query(query, [username, email, hashedPassword, isVerified]);
    console.log(`Default user created: ${result.rows[0].email}`);
    console.log(`You can now login with email: ${email} and password: ${password}`);

  } catch (error) {
    console.error("Error creating default user:", error);
    process.exit(1);
  }
}

// Run script
createDefaultUser()
  .then(() => {
    console.log("Default user setup completed successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error("Default user setup failed:", err);
    process.exit(1);
  }); 