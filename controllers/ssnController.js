const SsnDob = require("../models/SsnDob");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const TxtBuilder = require("../utils/txtBuilder"); // Import the utility
const fs = require("fs");
const path = require("path");
const { logBalanceChange } = require("./userBalLogController");
const { default: mongoose } = require("mongoose");
const Cart = require("../models/Cart");

const createSsnDob = async (req, res) => {
  const {
    base,
    FName,
    LName,
    sellerId,
    State,
    City,
    Zip,
    DOB,
    price,
    Address,
    SSN,
    Email,
    Username,
    Password,
    BackupCode,
    Description,
    EnrollmentDetails,
    EnrollmentStatus,
  } = req.body;

  if (
    !base ||
    !FName ||
    !LName ||
    !sellerId ||
    !City ||
    !DOB ||
    !price ||
    !Address ||
    !SSN ||
    !Email ||
    !Username ||
    !Password ||
    !BackupCode
  )
    return res.status(400).json({ message: "All fields are required" });

  const ssnObject = {
    base,
    sellerId,
    FName,
    LName,
    State,
    City,
    Zip,
    DOB,
    price,
    Address,
    SSN,
    Email,
    Username,
    Password,
    BackupCode,
    Description,
    EnrollmentDetails,
    EnrollmentStatus,
  };

  const ssndob = await SsnDob.create(ssnObject);

  if (ssndob) {
    res.status(201).json({ message: `New ssn file created` });
  } else {
    res.status(400).json({ message: "Invalid ssn data received" });
  }
};

const getAllSsns = asyncHandler(async (req, res) => {
  // Get pagination parameters
  const page = parseInt(req?.query?.page) || 1;
  const perPage = parseInt(req?.query?.perPage) || 20;
  const skip = (page - 1) * perPage;

  // Extract filter parameters
  const {
    base,
    state,
    city,
    zip,
    dob,
    dobMax,
    name,
    isBot = "no",
    enrollmentStatus,
  } = req.query;

  // Build filter object
  const filters = { status: "Available" };

  // Only add non-empty filters
  if (base) filters.price = mongoose.Types.ObjectId(base);
  if (city) filters.City = { $regex: city, $options: "i" };
  if (zip) filters.Zip = { $regex: zip, $options: "i" };
  if (state) filters.State = { $regex: state, $options: "i" };
  if (name) filters.FName = { $regex: name, $options: "i" };
  if (enrollmentStatus)
    filters.EnrollmentStatus = { $regex: enrollmentStatus, $options: "i" };

  // Handle date range if provided
  if (dob && dobMax) {
    const startDate = new Date(`${dob}-01-01`);
    const endDate = new Date(`${dobMax}-12-31`);
    filters.DOB = { $gte: startDate, $lte: endDate };
  }

  try {
    if (isBot === "yes") {
      const ssnCount = await SsnDob.countDocuments(filters).exec();

      console.log(ssnCount);
      return res.status(200).json({
        message: "SSN count fetched successfully",
        count: ssnCount,
      });
    }

    console.log(filters);
    const [ssns, count] = await Promise.all([
      SsnDob.aggregate([
        { $match: filters },
        { $skip: skip }, // Proper pagination implementation
        { $limit: perPage },
        {
          $lookup: {
            from: "baseprices",
            localField: "price",
            foreignField: "_id",
            as: "price",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $project: {
            // Plain fields shown to buyer
            FName: 1,
            dobYear: { $year: "$DOB" },
            State: 1,
            Zip: 1,
            Description: 1,
            EnrollmentStatus: 1,
            EnrollmentDetails: 1,

            // Boolean flags — confirms presence without exposing values
            LName: {
              $cond: [{ $ifNull: ["$LName", false] }, true, false],
            },
            Email: { $cond: [{ $ifNull: ["$Email", false] }, true, false] },
            Username: {
              $cond: [{ $ifNull: ["$Username", false] }, true, false],
            },
            Password: {
              $cond: [{ $ifNull: ["$Password", false] }, true, false],
            },
            BackupCode: {
              $cond: [{ $ifNull: ["$BackupCode", false] }, true, false],
            },
            Address: { $cond: [{ $ifNull: ["$Address", false] }, true, false] },
            SSN: { $cond: [{ $ifNull: ["$SSN", false] }, true, false] },
            City: { $cond: [{ $ifNull: ["$City", false] }, true, false] },
            twoFA: { $cond: [{ $ifNull: ["$twoFA", false] }, true, false] },

            // Price information
            price: { $arrayElemAt: ["$price", 0] },
            seller: { $arrayElemAt: ["$seller.username", 0] },
          },
        },
        { $sort: { FName: 1 } },
      ]).exec(),
      SsnDob.countDocuments(filters),
    ]);

    if (!ssns?.length) {
      return res.status(200).json({
        message: "No records found",
        count: 0,
        ssns: [],
      });
    }

    res.json({
      ssns,
      count,
      currentPage: page,
      totalPages: Math.ceil(count / perPage),
    });
  } catch (error) {
    console.error("Error fetching SSNs:", error);
    res
      .status(500)
      .json({ message: "Error fetching records", error: error.message });
  }
});

const getAllSsnsBySellerId = asyncHandler(async (req, res) => {
  const sellerId = req.params.sellerId;

  if (!sellerId)
    return res.status(400).json({ message: "seller id is required" });

  const page = req?.query?.page || 1;
  const perPage = req?.query?.perPage || 20;
  const skip = (page - 1) * parseInt(perPage);

  const { status, isPaid } = req.query;

  const filters = {
    sellerId: sellerId,
    status: { $regex: status, $options: "i" },
    isPaid: { $regex: isPaid, $options: "i" },
  };

  const [ssns, count] = await Promise.all([
    SsnDob.find(filters)
      .populate("price")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(perPage))
      .lean()
      .exec(),
    SsnDob.countDocuments(filters),
  ]);

  if (!ssns?.length) {
    return res.status(200).json({ message: "No files found" });
  }

  res.json({ ssns, count });
});

const updateSellerProductStatus = async (req, res) => {
  const { sellerId, status } = req.body;
  if (!sellerId || !status) {
    return res
      .status(400)
      .json({ message: "sellerId and status are required" });
  }
  try {
    await User.findOneAndUpdate(
      { jabberId: sellerId },
      {
        productStatus: status,
      },
    );

    await SsnDob.updateMany(
      {
        sellerId: sellerId,
        status: { $in: ["Available", "Suspended"] },
      },
      { $set: { status: status } },
    );

    res.status(200).json({
      message: `Seller product status updated to ${status}`,
    });
  } catch (error) {
    console.error("Error updating seller product status:", error);
    res.status(500).json({
      message: "Error updating seller product status",
      // error: error.message,
    });
  }
};

const checkOutSSNByNumber = async (req, res) => {
  try {
    const { number, username, filters = {} } = req.body;

    if ("base" in filters) {
      filters.price = filters.base;
      delete filters.base;
    }

    const { yearFrom, yearTo } = filters;

    // Add dob filter if yearFrom/yearTo exist
    if (yearFrom || yearTo) {
      filters.dob = {};

      if (yearFrom) {
        filters.dob.$gte = new Date(`${yearFrom}-01-01`);
      }
      if (yearTo) {
        filters.dob.$lte = new Date(`${yearTo}-12-31`);
      }
    }

    // Input validation
    if (!username)
      return res.status(400).json({ message: "Username is required" });
    if (number === undefined || number === null || number === "") {
      return res.status(400).json({ message: "Number is required" });
    }

    if (isNaN(Number(number))) {
      return res.status(400).json({ message: "Invalid number" });
    }
    const ssnCount = await SsnDob.countDocuments(filters).exec();
    if (ssnCount < number) {
      return res.status(400).json({
        message: `Insufficient SSNs available. Requested: ${number}, Available: ${ssnCount}`,
      });
    }

    // Find user
    const user = await User.findOne({ username }).exec();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build query filters functionally
    const buildQuery = TxtBuilder.pipe(
      (filters) => ({ status: "Available", ...filters }),
      (query) =>
        filters.dob || filters.dobMax
          ? { ...query, dob: buildDateFilter(filters) }
          : query,
    );

    const query = buildQuery(filters);

    // Remove them from filters
    // delete filters.yearFrom;
    // delete filters.yearTo;

    // Find SSN records
    const ssn = await SsnDob.find(filters)
      .limit(number)
      .populate("price")
      .exec();

    // console.log(ssn);

    if (!ssn || ssn.length === 0) {
      return res
        .status(404)
        .json({ message: "No SSNs found matching the criteria" });
    }

    const userAccountType = user.accountType || "buyer";

    // Calculate total cost functionally
    const totalCost = ssn.reduce((acc, item) => acc + (userAccountType === "buyer" ? item.price.price : item.price.resellerPrice), 0);


    // Check balance and process transaction
    if (!user.hasSufficientBalance(totalCost)) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    await user.deductBalance(totalCost);
    await SsnDob.updateMany(
      { _id: { $in: ssn.map((item) => item._id) } },
      { $set: { status: "Sold", buyerId: user._id, purchaseDate: new Date() } },
    );

    // 1. Group totals by sellerId
    const totalsBySeller = ssn.reduce((acc, item) => {
      const sellerId = item.sellerId.toString(); // Ensure consistent string key
      const amount = item?.price?.price || 0;

      if (!acc[sellerId]) {
        acc[sellerId] = 0;
      }

      acc[sellerId] += amount;

      return acc;
    }, {});

    for (const [sellerId, total] of Object.entries(totalsBySeller)) {
      await User.findByIdAndUpdate(
        sellerId,
        { $inc: { balance: total } },
        { new: true },
      );
    }

    // Transform data for better display using functional approach

    const transformedData = ssn
      .map((item) => ({
        base: item.price.base,
        FName: item.FName,
        LName: item.LName,
        DOB: item.DOB,
        SSN: item.SSN,
        Address: item.Address,
        City: item.City,
        State: item.State || "N/A",
        Zip: item.Zip || "N/A",
        Email: item.Email,
        Username: item.Username,
        Password: item.Password,
        BackupCode: item.BackupCode,
        Description: item.Description || "N/A",
        EnrollmentDetails: item.EnrollmentDetails || "N/A",
        EnrollmentStatus: item.EnrollmentStatus || "N/A",
        twoFA: item.twoFA || "N/A",
        price: item.price.price,
        purchaseDate: new Date(),
      }))
      .sort((a, b) => a.LName.localeCompare(b.LName));

    // Metadata section
    const metadata = {
      purchasedBy: username,
      totalCost: `$${totalCost.toFixed(2)}`,
      transactionDate: new Date().toLocaleString(),
      filtersApplied:
        Object.keys(filters).length > 0
          ? Object.entries(filters)
              .filter(([_, value]) => value)
              .map(([key, value]) => `${key}: ${value}`)
              .join(", ")
          : "None",
    };

    const metadataSection = [
      "Purchase Report",
      "========================================",
      ...Object.entries(metadata).map(([key, value]) => `${key}: ${value}`),
      "========================================",
    ].join("\n");

    // Build the text file using functional approach
    // Records section
    const recordsSection = transformedData
      .map((item, index) => {
        const recordHeader = `Record ${index + 1}\n${"=".repeat(40)}`;
        const recordBody = Object.entries(item)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
        return `${recordHeader}\n${recordBody}`;
      })
      .join("\n\n");

    // Final text content
    const txtContent = `${metadataSection}\n\n${recordsSection}`;

    console.log(txtContent);
    const uploadsDir = path.join(process.cwd(), "uploads");

    console.log("Attempting to create directory:", uploadsDir);

    // Check if directory exists and create if not
    if (!fs.existsSync(uploadsDir)) {
      console.log("Directory does not exist, creating...");
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log("Directory created successfully");
    }

    // Verify directory was created and is writable
    fs.accessSync(uploadsDir, fs.constants.W_OK);
    console.log("Directory is writable");

    // Generate filename with better sanitization
    const sanitizedUsername = username.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `ssn-purchase-${sanitizedUsername}-${timestamp}.txt`;
    const filePath = path.join(uploadsDir, filename);

    console.log("Writing file to:", filePath);
    console.log("Content length:", txtContent?.length || 0);

    // Validate content before writing
    if (!txtContent || typeof txtContent !== "string") {
      throw new Error("Invalid file content: content is empty or not a string");
    }

    // Write file with explicit encoding
    fs.writeFileSync(filePath, txtContent, { encoding: "utf8", flag: "w" });

    // Verify file was created
    if (!fs.existsSync(filePath)) {
      throw new Error("File was not created successfully");
    }

    const fileStats = fs.statSync(filePath);
    console.log("File created successfully. Size:", fileStats.size, "bytes");

    logBalanceChange(
      user._id,
      totalCost,
      "debit",
      `${process.env.API_DOMAIN}/uploads/${filename}`,
      user.balance,
    ).catch((err) => console.error("Error logging balance change:", err));

    await Cart.updateMany(
      { items: { $in: ssn } }, // Filter: Find any cart containing these items
      { $pull: { items: { $in: ssn } } }, // Action: Remove these items
    );

    res.json({
      message: "File saved successfully",
      filename,
      path: `${process.env.API_DOMAIN}/uploads/${filename}`,
      size: fileStats.size,
    });

    // res.sendFile(path.resolve(`./uploads/${filename}`));
  } catch (error) {
    console.error("Error checking out SSN by number:", error);
    res.status(500).json({
      message: "Error processing SSN checkout",
      error: error.message,
    });
  }
};

const deleteProducts = async (req, res) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res
      .status(400)
      .json({ message: "productIds must be a non-empty array." });
  }

  try {
    const result = await SsnDob.deleteMany({ _id: { $in: productIds } });

    return res.status(200).json({
      message: "Ssn deleted permanently.",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Error deleting orders:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getAllSsnsAdmin = asyncHandler(async (req, res) => {
  // Get pagination parameters
  const page = parseInt(req?.query?.page) || 1;
  const perPage = parseInt(req?.query?.perPage) || 20;
  const skip = (page - 1) * perPage;

  // Extract filter parameters
  const { base, status, sellerId, paid } = req.query;

  // Build filter object
  const filters = {};

  // Only add non-empty filters
  if (base) filters.price = base;
  if (sellerId) filters.sellerId = sellerId;
  if (status) filters.status = status;
  if (paid) filters.isPaid = paid;

  try {
    const [ssns, count] = await Promise.all([
      SsnDob.find(filters)
        .skip(parseInt(skip))
        .limit(parseInt(perPage))
        .populate("price")
        .lean()
        .exec(),
      SsnDob.countDocuments(filters),
    ]);

    if (!ssns?.length) {
      return res.status(200).json({
        message: "No records found",
        count: 0,
        ssns: [],
      });
    }

    res.json({
      ssns,
      count,
      currentPage: page,
      totalPages: Math.ceil(count / perPage),
    });
  } catch (error) {
    console.error("Error fetching SSNs:", error);
    res
      .status(500)
      .json({ message: "Error fetching records", error: error.message });
  }
});

// Helper function for date filtering
const buildDateFilter = (filters) => {
  const dateFilter = {};
  if (filters.yearFrom) dateFilter.$gte = new Date(filters.yearFrom);
  if (filters.yearTo) dateFilter.$lte = new Date(filters.yearTo);
  return dateFilter;
};

module.exports = {
  createSsnDob,
  getAllSsns,
  getAllSsnsBySellerId,
  updateSellerProductStatus,
  checkOutSSNByNumber,
  deleteProducts,
  getAllSsnsAdmin,
};
