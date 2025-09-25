#!/usr/bin/env python3
"""
Script to download and format new books for BookBot
"""
import os
import requests
import re

def clean_text(text):
    """Clean and format text for BookBot"""
    # Remove Project Gutenberg header/footer
    start_markers = [
        "*** START OF THE PROJECT GUTENBERG EBOOK",
        "*** START OF THIS PROJECT GUTENBERG EBOOK",
        "***START OF THE PROJECT GUTENBERG EBOOK"
    ]
    
    end_markers = [
        "*** END OF THE PROJECT GUTENBERG EBOOK",
        "*** END OF THIS PROJECT GUTENBERG EBOOK",
        "***END OF THE PROJECT GUTENBERG EBOOK"
    ]
    
    # Find start
    start_pos = 0
    for marker in start_markers:
        pos = text.find(marker)
        if pos != -1:
            # Find the end of this line
            start_pos = text.find('\n', pos)
            if start_pos != -1:
                start_pos += 1
            break
    
    # Find end
    end_pos = len(text)
    for marker in end_markers:
        pos = text.find(marker)
        if pos != -1:
            end_pos = pos
            break
    
    # Extract clean text
    clean = text[start_pos:end_pos].strip()
    
    # Clean up extra whitespace
    clean = re.sub(r'\n\s*\n\s*\n+', '\n\n', clean)
    clean = re.sub(r'[ \t]+', ' ', clean)
    
    return clean

def download_book(url, filename, title, author, description):
    """Download and save a book"""
    print(f"Downloading {title}...")
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        # Clean the text
        clean_text_content = clean_text(response.text)
        
        # Save to file
        filepath = f"/var/www/bots/server/txt/{filename}"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(clean_text_content)
        
        print(f"✓ Saved {title} to {filename}")
        
        # Return book info for database insertion
        return {
            'title': title,
            'author': author,
            'description': description,
            'content': clean_text_content,
            'filename': filename
        }
        
    except Exception as e:
        print(f"✗ Error downloading {title}: {e}")
        return None

def main():
    books_to_download = [
        {
            'url': 'https://www.gutenberg.org/files/1/1-0.txt',
            'filename': 'declaration-of-independence.txt',
            'title': 'The Declaration of Independence',
            'author': 'Thomas Jefferson',
            'description': 'The founding document of American independence, declaring the thirteen American colonies free from British rule.'
        },
        {
            'url': 'https://www.gutenberg.org/files/1228/1228-0.txt',
            'filename': 'gettysburg-address.txt', 
            'title': 'The Gettysburg Address',
            'author': 'Abraham Lincoln',
            'description': 'Lincoln\'s famous speech delivered during the American Civil War at the dedication of the Soldiers\' National Cemetery.'
        },
        {
            'url': 'https://www.gutenberg.org/files/2009/2009-0.txt',
            'filename': 'origin-of-species.txt',
            'title': 'On the Origin of Species',
            'author': 'Charles Darwin',
            'description': 'Darwin\'s groundbreaking work on evolutionary biology and natural selection.'
        },
        {
            'url': 'https://www.gutenberg.org/files/4280/4280-0.txt',
            'filename': 'critique-of-pure-reason.txt',
            'title': 'The Critique of Pure Reason',
            'author': 'Immanuel Kant',
            'description': 'Kant\'s seminal work in philosophy examining the limits and scope of human knowledge.'
        },
        {
            'url': 'https://www.gutenberg.org/files/61/61-0.txt',
            'filename': 'communist-manifesto.txt',
            'title': 'The Communist Manifesto',
            'author': 'Karl Marx and Friedrich Engels',
            'description': 'The foundational political pamphlet outlining the theory and program of communism.'
        }
    ]
    
    downloaded_books = []
    
    for book_info in books_to_download:
        book_data = download_book(**book_info)
        if book_data:
            downloaded_books.append(book_data)
    
    print(f"\nDownloaded {len(downloaded_books)} books successfully!")
    
    # Note: Harrison Bergeron and Bhagavad Gita need to be handled separately
    # as they may not be on Project Gutenberg or need different sources
    print("\nNote: Harrison Bergeron and Bhagavad Gita need to be added manually")
    print("Harrison Bergeron is a short story by Kurt Vonnegut (may be under copyright)")
    print("Bhagavad Gita should be available from Project Gutenberg")

if __name__ == "__main__":
    main()


