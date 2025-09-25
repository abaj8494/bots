import db from '../config/db';

interface Book {
  id?: number;
  title: string;
  author: string;
  description?: string;
  content: string;
  cover_image?: string;
  created_at?: Date;
  word_count?: number;
}

export const getAllBooks = async () => {
  const query = `
    SELECT id, title, author, description, cover_image, created_at, word_count
    FROM books
    ORDER BY title ASC
  `;
  
  const result = await db.query(query);
  return result.rows;
};

export const getBookById = async (id: number) => {
  const query = `
    SELECT id, title, author, description, content, cover_image, created_at, word_count
    FROM books
    WHERE id = $1
  `;
  
  const result = await db.query(query, [id]);
  return result.rows[0];
};

export const createBook = async (bookData: Book) => {
  const { title, author, description, content, cover_image } = bookData;
  
  // Calculate word count
  const word_count = content ? content.trim().split(/\s+/).length : 0;
  
  const query = `
    INSERT INTO books (title, author, description, content, cover_image, word_count)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, title, author, description, cover_image, created_at, word_count
  `;
  
  const result = await db.query(query, [title, author, description, content, cover_image, word_count]);
  return result.rows[0];
};

export const updateBook = async (id: number, bookData: Partial<Book>) => {
  const { title, author, description, content, cover_image } = bookData;
  
  // Calculate word count if content is being updated
  const word_count = content ? content.trim().split(/\s+/).length : undefined;
  
  const query = `
    UPDATE books
    SET title = COALESCE($1, title),
        author = COALESCE($2, author),
        description = COALESCE($3, description),
        content = COALESCE($4, content),
        cover_image = COALESCE($5, cover_image),
        word_count = COALESCE($7, word_count)
    WHERE id = $6
    RETURNING id, title, author, description, cover_image, created_at, word_count
  `;
  
  const result = await db.query(query, [title, author, description, content, cover_image, id, word_count]);
  return result.rows[0];
};

export const deleteBook = async (id: number) => {
  const query = 'DELETE FROM books WHERE id = $1 RETURNING id';
  const result = await db.query(query, [id]);
  return result.rows[0];
}; 