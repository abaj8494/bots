"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteChatHistory = exports.getChatHistoryByUserAndBook = exports.saveChatMessage = void 0;
const db_1 = __importDefault(require("../config/db"));
const saveChatMessage = (chatData) => __awaiter(void 0, void 0, void 0, function* () {
    const { user_id, book_id, message, response } = chatData;
    const query = `
    INSERT INTO chat_messages (user_id, book_id, message, response)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, book_id, message, response, created_at
  `;
    const result = yield db_1.default.query(query, [user_id, book_id, message, response]);
    return result.rows[0];
});
exports.saveChatMessage = saveChatMessage;
const getChatHistoryByUserAndBook = (userId, bookId) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
    SELECT id, message, response, created_at
    FROM chat_messages
    WHERE user_id = $1 AND book_id = $2
    ORDER BY created_at ASC
  `;
    const result = yield db_1.default.query(query, [userId, bookId]);
    return result.rows;
});
exports.getChatHistoryByUserAndBook = getChatHistoryByUserAndBook;
const deleteChatHistory = (userId, bookId) => __awaiter(void 0, void 0, void 0, function* () {
    const query = 'DELETE FROM chat_messages WHERE user_id = $1 AND book_id = $2 RETURNING id';
    const result = yield db_1.default.query(query, [userId, bookId]);
    return result.rowCount;
});
exports.deleteChatHistory = deleteChatHistory;
