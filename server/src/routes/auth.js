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
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const router = express_1.default.Router();
// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, password } = req.body;
        // Check if user already exists
        const existingUser = yield (0, User_1.getUserByEmail)(email);
        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists' });
        }
        // Create new user
        const newUser = yield (0, User_1.createUser)({ username, email, password });
        // Create JWT payload
        const payload = {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email
        };
        // Sign token
        jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err)
                throw err;
            res.json({ token });
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        // Check if user exists
        const user = yield (0, User_1.getUserByEmail)(email);
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }
        // Check password
        const isMatch = yield bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }
        // Create JWT payload
        const payload = {
            id: user.id,
            username: user.username,
            email: user.email
        };
        // Sign token
        jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err)
                throw err;
            res.json({ token });
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   GET api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json(req.user);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   POST api/auth/apikey
// @desc    Save or update user's OpenAI API key
// @access  Private
router.post('/apikey', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { apiKey } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ msg: 'User not authenticated' });
        }
        // Check if user already has an API key
        const existingApiKey = yield (0, User_1.getApiKeyByUserId)(userId);
        let result;
        if (existingApiKey) {
            // Update existing API key
            result = yield (0, User_1.updateApiKey)(userId, apiKey);
        }
        else {
            // Save new API key
            result = yield (0, User_1.saveApiKey)({
                user_id: userId,
                api_key: apiKey,
                is_active: true
            });
        }
        res.json({ msg: 'API key saved successfully' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
// @route   GET api/auth/apikey
// @desc    Check if user has an API key
// @access  Private
router.get('/apikey', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ msg: 'User not authenticated' });
        }
        const apiKey = yield (0, User_1.getApiKeyByUserId)(userId);
        if (apiKey) {
            res.json({ hasApiKey: true });
        }
        else {
            res.json({ hasApiKey: false });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
}));
exports.default = router;
