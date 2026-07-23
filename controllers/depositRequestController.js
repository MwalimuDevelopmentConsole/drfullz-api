const DepositRequest = require('../models/DepositRequest');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { logBalanceChange } = require('./userBalLogController');

const formatResponse = (success, data, message = null, statusCode = 200) => ({
  success,
  data,
  message,
  statusCode,
});

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create a new deposit request (Support User)
const createRequest = asyncHandler(async (req, res) => {
  const { userId, amount, reason } = req.body;

  if (!userId || !amount || !reason) {
    const response = formatResponse(false, null, "User ID, amount, and reason are required", 400);
    return res.status(response.statusCode).json(response);
  }

  const user = await User.findById(userId);
  if (!user || user.role !== "client") {
    const response = formatResponse(false, null, "Valid client not found", 404);
    return res.status(response.statusCode).json(response);
  }

  const request = new DepositRequest({
    userId,
    supportId: req.user._id,
    amount,
    reason,
    status: 'pending'
  });

  await request.save();

  const response = formatResponse(true, request, "Deposit request created successfully");
  res.status(response.statusCode).json(response);
});

// Get all deposit requests (Admin & Support)
const getRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  
  const filter = {};
  if (status) filter.status = status;

  // Support users only see requests they created, Admins see all
  if (req.user.role === 'user') {
    filter.supportId = req.user._id;
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const requests = await DepositRequest.find(filter)
    .populate('userId', 'username email profile')
    .populate('supportId', 'username email profile')
    .sort({ createdAt: -1 })
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit);

  const total = await DepositRequest.countDocuments(filter);

  const response = formatResponse(true, {
    requests,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      pages: Math.ceil(total / options.limit),
    },
  });

  res.status(response.statusCode).json(response);
});

// Admin updates request status (approve, reject, ask for details)
const updateRequestStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;

  const request = await DepositRequest.findById(id);
  if (!request) {
    const response = formatResponse(false, null, "Request not found", 404);
    return res.status(response.statusCode).json(response);
  }

  if (request.status === 'approved' || request.status === 'rejected') {
    const response = formatResponse(false, null, "Request has already been processed", 400);
    return res.status(response.statusCode).json(response);
  }

  if (!['approved', 'rejected', 'requested_details'].includes(status)) {
    const response = formatResponse(false, null, "Invalid status", 400);
    return res.status(response.statusCode).json(response);
  }

  request.status = status;
  if (adminNotes) {
    request.adminNotes = adminNotes;
  }

  // If approved, add balance to client
  if (status === 'approved') {
    const user = await User.findById(request.userId);
    if (!user) {
      const response = formatResponse(false, null, "Client not found", 404);
      return res.status(response.statusCode).json(response);
    }

    user.balance += request.amount;
    await user.save();

    // Create payment record for history
    const generateTransactionId = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      return `TXN-${timestamp}-${random}`;
    };

    const payment = new Payment({
      userId: user._id,
      priceAmount: request.amount,
      payAmount: request.amount,
      actuallyPaid: request.amount,
      amountReceived: request.amount,
      description: request.reason || "Approved support deposit",
      transactionType: "admin_deposit",
      status: "finished",
      paymentId: generateTransactionId(),
      adminUserId: req.user._id,
      payAddress: "admin",
    });
    await payment.save();

    await logBalanceChange(
      user._id,
      request.amount,
      "credit",
      request.reason || "Approved support deposit",
      user.balance
    );
  }

  await request.save();

  const response = formatResponse(true, request, "Request status updated successfully");
  res.status(response.statusCode).json(response);
});

// Support provides extra details
const provideDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { supportNotes } = req.body;

  const request = await DepositRequest.findById(id);
  if (!request) {
    const response = formatResponse(false, null, "Request not found", 404);
    return res.status(response.statusCode).json(response);
  }

  // Ensure only the support user who created it can provide details
  if (request.supportId.toString() !== req.user._id.toString()) {
    const response = formatResponse(false, null, "Not authorized", 403);
    return res.status(response.statusCode).json(response);
  }

  if (request.status !== 'requested_details') {
    const response = formatResponse(false, null, "Details not requested for this deposit", 400);
    return res.status(response.statusCode).json(response);
  }

  if (!supportNotes) {
    const response = formatResponse(false, null, "Notes are required", 400);
    return res.status(response.statusCode).json(response);
  }

  request.supportNotes = supportNotes;
  request.status = 'pending'; // Change back to pending so admin can review
  
  await request.save();

  const response = formatResponse(true, request, "Details provided successfully");
  res.status(response.statusCode).json(response);
});

// Get pending count (Admin only)
const getPendingCount = asyncHandler(async (req, res) => {
  const count = await DepositRequest.countDocuments({ status: { $in: ['pending', 'requested_details'] } });
  const response = formatResponse(true, { count }, "Count fetched successfully");
  res.status(response.statusCode).json(response);
});

module.exports = {
  createRequest,
  getRequests,
  updateRequestStatus,
  provideDetails,
  getPendingCount
};
