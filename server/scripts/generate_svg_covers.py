#!/usr/bin/env python3
import os
import re
import glob
import random
from pathlib import Path

# Directories
txt_dir = '/var/www/cloud/server/txt'
covers_dir = '/var/www/cloud/server/covers'

# Colors for the cover backgrounds (pastel, book-like colors)
COLORS = [
    "#E6B89C", "#F9CDAD", "#F9F2E7", "#ACD8AA", "#6B7A8F",  # Earthy tones
    "#EAD2AC", "#9CAFB7", "#D5E5F2", "#C4D7ED", "#ABC8E2",  # Blues
    "#F8EBEE", "#E3C7CF", "#CBAACB", "#BEBBBB", "#8D6A9F",  # Purples
    "#F1BB87", "#F4E3B2", "#D3DCB2", "#AAC7D8", "#E7D8C9",  # Autumn
    "#92DCE5", "#EEE5E9", "#D64933", "#7D70BA", "#2E5266",  # Mixed
]

def title_to_display_name(filename):
    """Convert filename like 'war-and-peace.txt' to 'War and Peace'"""
    # Remove extension and replace hyphens with spaces
    name = os.path.splitext(filename)[0].replace('-', ' ')
    
    # Special case handling for specific files
    name = name.replace('2', 'Two')  # For "tale-of-2-cities"
    
    # Capitalize words
    words = name.split()
    # Don't capitalize certain words unless they're the first or last word
    minor_words = {'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'of', 'on', 'in', 'to', 'with', 'by'}
    
    for i, word in enumerate(words):
        if i == 0 or i == len(words) - 1 or word.lower() not in minor_words:
            words[i] = word.capitalize()
    
    return ' '.join(words)

def extract_author(file_path):
    """Try to extract the author from the text file content"""
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        # Read first 50 lines which likely contain the title and author
        first_lines = ''.join([f.readline() for _ in range(50)])
    
    # Common patterns for author attribution
    patterns = [
        r'by\s+([A-Z][a-zA-Z\.\s]+)(?:\r|\n)',  # "by Author Name"
        r'(?:written|translated)\s+by\s+([A-Z][a-zA-Z\.\s]+)(?:\r|\n)',  # "written by Author Name"
        r'(?:Author|Written|Translated):\s+([A-Z][a-zA-Z\.\s]+)(?:\r|\n)',  # "Author: Author Name"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, first_lines)
        if match:
            return match.group(1).strip()
    
    return "Unknown Author"  # Default if no author found

def create_svg_cover(txt_file, output_path):
    """Create a basic SVG cover for a book"""
    filename = os.path.basename(txt_file)
    display_title = title_to_display_name(filename)
    author = extract_author(txt_file)
    
    # Choose a random color for the background
    bg_color = random.choice(COLORS)
    
    # Create SVG content
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" width="300" height="450">
  <!-- Background -->
  <rect width="300" height="450" fill="{bg_color}" />
  
  <!-- Border -->
  <rect x="10" y="10" width="280" height="430" fill="none" stroke="#333" stroke-width="2" />
  
  <!-- Title -->
  <text x="150" y="180" font-family="Georgia, serif" font-size="24" font-weight="bold" text-anchor="middle" fill="#333">
    {display_title.split(' ')[:3] and ' '.join(display_title.split(' ')[:3]) or display_title}
  </text>
  
  <!-- Title (continued if long) -->
  {'<text x="150" y="215" font-family="Georgia, serif" font-size="24" font-weight="bold" text-anchor="middle" fill="#333">' + ' '.join(display_title.split(' ')[3:]) + '</text>' if len(display_title.split(' ')) > 3 else ''}
  
  <!-- Author -->
  <text x="150" y="270" font-family="Georgia, serif" font-size="18" text-anchor="middle" fill="#333">
    by
  </text>
  <text x="150" y="300" font-family="Georgia, serif" font-size="20" text-anchor="middle" fill="#333">
    {author}
  </text>
</svg>'''
    
    # Write the SVG file
    with open(output_path, 'w') as f:
        f.write(svg_content)
    
    print(f"Created cover for: {display_title}")

def main():
    # Ensure covers directory exists
    os.makedirs(covers_dir, exist_ok=True)
    
    # Get all text files
    txt_files = glob.glob(os.path.join(txt_dir, "*.txt"))
    
    # Get existing cover files
    existing_covers = [os.path.splitext(os.path.basename(f))[0] 
                      for f in glob.glob(os.path.join(covers_dir, "*.svg"))]
    
    print(f"Found {len(txt_files)} text files and {len(existing_covers)} existing covers")
    
    # Count of new covers created
    created_count = 0
    
    # Create SVG covers for files without one
    for txt_file in txt_files:
        base_name = os.path.splitext(os.path.basename(txt_file))[0]
        
        # Skip if cover already exists
        if base_name in existing_covers:
            print(f"Skipping {base_name} - cover already exists")
            continue
        
        # Create SVG cover
        svg_path = os.path.join(covers_dir, f"{base_name}.svg")
        create_svg_cover(txt_file, svg_path)
        created_count += 1
    
    print(f"Created {created_count} new SVG cover files")

if __name__ == "__main__":
    main() 