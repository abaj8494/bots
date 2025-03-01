import db from '../config/db';

interface ChatMessage {
  id?: number;
  user_id: number;
  book_id: number;
  message: string;
  response: string;
  created_at?: Date;
}

export const saveChatMessage = async (chatData: ChatMessage) => {
  const { user_id, book_id, message, response } = chatData;
  
  const query = `
    INSERT INTO chat_messages (user_id, book_id, message, response)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, book_id, message, response, created_at
  `;
  
  const result = await db.query(query, [user_id, book_id, message, response]);
  return result.rows[0];
};

export const getChatHistoryByUserAndBook = async (userId: number, bookId: number) => {
  const query = `
    SELECT id, message, response, created_at
    FROM chat_messages
    WHERE user_id = $1 AND book_id = $2
    ORDER BY created_at ASC
  `;
  
  const result = await db.query(query, [userId, bookId]);
  return result.rows;
};

export const deleteChatHistory = async (userId: number, bookId: number) => {
  const query = 'DELETE FROM chat_messages WHERE user_id = $1 AND book_id = $2 RETURNING id';
  const result = await db.query(query, [userId, bookId]);
  return result.rowCount;
}; 