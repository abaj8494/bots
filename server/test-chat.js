/**
 * Test script for chat functionality with full book content and caching
 * 
 * This script tests the following:
 * 1. Sending a chat message with a book
 * 2. Verifying that the response is cached
 * 3. Sending the same message again to test cache hit
 */

const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:5002';
const BOOK_ID = 1; // Using "1984" for testing
const TEST_MESSAGE = 'What is the main theme of this book?';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Helper function to log with colors
const log = {
  info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${colors.bright}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${colors.bright}✗ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${colors.bright}! ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}`)
};

// Helper function to measure execution time
const timeExecution = async (fn, label) => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  log.info(`${label} took ${duration}ms`);
  return { result, duration };
};

// Main test function
async function runTest() {
  try {
    log.section('TESTING CHAT FUNCTIONALITY WITH FULL BOOK CONTENT AND CACHING');
    
    // Step 1: Send first chat message
    log.info('Sending first chat message...');
    const { result: firstResponse, duration: firstDuration } = await timeExecution(
      () => axios.post(`${API_URL}/api/demo-chat`, {
        message: TEST_MESSAGE,
        bookId: BOOK_ID,
        chatHistory: []
      }),
      'First request'
    );
    
    if (firstResponse.data && firstResponse.data.response) {
      log.success('Received response from first request');
      console.log('Response preview:', firstResponse.data.response.substring(0, 100) + '...');
    } else {
      log.error('Failed to get proper response from first request');
      console.log('Response:', firstResponse.data);
      return;
    }
    
    // Step 2: Send the same message again to test caching
    log.info('\nSending the same message again to test cache...');
    const { result: secondResponse, duration: secondDuration } = await timeExecution(
      () => axios.post(`${API_URL}/api/demo-chat`, {
        message: TEST_MESSAGE,
        bookId: BOOK_ID,
        chatHistory: []
      }),
      'Second request (should be cached)'
    );
    
    if (secondResponse.data && secondResponse.data.response) {
      log.success('Received response from second request');
      
      // Check if responses are identical (indicating cache hit)
      const responsesMatch = firstResponse.data.response === secondResponse.data.response;
      if (responsesMatch) {
        log.success('Responses match - cache is working!');
      } else {
        log.warning('Responses do not match - cache might not be working');
        console.log('First response:', firstResponse.data.response.substring(0, 50) + '...');
        console.log('Second response:', secondResponse.data.response.substring(0, 50) + '...');
      }
      
      // Check if second request was faster (indicating cache hit)
      if (secondDuration < firstDuration) {
        log.success(`Second request was ${firstDuration - secondDuration}ms faster - cache is working!`);
      } else {
        log.warning('Second request was not faster - cache might not be working optimally');
      }
    } else {
      log.error('Failed to get proper response from second request');
      console.log('Response:', secondResponse.data);
    }
    
    // Step 3: Send a different message to test non-cached response
    const DIFFERENT_MESSAGE = 'Who is the main character in this book?';
    log.info('\nSending a different message to test non-cached response...');
    const { result: thirdResponse, duration: thirdDuration } = await timeExecution(
      () => axios.post(`${API_URL}/api/demo-chat`, {
        message: DIFFERENT_MESSAGE,
        bookId: BOOK_ID,
        chatHistory: []
      }),
      'Third request (different message)'
    );
    
    if (thirdResponse.data && thirdResponse.data.response) {
      log.success('Received response from third request');
      console.log('Response preview:', thirdResponse.data.response.substring(0, 100) + '...');
      
      // Check if this response is different (as it should be)
      const responsesMatch = firstResponse.data.response === thirdResponse.data.response;
      if (!responsesMatch) {
        log.success('Third response is different from first - as expected');
      } else {
        log.warning('Third response matches first response - unexpected for different questions');
      }
      
      // Check if third request took similar time to first (indicating no cache hit)
      const timeDiff = Math.abs(thirdDuration - firstDuration);
      if (timeDiff < firstDuration * 0.5) {
        log.info(`Third request timing (${thirdDuration}ms) is similar to first request (${firstDuration}ms)`);
      } else {
        log.warning(`Third request timing (${thirdDuration}ms) is significantly different from first request (${firstDuration}ms)`);
      }
    } else {
      log.error('Failed to get proper response from third request');
      console.log('Response:', thirdResponse.data);
    }
    
    log.section('TEST COMPLETED SUCCESSFULLY');
    
  } catch (error) {
    log.error('Test failed with error:');
    if (error.response) {
      console.error('Response error:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error(error.message);
    }
  }
}

// Run the test
runTest(); 