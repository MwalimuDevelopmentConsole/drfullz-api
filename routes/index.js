// routes/index.js
const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const configRoutes = require("./configRoutes");
const paymentRoutes = require("./paymentRoutes");
const baseRoutes = require("./baseRoutes");
const ssnRoutes = require("./ssnRoutes");
const dashRoutes = require("./dashRoutes");

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Lookup API System is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount route modules
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin/config", configRoutes);
router.use("/payments", paymentRoutes);
router.use("/base", baseRoutes);
router.use("/ssn", ssnRoutes);
router.use("/dash", dashRoutes);

// 404 handler for API routes
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    statusCode: 404,
  });
});

// Global error handler for API routes
router.use((error, req, res, next) => {
  console.error("API Error:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  // Handle specific error types
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      details: error.message,
      statusCode: 400,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
      statusCode: 400,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry",
      statusCode: 409,
    });
  }

  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || "Something went wrong";

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "production" ? "Something went wrong" : message,
    statusCode,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
});

module.exports = router;
