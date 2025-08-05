const SsnDob = require("../models/SsnDob");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const TxtBuilder = require("../utils/txtBuilder"); // Import the utility
const fs = require("fs");
const path = require("path");

const createSsnDob = async (req, res) => {
  const {
    base,
    firstName,
    lastName,
    sellerId,
    country,
    state,
    city,
    zip,
    dob,
    cs,
    price,
    address,
    ssn,
    description,
  } = req.body;

  if (
    !base ||
    !firstName ||
    !lastName ||
    !country ||
    !sellerId ||
    !state ||
    !city ||
    !zip ||
    !dob ||
    !price ||
    !address ||
    !ssn
  )
    return res.status(400).json({ message: "All fields are required" });

  const ssnObject = {
    base,
    sellerId,
    firstName,
    lastName,
    country,
    state,
    city,
    zip,
    dob,
    cs,
    price,
    address,
    ssn,
    description,
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
    country,
    dob,
    dobMax,
    cs,
    name,
    isBot = "no",
  } = req.query;

  console.log(req.query);

  // Build filter object
  const filters = { status: "Available" };

  // Only add non-empty filters
  if (base) filters.price = base;
  if (city) filters.city = { $regex: city, $options: "i" };
  if (country) filters.country = { $regex: country, $options: "i" };
  if (zip) filters.zip = { $regex: zip, $options: "i" };
  if (state) filters.state = { $regex: state, $options: "i" };
  if (cs) filters.cs = { $regex: cs, $options: "i" };
  if (name) filters.firstName = { $regex: name, $options: "i" };

  // Handle date range if provided
  if (dob && dobMax) {
    const startDate = new Date(`${dob}-01-01`);
    const endDate = new Date(`${dobMax}-12-31`);
    filters.dob = { $gte: startDate, $lte: endDate };
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
            // Required fields
            firstName: 1,
            dobYear: { $year: "$dob" },
            state: 1,
            zip: 1,
            description: 1,

            // Boolean flags for other fields
            lastName: {
              $cond: [{ $ifNull: ["$lastName", false] }, true, false],
            },
            country: { $cond: [{ $ifNull: ["$country", false] }, true, false] },
            email: { $cond: [{ $ifNull: ["$email", false] }, true, false] },
            emailPass: {
              $cond: [{ $ifNull: ["$emailPass", false] }, true, false],
            },
            faUname: { $cond: [{ $ifNull: ["$faUname", false] }, true, false] },
            faPass: { $cond: [{ $ifNull: ["$faPass", false] }, true, false] },
            backupCode: {
              $cond: [{ $ifNull: ["$backupCode", false] }, true, false],
            },
            securityQa: {
              $cond: [{ $ifNull: ["$securityQa", false] }, true, false],
            },
            address: { $cond: [{ $ifNull: ["$address", false] }, true, false] },
            ssn: { $cond: [{ $ifNull: ["$ssn", false] }, true, false] },
            city: { $cond: [{ $ifNull: ["$city", false] }, true, false] },
            gender: { $cond: [{ $ifNull: ["$gender", false] }, true, false] },
            cs: { $cond: [{ $ifNull: ["$cs", false] }, true, false] },

            // Price information
            price: { $arrayElemAt: ["$price", 0] },
            seller: { $arrayElemAt: ["$seller.username", 0] },
          },
        },
        { $sort: { firstName: 1 } },
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
      }
    );

    await SsnDob.updateMany(
      {
        sellerId: sellerId,
        status: { $in: ["Available", "Suspended"] },
      },
      { $set: { status: status } }
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

    console.log(filters);

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
          : query
    );

    const query = buildQuery(filters);

    // Find SSN records
    const ssn = await SsnDob.find(query).limit(number).populate("price").exec();

    console.log(ssn);

    if (!ssn || ssn.length === 0) {
      return res
        .status(404)
        .json({ message: "No SSNs found matching the criteria" });
    }

    // Calculate total cost functionally
    const totalCost = ssn.reduce((acc, item) => acc + item.price.price, 0);

    console.log(totalCost, user.balance);

    // Check balance and process transaction
    if (!user.hasSufficientBalance(totalCost)) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    await user.deductBalance(totalCost);
    await SsnDob.updateMany(
      { _id: { $in: ssn.map((item) => item._id) } },
      { $set: { status: "Sold", buyerId: user._id, purchaseDate: new Date() } }
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
        { new: true }
      );
    }

    // Transform data for better display using functional approach
    const transformedData = TxtBuilder.pipe(
      TxtBuilder.transform((item) => ({
        base: item.price.base,
        firstName: item.firstName,
        lastName: item.lastName,
        country: item.country,
        email: item.email,
        emailPass: item.emailPass,
        faUname: item.faUname,
        faPass: item.faPass,
        backupCode: item.backupCode,
        securityQa: item.securityQa,
        state: item.state,
        gender: item.gender,
        zip: item.zip,
        address: item.address,
        ssn: item.ssn,
        city: item.city,
        dateOfBirth: item.dob,
        description: item.description || "N/A",
        price: item.price.amount,
        purchaseDate: new Date(),
      })),
      TxtBuilder.sort((a, b) => a.lastName.localeCompare(b.lastName))
    )(ssn);

    // Build the text file using functional approach
    const txtContent = TxtBuilder.build(
      {
        title: "SSN Purchase Report",
        metadata: {
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
        },
        includeStats: true,
      },
      transformedData
    );

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
    const timestamp = new Date().toISOString().split("T")[0];
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

    res.json({
      message: "File saved successfully",
      filename,
      path: `/uploads/${filename}`,
      size: fileStats.size,
    });
  } catch (error) {
    console.error("Error checking out SSN by number:", error);
    res.status(500).json({
      message: "Error processing SSN checkout",
      error: error.message,
    });
  }
};

// Helper function for date filtering
const buildDateFilter = (filters) => {
  const dateFilter = {};
  if (filters.dob) dateFilter.$gte = new Date(filters.dob);
  if (filters.dobMax) dateFilter.$lte = new Date(filters.dobMax);
  return dateFilter;
};

module.exports = {
  createSsnDob,
  getAllSsns,
  getAllSsnsBySellerId,
  updateSellerProductStatus,
  checkOutSSNByNumber,
};
