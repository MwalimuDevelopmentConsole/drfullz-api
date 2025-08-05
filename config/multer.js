// config/multer.js
'use strict';
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Create uploads directories
ensureDirectoryExists('uploads/');
ensureDirectoryExists('uploads/temp/');
ensureDirectoryExists('uploads/csv-documents/');  // For permanent CSV storage
ensureDirectoryExists('storage/');
ensureDirectoryExists('storage/results/');        // For result files

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString().replace(/:/g, '-') + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Middleware for handling multer errors
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
        statusCode: 413
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.',
        statusCode: 400
      });
    }
  }
  
  if (error.message === 'Only CSV files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only CSV files are allowed',
      statusCode: 400
    });
  }
  
  next(error);
};

module.exports = { 
  upload,
  handleMulterError
};