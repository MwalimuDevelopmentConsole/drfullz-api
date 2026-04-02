const SsnDob = require("../models/SsnDob");
const csv = require("csv-parser");
const fs = require("fs");
const { default: mongoose } = require("mongoose");
const User = require("../models/User");
const BasePrice = require("../models/BasePrice");

const parseDOBStr = (dateStr) => {
  if (!dateStr) return new Date();
  
  const str = String(dateStr).trim();
  const parts = str.split(/[-/]/);
  
  let newDate;
  let expectedDay = null;

  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length >= 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (month >= 12 && day <= 12) {
         let temp = month + 1;
         month = day - 1;
         day = temp;
      }
    }
    expectedDay = day;
    newDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  } else {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      if (str.toUpperCase().includes("T") || str.toUpperCase().includes("Z")) {
        expectedDay = d.getUTCDate();
        newDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
      } else {
        expectedDay = d.getDate();
        newDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
      }
    } else {
      newDate = new Date();
    }
  }

  if (expectedDay !== null && newDate.getUTCDate() !== expectedDay) {
    throw new Error(`Invalid date encountered: parsing "${str}" shifted the day or the date is invalid (Expected day ${expectedDay}, parsed as ${newDate.getUTCDate()}).`);
  }

  return newDate;
};

const uploadSsn = async (req, res) => {
  try {
    // Validate file existence
    if (!req.file || Object.keys(req.file).length === 0) {
      return res.status(400).json({ message: "No file was uploaded." });
    }

    const csvfile = req.file;
    console.log(csvfile.mimetype);

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

    // Only fields that are required:true in the SsnDob model
    // FName, LName, DOB, SSN, Address, City, Email, Username, Password, BackupCode, Status
    const requiredFields = [
      "FName",
      "LName",
      "DOB",
      "SSN",
      "Address",
      "City",
      "Email",
      "Username",
      "Password",
      "BackupCode",
    ];

    const results = [];
    const missingFields = new Set();

    // Process CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvfile.path)
        .pipe(
          csv({
            mapHeaders: ({ header }) => {
              const lowerHeader = header.toLowerCase().trim();
              const targetFieldsMap = {
                fname: "FName",
                lname: "LName",
                dob: "DOB",
                ssn: "SSN",
                address: "Address",
                city: "City",
                email: "Email",
                username: "Username",
                password: "Password",
                backupcode: "BackupCode",
                state: "State",
                zip: "Zip",
                description: "Description",
                enrollmentdetails: "EnrollmentDetails",
                enrollmentstatus: "EnrollmentStatus",
                "2fa_secret": "2FA_Secret"
              };
              return targetFieldsMap[lowerHeader] || header.trim();
            },
          }),
        )
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
          missingFields,
        ).join(", ")}`,
      });
    }

    // Map CSV columns to SsnDob schema fields
    const ssnDobs = results.map((result) => ({
      sellerId: userId,
      base,
      price: new mongoose.Types.ObjectId(price),
      FName: result.FName,
      LName: result.LName,
      DOB: parseDOBStr(result.DOB),
      SSN: result.SSN,
      Address: result.Address,
      City: result.City,
      Email: result.Email,
      // Required fields
      Username: result.Username,
      Password: result.Password,
      BackupCode: result.BackupCode,
      // Optional fields — required: false in the model
      State: result.State || null,
      Zip: result.Zip || null,
      Description: result.Description || null,
      EnrollmentDetails: result.EnrollmentDetails || null,
      EnrollmentStatus: result.EnrollmentStatus || null,
      isPaid: "Not Paid",
      productType: "ssn",
      twoFA: result["2FA_Secret"] || null,
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
