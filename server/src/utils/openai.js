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
exports.generateChatResponse = exports.getOpenAIClient = void 0;
const openai_1 = __importDefault(require("openai"));
const User_1 = require("../models/User");
const getOpenAIClient = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    let apiKey;
    if (userId) {
        // Try to get user's API key
        const userApiKey = yield (0, User_1.getApiKeyByUserId)(userId);
        if (userApiKey && userApiKey.api_key) {
            apiKey = userApiKey.api_key;
        }
        else {
            // Fall back to default API key
            apiKey = process.env.OPENAI_API_KEY;
        }
    }
    else {
        // Use default API key
        apiKey = process.env.OPENAI_API_KEY;
    }
    return new openai_1.default({
        apiKey,
    });
});
exports.getOpenAIClient = getOpenAIClient;
const generateChatResponse = (message, bookContent, userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const openai = yield (0, exports.getOpenAIClient)(userId);
        const response = yield openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are an AI assistant that specializes in discussing and analyzing literature. 
                   You have deep knowledge about the following book: ${bookContent.substring(0, 1000)}...
                   Please provide thoughtful, insightful responses about this book, its themes, characters, 
                   plot, and literary significance. If asked about content not in this book, politely redirect 
                   the conversation back to this specific work.`
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 500
        });
        return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
    }
    catch (error) {
        console.error('Error generating chat response:', error);
        throw new Error('Failed to generate response from OpenAI');
    }
});
exports.generateChatResponse = generateChatResponse;
