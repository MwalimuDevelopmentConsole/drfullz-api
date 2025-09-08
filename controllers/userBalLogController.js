const UserBalLog = require("../models/UserBalLog");
const User = require("../models/User");

// Function to log balance changes
async function logBalanceChange(
  userId,
  amount,
  type,
  description,
  balanceAfter
) {
  const logEntry = new UserBalLog({
    userId,
    amount,
    type,
    description,
    balanceAfter,
  });
  await logEntry.save();
}

const getAllUserBalLogs = async (req, res) => {
  const { userId, page = 1, limit = 10 } = req.query;
  const query = userId ? { userId } : {};
  try {
    const logs = await UserBalLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("userId", "username email");
    const total = await UserBalLog.countDocuments(query);
    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching user balance logs:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  logBalanceChange,
  getAllUserBalLogs
};
