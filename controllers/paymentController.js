// controllers/paymentController.js
const Transaction = require("../models/Payment");
const User = require("../models/User");
const axios = require("axios");

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

// Environment variables
const { NOWPAYMENT_API_KEY, API_DOMAIN } = process.env;

// Pure function to validate payment data
const validatePaymentData = (data) => {
  const errors = [];

  if (!data.amount || data.amount <= 0) {
    errors.push("Valid amount is required");
  }

  if (!data.cryptoCurrency) {
    errors.push("Crypto currency is required");
  }

  if (!data.userId) {
    errors.push("User ID is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Pure function to calculate remaining amount for partial payments
const calculateRemainingAmount = (priceAmount, actuallyPaid) => {
  const remaining = parseFloat(priceAmount) - parseFloat(actuallyPaid || 0);
  return remaining > 0 ? remaining : 0;
};

// ================================
// TRANSACTION MANAGEMENT
// ================================

// Get user transactions with filters
const getUserTransactions = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const {
    status,
    page = 1,
    limit = 10,
    startDate,
    endDate,
    transactionType,
  } = req.query;

  // Check if user exists
  const user = await User.findOne({ username });

  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  const userId = user._id;

  // Build filter
  const filter = { userId };

  if (status) {
    filter.status = status;
  }

  if (transactionType) {
    filter.transactionType = transactionType;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  // Get transactions with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit)
    .populate("adminUserId", "email");

  const total = await Transaction.countDocuments(filter);

  // Get user statistics
  const statistics = await Transaction.getUserStatistics(userId);

  const response = formatResponse(true, {
    balance: user.balance,
    transactions,
    statistics,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      pages: Math.ceil(total / options.limit),
    },
  });

  res.status(response.statusCode).json(response);
});

// Get specific transaction
const getTransaction = asyncHandler(async (req, res) => {
  const { userId, transactionId } = req.params;

  // Verify user exists
  const user = await User.findById(userId);
  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  const transaction = await Transaction.findOne({
    $or: [
      { _id: transactionId, userId },
      { paymentId: transactionId, userId },
    ],
  })
    .populate("adminUserId", "email")
    .populate("lookupHistoryId");

  if (!transaction) {
    const response = formatResponse(false, null, "Transaction not found", 404);
    return res.status(response.statusCode).json(response);
  }

  const response = formatResponse(true, transaction);
  res.status(response.statusCode).json(response);
});

// get all transactions for all users
const getAllTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, transactionType } = req.query;
  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (transactionType) {
    filter.transactionType = transactionType;
  }
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };
  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit)
    .populate("userId", "username email")
    .populate("adminUserId", "email");
  const total = await Transaction.countDocuments(filter);
  const response = formatResponse(true, {
    transactions,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      pages: Math.ceil(total / options.limit),
    },
  });
  res.status(response.statusCode).json(response);
});

// Admin: Add balance manually
const addBalance = asyncHandler(async (req, res) => {
  const { userId, amount, note } = req.body;
  const adminUserId = req.user.id;

  if (!userId || !amount || amount <= 0) {
    const response = formatResponse(
      false,
      null,
      "Valid user ID and amount are required",
      400
    );
    return res.status(response.statusCode).json(response);
  }

  // Get user
  const user = await User.findById(userId);
  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  // Create admin transaction
  const transaction = new Transaction({
    userId,
    paymentId: `ADMIN_DEPOSIT_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)
      .toUpperCase()}`,
    priceAmount: parseFloat(amount),
    priceCurrency: "usd",
    actuallyPaid: parseFloat(amount),
    status: "finished",
    transactionType: "admin_deposit",
    adminOperation: "deposit",
    adminNote: note || "Balance added by admin",
    adminUserId,
    description: `Admin deposit: ${note || "Manual balance addition"}`,
    finishedAt: new Date(),
  });

  await transaction.save();

  // Update user balance
  user.balance += parseFloat(amount);
  await user.save();

  const response = formatResponse(
    true,
    {
      newBalance: user.balance,
      transaction,
    },
    "Balance added successfully"
  );

  res.status(response.statusCode).json(response);
});

// Admin: Deduct balance manually
const deductBalance = asyncHandler(async (req, res) => {
  const { userId, amount, note } = req.body;
  const adminUserId = req.user.id;

  if (!userId || !amount || amount <= 0) {
    const response = formatResponse(
      false,
      null,
      "Valid user ID and amount are required",
      400
    );
    return res.status(response.statusCode).json(response);
  }

  // Get user
  const user = await User.findById(userId);
  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  if (user.balance < amount) {
    const response = formatResponse(false, null, "Insufficient balance", 400);
    return res.status(response.statusCode).json(response);
  }

  // Create admin transaction
  const transaction = new Transaction({
    userId,
    paymentId: `ADMIN_DEDUCT_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)
      .toUpperCase()}`,
    priceAmount: parseFloat(amount),
    priceCurrency: "usd",
    actuallyPaid: parseFloat(amount),
    status: "finished",
    transactionType: "admin_deduction",
    adminOperation: "deduction",
    adminNote: note || "Balance deducted by admin",
    adminUserId,
    description: `Admin deduction: ${note || "Manual balance deduction"}`,
    finishedAt: new Date(),
  });

  await transaction.save();

  // Update user balance
  user.balance -= parseFloat(amount);
  await user.save();

  const response = formatResponse(
    true,
    {
      newBalance: user.balance,
      transaction,
    },
    "Balance deducted successfully"
  );

  res.status(response.statusCode).json(response);
});

// System: Deduct balance for Forest Lookup API
const deductBalanceForLookup = async (
  userId,
  amount,
  lookupHistoryId,
  description
) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.balance < amount) {
      throw new Error("Insufficient balance");
    }

    // Create system transaction
    const transaction = new Transaction({
      userId,
      paymentId: `LOOKUP_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)
        .toUpperCase()}`,
      priceAmount: parseFloat(amount),
      priceCurrency: "usd",
      actuallyPaid: parseFloat(amount),
      status: "finished",
      transactionType: "system_deduction",
      systemOperation: "lookup_deduction",
      lookupHistoryId,
      description: description || "Forest Lookup API charge",
      finishedAt: new Date(),
    });

    await transaction.save();

    // Update user balance
    user.balance -= parseFloat(amount);
    await user.save();

    return { success: true, newBalance: user.balance, transaction };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================================
// NOWPAYMENTS INTEGRATION
// ================================

// Get supported currencies
const getAllCurrencies = asyncHandler(async (req, res) => {
  try {
    const config = {
      method: "get",
      url: "https://api.nowpayments.io/v1/merchant/coins",
      headers: {
        "x-api-key": NOWPAYMENT_API_KEY,
      },
    };

    const response = await axios(config);
    const apiResponse = formatResponse(
      true,
      response.data,
      "Currencies fetched successfully"
    );
    res.status(apiResponse.statusCode).json(apiResponse);
  } catch (error) {
    console.error("Error fetching currencies:", error);
    const response = formatResponse(
      false,
      null,
      "Error fetching currencies",
      400
    );
    res.status(response.statusCode).json(response);
  }
});

// Get minimum payment amount
const getMinimumAmount = asyncHandler(async (req, res) => {
  const { crypto } = req.params;

  if (!crypto) {
    const response = formatResponse(
      false,
      null,
      "Cryptocurrency is required",
      400
    );
    return res.status(response.statusCode).json(response);
  }

  try {
    const config = {
      method: "get",
      url: `https://api.nowpayments.io/v1/min-amount?currency_from=${crypto}&currency_to=usd&fiat_equivalent=usd&is_fee_paid_by_user=False`,
      headers: {
        "x-api-key": NOWPAYMENT_API_KEY,
      },
    };

    const response = await axios(config);
    const apiResponse = formatResponse(
      true,
      response.data,
      "Minimum amount fetched successfully"
    );
    res.status(apiResponse.statusCode).json(apiResponse);
  } catch (error) {
    console.error("Error fetching minimum amount:", error);
    const response = formatResponse(
      false,
      null,
      "Error fetching minimum amount",
      400
    );
    res.status(response.statusCode).json(response);
  }
});

// Create payment request
const createPayment = asyncHandler(async (req, res) => {
  const { amount, cryptoCurrency, username, description } = req.body;

  const user = await User.findOne({ username });

  if (!user) {
    const response = formatResponse(false, null, "Add username to your telegram account to continue", 404);
    return res.status(response.statusCode).json(response);
  }
  const userId = user._id.toString();

  // Validate input
  const validation = validatePaymentData({ amount, cryptoCurrency, userId });

  if (!validation.isValid) {
    const response = formatResponse(
      false,
      null,
      validation.errors.join(", "),
      400
    );
    return res.status(response.statusCode).json(response);
  }

  try {
    // Create transaction record first to get the transaction ID
    const transaction = new Transaction({
      userId,
      priceAmount: parseFloat(amount),
      priceCurrency: "usd",
      payCurrency: cryptoCurrency,
      status: "waiting",
      description: description || `Balance deposit by ${user.username}`,
      remainingAmount: parseFloat(amount),
      transactionType: "crypto_payment",
    });

    await transaction.save();
    const transactionId = transaction._id.toString();

    const paymentData = {
      price_amount: parseFloat(amount),
      price_currency: "usd",
      pay_currency: cryptoCurrency,
      ipn_callback_url: `${API_DOMAIN}/api/payments/nowpayments/webhook`,
      order_id: transactionId, // Use transaction ID as order ID
      order_description: description || `Balance deposit by ${user.username}`,
    };

    const config = {
      method: "post",
      url: "https://api.nowpayments.io/v1/payment",
      headers: {
        "x-api-key": NOWPAYMENT_API_KEY,
        "Content-Type": "application/json",
      },
      data: paymentData,
    };

    const response = await axios(config);

    // Update transaction record with payment provider data
    transaction.paymentId = response.data.payment_id;
    transaction.purchaseId = response.data.purchase_id;
    transaction.orderId = transactionId; // Set orderId to transaction ID
    transaction.payAmount = response.data.pay_amount;
    transaction.payAddress = response.data.pay_address;
    transaction.network = response.data.network;

    await transaction.save();

    const paymentDataResponse = {
      pay_address: response?.data.pay_address,
      price_amount: response?.data.price_amount,
      price_currency: response?.data.price_currency,
      amount_received: response?.data.amount_received,
      pay_currency: response?.data.pay_currency,
      network: response?.data.network,
      order_id: response?.data.order_id,
      pay_amount: response?.data.pay_amount,
    };

    const apiResponse = formatResponse(
      true,
      {
        paymentData: paymentDataResponse,
        transactionId: transaction._id,
        status: "waiting",
      },
      "Payment address generated successfully"
    );

    res.status(apiResponse.statusCode).json(apiResponse);
  } catch (error) {
    console.error("Error creating payment:", error);
    const response = formatResponse(
      false,
      null,
      "Failed to create payment request",
      400
    );
    res.status(response.statusCode).json(response);
  }
});

// NOWPayments webhook handler
const handleNowPaymentsWebhook = asyncHandler(async (req, res) => {
  console.log("NOWPayments webhook received:", req.body);

  try {
    const {
      payment_id,
      payment_status,
      order_id: transactionId, // Now this is the transaction ID
      purchase_id,
      price_amount,
      pay_amount,
      actually_paid,
      pay_currency,
      pay_address,
      payin_hash,
      payout_hash,
      network,
      order_description,
    } = req.body;

    // Find transaction by orderId (which is now the transaction ID)
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      console.error("Transaction not found for orderId:", transactionId);
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "finished") {
      console.log("Transaction already completed:", transactionId);
      return res.status(200).json({ message: "Transaction already completed" });
    }

    const user = await User.findById(transaction.userId);

    if (!user) {
      console.error("User not found for userId:", transaction.userId);
      return res.status(404).json({ message: "User not found" });
    }

    // Update transaction based on status
    transaction.status = payment_status;
    transaction.actuallyPaid = parseFloat(actually_paid || 0);
    transaction.payinHash = payin_hash;
    transaction.payoutHash = payout_hash;
    transaction.updatedAt = new Date();

    // Calculate remaining amount
    transaction.remainingAmount = calculateRemainingAmount(
      transaction.priceAmount,
      actually_paid
    );
    transaction.isPartialPayment =
      transaction.remainingAmount > 0 && parseFloat(actually_paid || 0) > 0;

    // Handle different payment statuses
    switch (payment_status) {
      case "waiting":
        // Payment is waiting for customer to send payment
        break;

      case "confirming":
        // Payment is being confirmed on blockchain
        transaction.amountReceived = parseFloat(actually_paid || 0);
        break;

      case "confirmed":
        // Payment confirmed on blockchain
        transaction.amountReceived = parseFloat(actually_paid || 0);
        break;

      case "sending":
        // Funds being sent to merchant account
        transaction.amountReceived = parseFloat(actually_paid || 0);
        break;

      case "partially_paid":
        // Payment was partially paid
        transaction.amountReceived = parseFloat(actually_paid || 0);
        transaction.isPartialPayment = true;

        console.log(
          `Partial payment received: ${actually_paid}/${price_amount} for transaction ${transactionId}`
        );
        break;

      case "finished":
        // Payment completed successfully
        transaction.finishedAt = new Date();
        transaction.amountReceived = parseFloat(actually_paid || 0);

        // Add balance to user
        const amountToAdd = parseFloat(actually_paid || price_amount);
        user.balance += amountToAdd;
        await user.save();

        console.log(
          `Payment completed: ${amountToAdd} added to user ${transaction.userId} for transaction ${transactionId}`
        );
        break;

      case "failed":
      case "expired":
        // Payment failed or expired
        transaction.amountReceived = 0;
        console.log(
          `Payment ${payment_status} for transaction ${transactionId}`
        );
        break;

      case "refunded":
        // Payment was refunded
        transaction.amountReceived = 0;
        const refundAmount = parseFloat(actually_paid || 0);

        if (refundAmount > 0) {
          // Add refunded amount back to user balance
          user.balance += refundAmount;
          await user.save();
        }

        console.log(
          `Payment refunded: ${refundAmount} for transaction ${transactionId}`
        );
        break;

      default:
        console.log(`Unknown payment status: ${payment_status}`);
    }

    // Save updated transaction
    await transaction.save();

    const response = formatResponse(
      true,
      {
        status: payment_status,
      },
      "Webhook processed successfully"
    );

    res.status(response.statusCode).json(response);
  } catch (error) {
    console.error("Webhook processing error:", error);
    const response = formatResponse(
      false,
      null,
      "Webhook processing failed",
      500
    );
    res.status(response.statusCode).json(response);
  }
});

// Get payment status (for frontend polling)
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { userId, transactionId } = req.params;

  // Verify user exists
  const user = await User.findById(userId);
  if (!user) {
    const response = formatResponse(false, null, "User not found", 404);
    return res.status(response.statusCode).json(response);
  }

  const transaction = await Transaction.findOne({
    $or: [
      { _id: transactionId, userId },
      { paymentId: transactionId, userId },
    ],
  });

  if (!transaction) {
    const response = formatResponse(false, null, "Transaction not found", 404);
    return res.status(response.statusCode).json(response);
  }

  const response = formatResponse(true, {
    status: transaction.status,
    amountReceived: transaction.amountReceived,
    remainingAmount: transaction.remainingAmount,
    isPartialPayment: transaction.isPartialPayment,
    priceAmount: transaction.priceAmount,
    actuallyPaid: transaction.actuallyPaid,
    payAddress: transaction.payAddress,
    payCurrency: transaction.payCurrency,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    finishedAt: transaction.finishedAt,
    userBalance: user.balance,
  });

  res.status(response.statusCode).json(response);
});

module.exports = {
  // Transaction management
  getUserTransactions,
  getTransaction,
  addBalance,
  deductBalance,
  deductBalanceForLookup, // For use by Forest Lookup API
  getAllTransactions,

  // NOWPayments integration
  getAllCurrencies,
  getMinimumAmount,
  createPayment,
  handleNowPaymentsWebhook,
  getPaymentStatus,
};
