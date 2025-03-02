#!/usr/bin/env python3
import os
import re
import glob

# Directory containing the text files
txt_dir = '/var/www/cloud/server/txt'

# Pattern to look for: "***START OF THE PROJECT GUTENBERG..."
start_pattern = re.compile(r'^\*\*\*\s*START OF THE PROJECT GUTENBERG.*$', re.IGNORECASE | re.MULTILINE)

# Process all txt files in the directory
def process_files():
    txt_files = glob.glob(os.path.join(txt_dir, '*.txt'))
    
    print(f"Found {len(txt_files)} text files to process")
    
    for file_path in txt_files:
        process_file(file_path)
    
    print("All files processed successfully!")

# Process a single file
def process_file(file_path):
    filename = os.path.basename(file_path)
    print(f"Processing {filename}...")
    
    # Read the file content
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Find the start pattern
    match = start_pattern.search(content)
    
    if not match:
        print(f"  Warning: Could not find Project Gutenberg header in {filename}")
        return
    
    # Get position of the end of the line containing the start pattern
    end_of_line_pos = match.end()
    
    # Remove everything up to and including the start pattern line
    trimmed_content = content[end_of_line_pos:]
    
    # Remove leading whitespace up to the first non-whitespace character
    trimmed_content = re.sub(r'^\s+', '', trimmed_content, count=1, flags=re.MULTILINE)
    
    # Write the modified content back to the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(trimmed_content)
    
    print(f"  Successfully removed header from {filename}")

if __name__ == "__main__":
    process_files() 