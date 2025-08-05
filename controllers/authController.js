// controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Response formatter
const formatResponse = (success, data, message = null, statusCode = 200) => ({
  success,
  data,
  message,
  statusCode
});

// Pure function for user validation
const validateUserData = (userData) => {
  const errors = [];
  
  if (!userData.email) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    errors.push('Valid email is required');
  }
  
  if (!userData.password) {
    errors.push('Password is required');
  } else if (userData.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Generate JWT tokens
const generateTokens = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // Short-lived access token
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' } // Long-lived refresh token
  );

  return { accessToken, refreshToken };
};

// ================================
// AUTHENTICATION ENDPOINTS
// ================================

// Login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    const response = formatResponse(false, null, 'Email and password are required', 400);
    return res.status(response.statusCode).json(response);
  }
  
  // Find user
  const user = await User.findOne({ email });
  
  if (!user) {
    const response = formatResponse(false, null, 'Invalid credentials, no user found', 401);
    return res.status(response.statusCode).json(response);
  }

  if (!user.isActive) {
    const response = formatResponse(false, null, 'Account is deactivated', 403);
    return res.status(response.statusCode).json(response);
  }
  
  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    const response = formatResponse(false, null, 'Invalid credentials', 401);
    return res.status(response.statusCode).json(response);
  }
  
  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user);
  
  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true, // Use secure cookies in production
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  // Remove password from response
  const userResponse = user.toObject();
  delete userResponse.password;
  
  const response = formatResponse(true, {
    user: userResponse,
    accessToken
  }, 'Login successful');
  
  res.status(response.statusCode).json(response);
});

// Register
const register = asyncHandler(async (req, res) => {
  const validation = validateUserData(req.body);
  
  if (!validation.isValid) {
    const response = formatResponse(false, null, validation.errors.join(', '), 400);
    return res.status(response.statusCode).json(response);
  }
  
  // Check if user already exists
  const existingUser = await User.findOne({ email: req.body.email });
  if (existingUser) {
    const response = formatResponse(false, null, 'User with this email already exists', 409);
    return res.status(response.statusCode).json(response);
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(req.body.password, 12);
  
  // Create user (default role is client)
  const userData = {
    ...req.body,
    password: hashedPassword,
    role: 'client' // Force client role for registration
  };
  
  const user = new User(userData);
  await user.save();
  
  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user);
  
  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  // Remove password from response
  const userResponse = user.toObject();
  delete userResponse.password;
  
  const response = formatResponse(true, {
    user: userResponse,
    accessToken
  }, 'Registration successful', 201);
  
  res.status(response.statusCode).json(response);
});

// Refresh Token
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  
  if (!refreshToken) {
    const response = formatResponse(false, null, 'Refresh token not found', 401);
    return res.status(response.statusCode).json(response);
  }
  
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      // Clear the invalid refresh token cookie
      res.clearCookie('refreshToken');
      const response = formatResponse(false, null, 'User not found', 401);
      return res.status(response.statusCode).json(response);
    }
    
    if (!user.isActive) {
      // Clear the refresh token cookie for inactive user
      res.clearCookie('refreshToken');
      const response = formatResponse(false, null, 'Account is deactivated', 401);
      return res.status(response.statusCode).json(response);
    }
    
    // Generate new tokens
    const tokens = generateTokens(user);
    
    // Update refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    const response = formatResponse(true, {
      user,
      accessToken: tokens.accessToken
    }, 'Token refreshed successfully');
    
    res.status(response.statusCode).json(response);
    
  } catch (error) {
    // Clear invalid refresh token cookie
    res.clearCookie('refreshToken');
    
    let message = 'Invalid or expired refresh token';
    if (error.name === 'TokenExpiredError') {
      message = 'Refresh token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid refresh token format';
    }
    
    const response = formatResponse(false, null, message, 401);
    res.status(response.statusCode).json(response);
  }
});

// Logout
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  
  if (!refreshToken) {
    const response = formatResponse(false, null, 'No refresh token found', 200);
    return res.status(response.statusCode).json(response);
  }
  
  // Clear refresh token cookie
  res.clearCookie('refreshToken');
  
  const response = formatResponse(true, null, 'Logged out successfully');
  res.status(response.statusCode).json(response);
});

// Verify Token (for debugging or frontend token validation)
const verifyToken = asyncHandler(async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    const response = formatResponse(false, null, 'Access token required', 401);
    return res.status(response.statusCode).json(response);
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      const response = formatResponse(false, null, 'Invalid or inactive user', 401);
      return res.status(response.statusCode).json(response);
    }
    
    const response = formatResponse(true, {
      user,
      tokenValid: true,
      expiresAt: new Date(decoded.exp * 1000)
    }, 'Token is valid');
    
    res.status(response.statusCode).json(response);
    
  } catch (error) {
    let message = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') {
      message = 'Token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid token format';
    }
    
    const response = formatResponse(false, null, message, 401);
    res.status(response.statusCode).json(response);
  }
});

// Change password with current password verification
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    const response = formatResponse(false, null, 'Current and new passwords are required', 400);
    return res.status(response.statusCode).json(response);
  }
  
  if (newPassword.length < 6) {
    const response = formatResponse(false, null, 'New password must be at least 6 characters long', 400);
    return res.status(response.statusCode).json(response);
  }
  
  const user = await User.findById(req.user.id);
  
  if (!user) {
    const response = formatResponse(false, null, 'User not found', 404);
    return res.status(response.statusCode).json(response);
  }
  
  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    const response = formatResponse(false, null, 'Current password is incorrect', 400);
    return res.status(response.statusCode).json(response);
  }
  
  // Hash and update new password
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  
  const response = formatResponse(true, null, 'Password changed successfully');
  res.status(response.statusCode).json(response);
});

module.exports = {
  login,
  register,
  refreshToken,
  logout,
  verifyToken,
  changePassword
};