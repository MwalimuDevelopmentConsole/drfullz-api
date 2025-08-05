// routes/userRoutes.js
const express = require('express');
const router = express.Router();

// Import controllers
const userController = require('../controllers/userController');

// Import middleware
const { 
  authenticateToken, 
  isAdmin, 
  isClient, 
  isAuthenticated
} = require('../middleware/auth');

// ================================
// ADMIN USER MANAGEMENT ROUTES
// ================================
router.get('/', authenticateToken, isAdmin, userController.getAllUsers);
router.get('/admin/users/statistics', authenticateToken, isAdmin, userController.getUserStatistics);
router.get('/:id', authenticateToken, isAdmin, userController.getUserById);
router.post('/admin/users', authenticateToken, isAdmin, userController.createUser);
router.post('/bot-user', userController.createBotUser);
router.patch('/:id', authenticateToken, isAdmin, userController.updateUser);
router.delete('/admin/users/:id', authenticateToken, isAdmin, userController.deleteUser);
router.post('/:id/add-balance', authenticateToken, isAdmin, userController.addBalance);

// ================================
// USER PROFILE ROUTES (AUTHENTICATED)
// ================================
router.get('/profile/own', authenticateToken, isAuthenticated, userController.getOwnProfile);
router.patch('/update-own/profile', authenticateToken, isAuthenticated, userController.updateOwnProfile);

// ================================
// CLIENT BALANCE ROUTES
// ================================
router.get('/balance', authenticateToken, isClient, userController.getOwnBalance);

module.exports = router;