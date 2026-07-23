const SsnDob = require("../models/SsnDob");
const User = require("../models/User");
const Payment = require("../models/Payment");
const DepositRequest = require("../models/DepositRequest");
const moment = require("moment-timezone");

const getDashStats = async (req, res) => {
  try {
    const [totalBalanceResult, topClients, result, unresolvedDepositsCount] = await Promise.all([
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
      DepositRequest.countDocuments({ status: "pending" }),
    ]);

    res.status(200).json({ totalBalanceResult, topClients, result, unresolvedDepositsCount });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

const getSalesData = async (req, res) => {
  try {
    const { filter } = req.query; // 'daily', 'monthly', 'yearly'
    const now = moment().endOf('day');
    
    let matchStage = { status: "Sold" };
    let groupId = {};
    let dateRange = null;

    if (filter === 'daily') {
      // Last 5 days including today
      const startDate = moment().subtract(4, 'days').startOf('day');
      matchStage.purchaseDate = { $gte: startDate.toDate(), $lte: now.toDate() };
      groupId = {
        year: { $year: "$purchaseDate" },
        month: { $month: "$purchaseDate" },
        day: { $dayOfMonth: "$purchaseDate" }
      };
      
      const sales = await SsnDob.aggregate([
        { $match: matchStage },
        { $group: { _id: groupId, sales: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
      ]);
      
      // format and backfill missing days
      const formattedSales = [];
      for (let i = 4; i >= 0; i--) {
        const d = moment().subtract(i, 'days');
        const found = sales.find(s => s._id.day === d.date() && s._id.month === (d.month() + 1) && s._id.year === d.year());
        formattedSales.push({
          name: d.format('MMM DD'),
          sales: found ? found.sales : 0
        });
      }
      return res.status(200).json(formattedSales);

    } else if (filter === 'monthly') {
      // Current year months
      const currentYear = moment().year();
      matchStage.purchaseDate = {
        $gte: moment().startOf('year').toDate(),
        $lte: now.toDate()
      };
      groupId = { month: { $month: "$purchaseDate" } };
      
      const sales = await SsnDob.aggregate([
        { $match: matchStage },
        { $group: { _id: groupId, sales: { $sum: 1 } } },
        { $sort: { "_id.month": 1 } }
      ]);
      
      // format and backfill 12 months
      const formattedSales = [];
      for (let i = 1; i <= 12; i++) {
        const found = sales.find(s => s._id.month === i);
        formattedSales.push({
          name: moment().month(i - 1).format('MMM'),
          sales: found ? found.sales : 0
        });
      }
      return res.status(200).json(formattedSales);

    } else if (filter === 'yearly') {
      // Group by year
      groupId = { year: { $year: "$purchaseDate" } };
      const sales = await SsnDob.aggregate([
        { $match: matchStage },
        { $group: { _id: groupId, sales: { $sum: 1 } } },
        { $sort: { "_id.year": 1 } }
      ]);
      
      const formattedSales = sales.map(s => ({
        name: String(s._id.year),
        sales: s.sales
      }));
      return res.status(200).json(formattedSales);
    }
    
    return res.status(400).json({ message: "Invalid filter parameter" });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong fetching sales data" });
  }
};

module.exports ={getDashStats, getSalesData}
