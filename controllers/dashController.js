const SsnDob = require("../models/SsnDob");
const User = require("../models/User");

const getDashStats = async (req, res) => {
  try {
    const [totalBalanceResult, topClients, result] = await Promise.all([
      User.aggregate([
        { $match: { role: "client", isActive: true } },
        {
          $group: {
            _id: null,
            totalBalance: { $sum: "$balance" },
            clientCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            totalBalance: 1,
            clientCount: 1,
          },
        },
      ]),
      User.aggregate([
        { $match: { role: "client", isActive: true } },
        { $sort: { balance: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            username: 1,
            email: 1,
            balance: 1,
          },
        },
      ]),
      SsnDob.aggregate([
        {
          $group: {
            _id: {
              base: "$base",
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.base",
            totalCount: { $sum: "$count" },
            statuses: {
              $push: {
                status: "$_id.status",
                count: "$count",
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            base: "$_id",
            totalCount: 1,
            statuses: 1,
          },
        },
      ]),
    ]);

    res.status(200).json({ totalBalanceResult, topClients, result });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports ={getDashStats}
