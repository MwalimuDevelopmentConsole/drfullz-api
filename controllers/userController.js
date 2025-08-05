// controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Response formatter
const formatResponse = (success, data, message = null, statusCode = 200) => ({
  success,
  data,
  message,
  statusCode,
});

// Pure function for user validation
const validateUserData = (userData, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || userData.email) {
    if (!userData.email) {
      errors.push("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push("Valid email is required");
    }
  }

  if (!isUpdate || userData.password) {
    if (!userData.password) {
      errors.push("Password is required");
    } else if (userData.password.length < 6) {
      errors.push("Password must be at least 6 characters long");
    }
  }

  if (!isUpdate || userData.role) {
    if (!userData.role) {
      errors.push("Role is required");
    } else if (!["admin", "client"].includes(userData.role)) {
      errors.push("Role must be either admin or client");
    }
  }

  if (userData.balance !== undefined && userData.balance < 0) {
    errors.push("Balance cannot be negative");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Pure function for password validation
const validatePassword = (password) => {
  const errors = [];

  if (!password) {
    errors.push("Password is required");
  } else {
    if (password.length < 6) {
      errors.push("Password must be at least 6 characters long");
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push("Password must contain at least one number");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ================================
// ADMIN USER MANAGEMENT
// ================================

// Get all users with pagination and filters
const getAllUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    role,
    isActive,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build filter object
  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  }

  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: "i" } },
      { "profile.firstName": { $regex: search, $options: "i" } },
      { "profile.lastName": { $regex: search, $options: "i" } },
      { "profile.company": { $regex: search, $options: "i" } },
    ];
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === "desc" ? -1 : 1;

  // Execute query with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const users = await User.find(filter)
    .select("-password")
    .sort(sort)
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit);

  const total = await User.countDocuments(filter);

  const response = formatResponse(true, {
    users,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      pages: Math.ceil(total / options.limit),
    },
  });

  res.status(response.statusCode).json(response);
});

// Get user by ID
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  const userData = {
    ...user.toObject(),
  };

  const response = formatResponse(true, userData);
  res.status(response.statusCode).json(response);
});

// Create new user
const createUser = asyncHandler(async (req, res) => {
  const validation = validateUserData(req.body);

  if (!validation.isValid) {
    const response = formatResponse(
      false,
      null,
      validation.errors.join(", "),
      400
    );
    return res.status(response.statusCode).json(response);
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    email: req.body.email.trim().toLowerCase(),
  });
  if (existingUser) {
    const response = formatResponse(
      false,
      null,
      "User with this email already exists",
      409
    );
    return res.status(response.statusCode).json(response);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(req.body.password, 12);

  // Create user
  const userData = {
    ...req.body,
    password: hashedPassword,
  };

  const user = new User(userData);
  await user.save();

  // Remove password from response
  const userResponse = user.toObject();
  delete userResponse.password;

  const response = formatResponse(
    true,
    userResponse,
    "User created successfully",
    201
  );
  res.status(response.statusCode).json(response);
});

// Update user
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  // Validate update data
  const validation = validateUserData(req.body, true);

  if (!validation.isValid) {
    const response = formatResponse(
      false,
      null,
      validation.errors.join(", "),
      400
    );
    return res.status(response.statusCode).json(response);
  }

  // Check if email is being changed and if it already exists
  if (req.body.email && req.body.email !== user.email) {
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      const response = formatResponse(false, null, "Email already exists", 409);
      return res.status(response.statusCode).json(response);
    }
  }

  // Hash password if provided
  if (req.body.password) {
    req.body.password = await bcrypt.hash(req.body.password, 12);
  }

  // Update user
  Object.assign(user, req.body);
  await user.save();

  // Remove password from response
  const userResponse = user.toObject();
  delete userResponse.password;

  const response = formatResponse(
    true,
    userResponse,
    "User updated successfully"
  );
  res.status(response.statusCode).json(response);
});

// Delete user (soft delete)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  // Prevent deleting the last admin
  if (user.role === "admin") {
    const adminCount = await User.countDocuments({
      role: "admin",
      isActive: true,
    });
    if (adminCount <= 1) {
      const response = formatResponse(
        false,
        null,
        "Cannot delete the last admin user",
        400
      );
      return res.status(response.statusCode).json(response);
    }
  }

  user.isActive = false;
  await user.save();

  const response = formatResponse(true, null, "User deleted successfully");
  res.status(response.statusCode).json(response);
});

// Add balance to user
const addBalance = asyncHandler(async (req, res) => {
  const { amount, description } = req.body;

  if (!amount || amount <= 0) {
    const response = formatResponse(
      false,
      null,
      "Valid amount is required",
      400
    );
    return res.status(response.statusCode).json(response);
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  if (user.role !== "client") {
    const response = formatResponse(
      false,
      null,
      "Balance can only be added to client accounts",
      400
    );
    return res.status(response.statusCode).json(response);
  }

  const oldBalance = user.balance;
  user.balance += parseFloat(amount);
  await user.save();

  const response = formatResponse(
    true,
    {
      userId: user._id,
      oldBalance,
      newBalance: user.balance,
      amountAdded: parseFloat(amount),
      description: description || "Balance added by admin",
    },
    "Balance added successfully"
  );

  res.status(response.statusCode).json(response);
});

// Get user statistics
const getUserStatistics = asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: ["$isActive", 1, 0] } },
        adminUsers: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } },
        clientUsers: { $sum: { $cond: [{ $eq: ["$role", "client"] }, 1, 0] } },
        totalBalance: { $sum: "$balance" },
        averageBalance: { $avg: "$balance" },
      },
    },
  ]);

  // Get recent registrations
  const recentUsers = await User.find({ isActive: true })
    .select("email role createdAt profile.firstName profile.lastName")
    .sort({ createdAt: -1 })
    .limit(5);

  const result = {
    overview: stats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      adminUsers: 0,
      clientUsers: 0,
      totalBalance: 0,
      averageBalance: 0,
    },
    recentUsers,
  };

  const response = formatResponse(true, result);
  res.status(response.statusCode).json(response);
});

// ================================
// USER PROFILE MANAGEMENT
// ================================

// Get own profile
const getOwnProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  const response = formatResponse(true, user);
  res.status(response.statusCode).json(response);
});

// Update own profile
const updateOwnProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  // Only allow updating specific fields
  const allowedFields = [
    "profile.firstName",
    "profile.lastName",
    "profile.phone",
    "profile.company",
  ];
  const updateData = {};

  // Handle nested profile updates
  if (req.body.profile) {
    updateData.profile = { ...user.profile, ...req.body.profile };
  }

  // Update user
  Object.assign(user, updateData);
  await user.save();

  // Remove password from response
  const userResponse = user.toObject();
  delete userResponse.password;

  const response = formatResponse(
    true,
    userResponse,
    "Profile updated successfully"
  );
  res.status(response.statusCode).json(response);
});

// Get own balance (for clients)
const getOwnBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("balance");

  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  if (user.role !== "client") {
    const response = formatResponse(
      false,
      null,
      "Balance is only available for client accounts",
      400
    );
    return res.status(response.statusCode).json(response);
  }

  const response = formatResponse(true, { balance: user.balance });
  res.status(response.statusCode).json(response);
});

const createBotUser = async (req, res) => {
  try {
    const { username } = req.body;
    console.log("Creating bot user with username:", username);
    if (!username) {
      const response = formatResponse(false, null, "Username is required", 400);
      return res.status(response.statusCode).json(response);
    }

    let user = await User.findOne({ username }).exec();
    if (!user) {
      const hashedPassword = await bcrypt.hash(username, 10);
      await User.create({
        username: username,
        password: hashedPassword,
        role: "client",
        isActive: true,
      });
    }

    res.status(200).json({ user, message: "User created successfully" });
  } catch (error) {
    console.error("Error creating bot user:", error);
    const response = formatResponse(false, null, "Failed to create  user", 500);
    res.status(response.statusCode).json(response);
  }
};

module.exports = {
  // Admin user management
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  addBalance,
  getUserStatistics,

  // User profile management
  getOwnProfile,
  updateOwnProfile,
  getOwnBalance,
  createBotUser
};
