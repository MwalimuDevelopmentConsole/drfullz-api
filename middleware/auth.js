// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Response formatter
const formatResponse = (success, data, message = null, statusCode = 200) => ({
  success,
  data,
  message,
  statusCode
});

// Authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      const response = formatResponse(false, null, 'Access token required', 401);
      return res.status(response.statusCode).json(response);
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      const response = formatResponse(false, null, 'User not found', 401);
      return res.status(response.statusCode).json(response);
    }
    
    if (!user.isActive) {
      const response = formatResponse(false, null, 'Account is deactivated', 401);
      return res.status(response.statusCode).json(response);
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    let message = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') {
      message = 'Token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid token format';
    }
    
    const response = formatResponse(false, null, message, 401);
    res.status(response.statusCode).json(response);
  }
};

// Optional authentication for refresh token route
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user) {
    const response = formatResponse(false, null, 'Authentication required', 401);
    return res.status(response.statusCode).json(response);
  }
  
  if (req.user.role !== 'admin') {
    const response = formatResponse(false, null, 'Admin access required', 403);
    return res.status(response.statusCode).json(response);
  }
  
  next();
};

// Check if user is client
const isClient = (req, res, next) => {
  if (!req.user) {
    const response = formatResponse(false, null, 'Authentication required', 401);
    return res.status(response.statusCode).json(response);
  }
  
  if (req.user.role !== 'client') {
    const response = formatResponse(false, null, 'Client access required', 403);
    return res.status(response.statusCode).json(response);
  }
  
  next();
};

// Check if user is admin or client (for routes accessible to both)
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    const response = formatResponse(false, null, 'Authentication required', 401);
    return res.status(response.statusCode).json(response);
  }
  
  if (!['admin', 'client'].includes(req.user.role)) {
    const response = formatResponse(false, null, 'Invalid user role', 403);
    return res.status(response.statusCode).json(response);
  }
  
  next();
};

// Rate limiting middleware (can be enhanced with Redis)
const createRateLimit = (windowMs, max, message) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const clientId = req.user?.id || req.ip;
    const now = Date.now();
    
    if (!requests.has(clientId)) {
      requests.set(clientId, []);
    }
    
    const clientRequests = requests.get(clientId);
    
    // Remove requests outside the time window
    const validRequests = clientRequests.filter(time => now - time < windowMs);
    requests.set(clientId, validRequests);
    
    if (validRequests.length >= max) {
      const response = formatResponse(false, null, message || 'Too many requests', 429);
      return res.status(response.statusCode).json(response);
    }
    
    validRequests.push(now);
    next();
  };
};

// Check if user has sufficient balance
const checkBalance = (minimumBalance = 0) => {
  return (req, res, next) => {
    if (!req.user) {
      const response = formatResponse(false, null, 'Authentication required', 401);
      return res.status(response.statusCode).json(response);
    }
    
    if (req.user.balance < minimumBalance) {
      const response = formatResponse(false, null, 'Insufficient balance', 402);
      return res.status(response.statusCode).json(response);
    }
    
    next();
  };
};

module.exports = {
  authenticateToken,
  isAdmin,
  isClient,
  isAuthenticated,
  optionalAuth,
  createRateLimit,
  checkBalance
};
