-- Add word_count column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- Update existing books with word count based on content length
UPDATE books SET word_count = (
  CASE 
    WHEN content IS NOT NULL AND content != '' 
    THEN array_length(string_to_array(trim(content), ' '), 1)
    ELSE 0
  END
) WHERE word_count = 0;


