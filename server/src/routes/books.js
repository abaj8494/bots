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
const router = express_1.default.Router();
// @route   GET api/books
// @desc    Get all books
// @access  Public
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const books = yield (0, Book_1.getAllBooks)();
        res.json(books);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   GET api/books/:id
// @desc    Get book by ID
// @access  Public
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const book = yield (0, Book_1.getBookById)(parseInt(req.params.id));
        if (!book) {
            return res.status(404).json({ msg: 'Book not found' });
        }
        res.json(book);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   POST api/books
// @desc    Create a new book (admin only in a real app)
// @access  Private
router.post('/', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, author, description, content, cover_image } = req.body;
        const newBook = yield (0, Book_1.createBook)({
            title,
            author,
            description,
            content,
            cover_image
        });
        res.json(newBook);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   PUT api/books/:id
// @desc    Update a book (admin only in a real app)
// @access  Private
router.put('/:id', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, author, description, content, cover_image } = req.body;
        const bookId = parseInt(req.params.id);
        // Check if book exists
        const book = yield (0, Book_1.getBookById)(bookId);
        if (!book) {
            return res.status(404).json({ msg: 'Book not found' });
        }
        const updatedBook = yield (0, Book_1.updateBook)(bookId, {
            title,
            author,
            description,
            content,
            cover_image
        });
        res.json(updatedBook);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   DELETE api/books/:id
// @desc    Delete a book (admin only in a real app)
// @access  Private
router.delete('/:id', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bookId = parseInt(req.params.id);
        // Check if book exists
        const book = yield (0, Book_1.getBookById)(bookId);
        if (!book) {
            return res.status(404).json({ msg: 'Book not found' });
        }
        yield (0, Book_1.deleteBook)(bookId);
        res.json({ msg: 'Book removed' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
exports.default = router;
