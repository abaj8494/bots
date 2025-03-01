import db from '../config/db';

interface Book {
  id?: number;
  title: string;
  author: string;
  description?: string;
  content: string;
  cover_image?: string;
  created_at?: Date;
}

export const getAllBooks = async () => {
  const query = `
    SELECT id, title, author, description, cover_image, created_at
    FROM books
    ORDER BY title ASC
  `;
  
  const result = await db.query(query);
  return result.rows;
};

export const getBookById = async (id: number) => {
  const query = `
    SELECT id, title, author, description, content, cover_image, created_at
    FROM books
    WHERE id = $1
  `;
  
  const result = await db.query(query, [id]);
  return result.rows[0];
};

export const createBook = async (bookData: Book) => {
  const { title, author, description, content, cover_image } = bookData;
  
  const query = `
    INSERT INTO books (title, author, description, content, cover_image)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, title, author, description, cover_image, created_at
  `;
  
  const result = await db.query(query, [title, author, description, content, cover_image]);
  return result.rows[0];
};

export const updateBook = async (id: number, bookData: Partial<Book>) => {
  const { title, author, description, content, cover_image } = bookData;
  
  const query = `
    UPDATE books
    SET title = COALESCE($1, title),
        author = COALESCE($2, author),
        description = COALESCE($3, description),
        content = COALESCE($4, content),
        cover_image = COALESCE($5, cover_image)
    WHERE id = $6
    RETURNING id, title, author, description, cover_image, created_at
  `;
  
  const result = await db.query(query, [title, author, description, content, cover_image, id]);
  return result.rows[0];
};

export const deleteBook = async (id: number) => {
  const query = 'DELETE FROM books WHERE id = $1 RETURNING id';
  const result = await db.query(query, [id]);
  return result.rows[0];
}; 