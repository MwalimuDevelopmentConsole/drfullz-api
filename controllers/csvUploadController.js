const SsnDob = require("../models/SsnDob");
const csv = require("csv-parser");
const fs = require("fs");
const { default: mongoose } = require("mongoose");
const User = require("../models/User");
const BasePrice = require("../models/BasePrice");

const uploadSsn = async (req, res) => {
  try {
    // Validate file existence
    if (!req.file || Object.keys(req.file).length === 0) {
      return res.status(400).json({ message: "No file was uploaded." });
    }

    const csvfile = req.file;
    console.log(csvfile.mimetype);
    // if (csvfile.mimetype !== "text/csv") {
    //   return res
    //     .status(400)
    //     .json({ message: "Invalid file type. Only CSV files are allowed." });
    // }

    // Validate required fields in request body
    const { sellerId, baseId, userId } = req.body;

    const seller = await User.findById(userId).exec();
    if (!seller) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const baseData = await BasePrice.findById(baseId).exec();
    if (!baseData) {
      return res.status(400).json({ message: "Invalid base ID" });
    }

    const base = baseData.base;
    const price = baseId;



    if (!mongoose.Types.ObjectId.isValid(price)) {
      return res.status(400).json({ message: "Invalid price ID format" });
    }

    const requiredFields = [
      "firstName",
      "lastName",
      "country",
      "email",
      "emailPass",
      "faUname",
      "faPass",
      "backupCode",
      "securityQa",
      "dob",
      "address",
      "ssn",
      "city",
    ];

    const results = [];
    const missingFields = new Set();

    // Process CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvfile.path)
        .pipe(csv())
        .on("data", (data) => {
          const missing = requiredFields.filter((field) => !data[field]);
          if (missing.length > 0) {
            missing.forEach((field) => missingFields.add(field));
          } else {
            results.push(data);
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    if (missingFields.size > 0) {
      return res.status(400).json({
        message: `Missing required fields in CSV: ${Array.from(
          missingFields
        ).join(", ")}`,
      });
    }

    // Map data to Mongoose schema
    const ssnDobs = results.map((result) => ({
      sellerId: userId,
      firstName: result.firstName,
      lastName: result.lastName,
      country: result.country,
      email: result.email,
      emailPass: result.emailPass,
      faUname: result.faUname,
      faPass: result.faPass,
      backupCode: result.backupCode,
      securityQa: result.securityQa,
      state: result.state || null,
      gender: result.gender || null,
      base,
      price: new mongoose.Types.ObjectId(price),
      zip: result.zip || null,
      description: result.description || null,
      dob: new Date(result.dob),
      address: result.address,
      ssn: result.ssn,
      cs: result.cs || null,
      city: result.city,
      status: seller?.productStatus || "Available",
      isPaid: "Not Paid",
      productType: "ssn",
    }));

    // Insert data into MongoDB
    const insertedData = await SsnDob.insertMany(ssnDobs);

    res.status(200).json({
      message: `${insertedData.length} SSNs uploaded successfully`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong, please check your data and try again",
    });
  }
};

module.exports = {
  uploadSsn,
};
