// routes/configRoutes.js
const express = require('express');
const router = express.Router();

// Import controllers
const configController = require('../controllers/configController');

// Import middleware
const { authenticateToken, isAdmin } = require('../middleware/auth');

// ================================
// ADMIN CONFIGURATION ROUTES
// ================================

// Get all configurations
router.get('/', authenticateToken, isAdmin, configController.getAllConfigs);

// Get configurations grouped by categories
router.get('/categories', authenticateToken, isAdmin, configController.getConfigCategories);

// Get specific configuration by key
router.get('/:key', authenticateToken, isAdmin, configController.getConfigByKey);

// Create new configuration
router.post('/', authenticateToken, isAdmin, configController.createConfig);

// Update configuration
router.patch('/:key', authenticateToken, isAdmin, configController.updateConfig);

// Reset configuration to default value
router.post('/:key/reset', authenticateToken, isAdmin, configController.resetConfig);

// Delete configuration
router.delete('/:key', authenticateToken, isAdmin, configController.deleteConfig);

module.exports = router;