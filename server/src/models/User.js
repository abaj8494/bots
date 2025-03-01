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
exports.updateApiKey = exports.getApiKeyByUserId = exports.saveApiKey = exports.getUserById = exports.getUserByEmail = exports.createUser = void 0;
const db_1 = __importDefault(require("../config/db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const createUser = (userData) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, email, password } = userData;
    // Hash password
    const salt = yield bcrypt_1.default.genSalt(10);
    const hashedPassword = yield bcrypt_1.default.hash(password, salt);
    const query = `
    INSERT INTO users (username, email, password)
    VALUES ($1, $2, $3)
    RETURNING id, username, email, created_at
  `;
    const result = yield db_1.default.query(query, [username, email, hashedPassword]);
    return result.rows[0];
});
exports.createUser = createUser;
const getUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = yield db_1.default.query(query, [email]);
    return result.rows[0];
});
exports.getUserByEmail = getUserByEmail;
const getUserById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const query = 'SELECT id, username, email, created_at FROM users WHERE id = $1';
    const result = yield db_1.default.query(query, [id]);
    return result.rows[0];
});
exports.getUserById = getUserById;
const saveApiKey = (userApiKey) => __awaiter(void 0, void 0, void 0, function* () {
    const { user_id, api_key } = userApiKey;
    const query = `
    INSERT INTO user_api_keys (user_id, api_key)
    VALUES ($1, $2)
    RETURNING id, user_id, api_key, is_active, created_at
  `;
    const result = yield db_1.default.query(query, [user_id, api_key]);
    return result.rows[0];
});
exports.saveApiKey = saveApiKey;
const getApiKeyByUserId = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const query = 'SELECT * FROM user_api_keys WHERE user_id = $1 AND is_active = true';
    const result = yield db_1.default.query(query, [userId]);
    return result.rows[0];
});
exports.getApiKeyByUserId = getApiKeyByUserId;
const updateApiKey = (userId, apiKey) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
    UPDATE user_api_keys
    SET api_key = $1
    WHERE user_id = $2
    RETURNING id, user_id, api_key, is_active, created_at
  `;
    const result = yield db_1.default.query(query, [apiKey, userId]);
    return result.rows[0];
});
exports.updateApiKey = updateApiKey;
