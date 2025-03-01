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
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const Book_1 = require("../models/Book");
const Chat_1 = require("../models/Chat");
const openai_1 = require("../utils/openai");
const router = express_1.default.Router();
// @route   POST api/chat/:bookId
// @desc    Send a message to chat with a book
// @access  Private
router.post('/:bookId', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { message } = req.body;
        const bookId = parseInt(req.params.bookId);
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ msg: 'User not authenticated' });
        }
        // Get book content
        const book = yield (0, Book_1.getBookById)(bookId);
        if (!book) {
            return res.status(404).json({ msg: 'Book not found' });
        }
        // Generate response using OpenAI
        const response = yield (0, openai_1.generateChatResponse)(message, book.content, userId);
        // Save chat message to database
        const chatMessage = yield (0, Chat_1.saveChatMessage)({
            user_id: userId,
            book_id: bookId,
            message,
            response
        });
        res.json(chatMessage);
    }
    catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ msg: 'Failed to generate response' });
    }
}));
// @route   GET api/chat/:bookId
// @desc    Get chat history for a book
// @access  Private
router.get('/:bookId', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const bookId = parseInt(req.params.bookId);
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ msg: 'User not authenticated' });
        }
        // Check if book exists
        const book = yield (0, Book_1.getBookById)(bookId);
        if (!book) {
            return res.status(404).json({ msg: 'Book not found' });
        }
        // Get chat history
        const chatHistory = yield (0, Chat_1.getChatHistoryByUserAndBook)(userId, bookId);
        res.json(chatHistory);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   DELETE api/chat/:bookId
// @desc    Delete chat history for a book
// @access  Private
router.delete('/:bookId', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const bookId = parseInt(req.params.bookId);
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ msg: 'User not authenticated' });
        }
        // Delete chat history
        const deletedCount = yield (0, Chat_1.deleteChatHistory)(userId, bookId);
        res.json({ msg: 'Chat history deleted', count: deletedCount });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
exports.default = router;
