import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Path to the txt directory
const txtDir = path.join(__dirname, '../../txt');

// Check if the txt directory exists
if (!fs.existsSync(txtDir)) {
  console.error(`Directory not found: ${txtDir}`);
  process.exit(1);
}

// Check if there are any .txt files
const txtFiles = fs.readdirSync(txtDir).filter(file => file.endsWith('.txt'));
if (txtFiles.length === 0) {
  console.error('No .txt files found in the directory');
  process.exit(1);
}

console.log(`Found ${txtFiles.length} .txt files to import`);

// First, run the import script
console.log('Importing books...');
const importProcess = spawn('npm', ['run', 'import-books'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '../../')
});

importProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`Import process exited with code ${code}`);
    process.exit(code || 1);
  }
  
  console.log('Books imported successfully');
  
  // Then start the server
  console.log('Starting server...');
  const serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '../../')
  });
  
  serverProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Server process exited with code ${code}`);
      process.exit(code || 1);
    }
  });
}); 