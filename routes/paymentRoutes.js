// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();

// Import controllers
const paymentController = require('../controllers/paymentController');

// Import middleware
const { 
  authenticateToken, 
  isAdmin, 
  isClient, 
  isAuthenticated,
  createRateLimit 
} = require('../middleware/auth');

// Rate limiting
const paymentRateLimit = createRateLimit(60 * 1000, 10, 'Too many payment requests, please try again later');
const webhookRateLimit = createRateLimit(60 * 1000, 100, 'Too many webhook requests');

// ================================
// PUBLIC ROUTES (NOWPayments)
// ================================

// NOWPayments webhook (no authentication required)
router.post('/nowpayments/webhook', webhookRateLimit, paymentController.handleNowPaymentsWebhook);

// Get supported currencies (public)
router.get('/currencies', paymentController.getAllCurrencies);

// Get minimum payment amount (public)
router.get('/minimum/:crypto', paymentController.getMinimumAmount);

router.get('/all-transactions', authenticateToken, isAdmin, paymentController.getAllTransactions);

// ================================
// AUTHENTICATED CLIENT ROUTES
// ================================

// Get user's transaction history and balance
router.get('/user/:username',  paymentController.getUserTransactions);

// Get specific transaction details
router.get('/user/:userId/transaction/:transactionId', authenticateToken, isAuthenticated, paymentController.getTransaction);

// Create new payment request
router.post('/create', paymentController.createPayment);

// Get payment status (for polling)
router.get('/status/:userId/:transactionId', authenticateToken, isAuthenticated, paymentController.getPaymentStatus);

// ================================
// ADMIN ROUTES
// ================================

// Add balance manually (admin only)
router.post('/admin/add-balance', authenticateToken, isAdmin, paymentController.addBalance);

// Deduct balance manually (admin only)
router.post('/admin/deduct-balance', authenticateToken, isAdmin, paymentController.deductBalance);

module.exports = router;