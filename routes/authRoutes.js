// routes/authRoutes.js
const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/authController');

// Import middleware
const { 
  authenticateToken, 
  isAuthenticated,
  createRateLimit 
} = require('../middleware/auth');

// Rate limiting for authentication routes
const authRateLimit = createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts, please try again later');

// ================================
// PUBLIC AUTHENTICATION ROUTES
// ================================

// Login
router.post('/login', authController.login);

// Register
router.post('/register', authController.register);

// Refresh access token using refresh token from cookies
router.get('/refresh', authController.refreshToken);

// Logout (clears refresh token cookie)
router.post('/logout', authController.logout);

// Verify token (for debugging or frontend validation)
router.post('/verify', authController.verifyToken);

// ================================
// AUTHENTICATED ROUTES
// ================================

// Change password (requires authentication)
router.post('/change-password', authenticateToken, isAuthenticated, authController.changePassword);

module.exports = router;