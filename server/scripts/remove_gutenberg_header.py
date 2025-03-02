#!/usr/bin/env python3
import os
import re
import glob

# Directory containing the text files
txt_dir = '/var/www/cloud/server/txt'

# Pattern to look for: "***START OF THE PROJECT GUTENBERG..."
start_pattern = re.compile(r'^\*\*\*\s*START OF THE PROJECT GUTENBERG.*$', re.IGNORECASE | re.MULTILINE)

# Patterns to identify the footer
footer_patterns = [
    re.compile(r'^\*\*\*\s*END OF THE PROJECT GUTENBERG.*$', re.IGNORECASE | re.MULTILINE),  # End of Project marker
    re.compile(r'^End of (the )?Project Gutenberg.*$', re.IGNORECASE | re.MULTILINE),  # Alternative end marker
    re.compile(r'^\s*Section \d+\.\s+Information about', re.IGNORECASE | re.MULTILINE),  # Section info
    re.compile(r'^The Project Gutenberg Literary Archive Foundation', re.IGNORECASE | re.MULTILINE),  # Foundation info
]

# Process all txt files in the directory
def process_files():
    txt_files = glob.glob(os.path.join(txt_dir, '*.txt'))
    
    print("Found {} text files to process".format(len(txt_files)))
    
    for file_path in txt_files:
        process_file(file_path)
    
    print("All files processed successfully!")

# Process a single file
def process_file(file_path):
    filename = os.path.basename(file_path)
    print("Processing {}...".format(filename))
    
    # Read the file content
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Find the start pattern
    start_match = start_pattern.search(content)
    
    if not start_match:
        print("  Warning: Could not find Project Gutenberg header in {}".format(filename))
        # Even if header is not found, we'll still try to remove the footer
    else:
        # Get position of the end of the line containing the start pattern
        end_of_line_pos = start_match.end()
        
        # Remove everything up to and including the start pattern line
        content = content[end_of_line_pos:]
        
        # Remove leading whitespace up to the first non-whitespace character
        content = re.sub(r'^\s+', '', content, count=1, flags=re.MULTILINE)
        
        print("  Successfully removed header from {}".format(filename))
    
    # Find the footer
    footer_start = None
    for pattern in footer_patterns:
        match = pattern.search(content)
        if match:
            footer_start = match.start()
            break
    
    if footer_start is not None:
        # Trim content to end before the footer
        content = content[:footer_start].strip()
        print("  Successfully removed footer from {}".format(filename))
    else:
        print("  Warning: Could not find Project Gutenberg footer in {}".format(filename))
    
    # Write the modified content back to the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    process_files() 