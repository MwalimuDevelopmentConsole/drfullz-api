// routes/root.js
const express = require('express');
const router = express.Router();
const path = require('path');

// Import API routes
const apiRoutes = require('./index');

// Mount API routes under /api
router.use('/api', apiRoutes);

// 
router.get('^/$|/index(.html)?', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

module.exports = router;