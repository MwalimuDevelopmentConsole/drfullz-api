// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "client", "seller", "buyer"],
    default: "client",
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    company: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if user has sufficient balance
userSchema.methods.hasSufficientBalance = function (amount) {
  return this.balance >= parseFloat(amount);
};

// Method to deduct balance
userSchema.methods.deductBalance = function (amount) {
  if (this.hasSufficientBalance(amount)) {
    this.balance -= parseFloat(amount);
    return this.save();
  } else {
    throw new Error("Insufficient balance");
  }
};

module.exports = mongoose.model("User", userSchema);
