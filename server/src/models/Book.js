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
exports.deleteBook = exports.updateBook = exports.createBook = exports.getBookById = exports.getAllBooks = void 0;
const db_1 = __importDefault(require("../config/db"));
const getAllBooks = () => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
    SELECT id, title, author, description, cover_image, created_at
    FROM books
    ORDER BY title ASC
  `;
    const result = yield db_1.default.query(query);
    return result.rows;
});
exports.getAllBooks = getAllBooks;
const getBookById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
    SELECT id, title, author, description, content, cover_image, created_at
    FROM books
    WHERE id = $1
  `;
    const result = yield db_1.default.query(query, [id]);
    return result.rows[0];
});
exports.getBookById = getBookById;
const createBook = (bookData) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, author, description, content, cover_image } = bookData;
    const query = `
    INSERT INTO books (title, author, description, content, cover_image)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, title, author, description, cover_image, created_at
  `;
    const result = yield db_1.default.query(query, [title, author, description, content, cover_image]);
    return result.rows[0];
});
exports.createBook = createBook;
const updateBook = (id, bookData) => __awaiter(void 0, void 0, void 0, function* () {
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
    const result = yield db_1.default.query(query, [title, author, description, content, cover_image, id]);
    return result.rows[0];
});
exports.updateBook = updateBook;
const deleteBook = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const query = 'DELETE FROM books WHERE id = $1 RETURNING id';
    const result = yield db_1.default.query(query, [id]);
    return result.rows[0];
});
exports.deleteBook = deleteBook;
