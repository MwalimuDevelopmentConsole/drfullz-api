// models/Transaction.js (renamed from Payment.js)
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // NOWPayments fields
  paymentId: {
    type: String,
    required: false,
    sparse: true
  },
  purchaseId: String,
  orderId: String,
  
  // Payment details
  priceAmount: {
    type: Number,
    required: true
  },
  priceCurrency: {
    type: String,
    default: 'usd'
  },
  payAmount: Number,
  payCurrency: String,
  actuallyPaid: {
    type: Number,
    default: 0
  },
  
  // Status tracking
  status: {
    type: String,
    enum: [
      'created',      // Payment created
      'waiting',      // Waiting for payment
      'confirming',   // Being confirmed on blockchain
      'confirmed',    // Confirmed on blockchain
      'sending',      // Funds being sent
      'partially_paid', // Partially paid
      'finished',     // Payment completed
      'failed',       // Payment failed
      'refunded',     // Payment refunded
      'expired'       // Payment expired
    ],
    default: 'created'
  },
  
  // Blockchain details
  payAddress: String,
  payinHash: String,
  payoutHash: String,
  network: String,
  
  // Progress tracking
  amountReceived: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: 0
  },
  isPartialPayment: {
    type: Boolean,
    default: false
  },
  
  // Transaction type
  transactionType: {
    type: String,
    enum: ['crypto_payment', 'admin_deposit', 'admin_deduction', 'system_deduction'],
    default: 'crypto_payment'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  finishedAt: Date,
  
  // Additional info
  description: String,
  ipnCallbackUrl: String,
  
  // Admin operations
  adminOperation: {
    type: String,
    enum: ['deposit', 'deduction', null],
    default: null
  },
  adminNote: String,
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  

});

// Indexes for better performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ paymentId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ transactionType: 1 });
transactionSchema.index({ userId: 1, status: 1 });

// Pre-save middleware to update timestamps
transactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static methods for user transaction queries
transactionSchema.statics.findByUserId = function(userId, filters = {}) {
  return this.find({ userId, ...filters });
};

transactionSchema.statics.findTransactionByPaymentId = function(paymentId) {
  return this.findOne({ paymentId });
};

// Static method to get user transaction statistics
transactionSchema.statics.getUserStatistics = async function(userId) {
  const ObjectId = mongoose.Types.ObjectId;
  
  const stats = await this.aggregate([
    { $match: { userId: new ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalDeposited: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$status', 'finished'] },
                  { $in: ['$transactionType', ['crypto_payment', 'admin_deposit']] }
                ]
              },
              '$actuallyPaid',
              0
            ]
          }
        },
        totalSpent: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$status', 'finished'] },
                  { $in: ['$transactionType', ['admin_deduction', 'system_deduction']] }
                ]
              },
              '$priceAmount',
              0
            ]
          }
        },
        totalRefunded: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'refunded'] },
              '$actuallyPaid',
              0
            ]
          }
        },
        activeTransactions: {
          $sum: {
            $cond: [
              { $in: ['$status', ['waiting', 'confirming', 'confirmed', 'sending', 'partially_paid']] },
              1,
              0
            ]
          }
        },
        completedTransactions: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'finished'] },
              1,
              0
            ]
          }
        },
        failedTransactions: {
          $sum: {
            $cond: [
              { $in: ['$status', ['failed', 'expired']] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalTransactions: 0,
    totalDeposited: 0,
    totalSpent: 0,
    totalRefunded: 0,
    activeTransactions: 0,
    completedTransactions: 0,
    failedTransactions: 0
  };
};

// Static method to get active transactions for a user
transactionSchema.statics.getActiveTransactions = function(userId) {
  return this.find({
    userId,
    status: { $in: ['waiting', 'confirming', 'confirmed', 'sending', 'partially_paid'] }
  });
};

// Static method to get completed transactions for a user
transactionSchema.statics.getCompletedTransactions = function(userId) {
  return this.find({ userId, status: 'finished' });
};

// Static method to get failed transactions for a user
transactionSchema.statics.getFailedTransactions = function(userId) {
  return this.find({ 
    userId, 
    status: { $in: ['failed', 'expired', 'refunded'] } 
  });
};

// Static method to calculate user balance from transactions
transactionSchema.statics.calculateUserBalance = async function(userId) {
  const ObjectId = mongoose.Types.ObjectId;
  
  const result = await this.aggregate([
    { $match: { userId: new ObjectId(userId), status: 'finished' } },
    {
      $group: {
        _id: null,
        totalDeposits: {
          $sum: {
            $cond: [
              { $in: ['$transactionType', ['crypto_payment', 'admin_deposit']] },
              '$actuallyPaid',
              0
            ]
          }
        },
        totalDeductions: {
          $sum: {
            $cond: [
              { $in: ['$transactionType', ['admin_deduction', 'system_deduction']] },
              '$priceAmount',
              0
            ]
          }
        }
      }
    }
  ]);
  
  if (result.length === 0) return 0;
  
  const { totalDeposits, totalDeductions } = result[0];
  return totalDeposits - totalDeductions;
};
module.exports = mongoose.model('Payment', transactionSchema);