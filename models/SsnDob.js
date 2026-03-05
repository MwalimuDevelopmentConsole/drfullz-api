const mongoose = require("mongoose");

const SsnSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "User",
    },
    base: { type: String, required: true },
    FName: { type: String, required: true },
    LName: { type: String, required: true },
    country: { type: String, required: false, default: "USA" },
    Email: { type: String, required: true },
    Username: { type: String, required: true },
    Password: { type: String, required: true },
    BackupCode: { type: String, required: true },
    EmailPass: { type: String, required: false },
    faUname: { type: String, required: false },
    faPass: { type: String, required: false },
    securityQa: { type: String, required: false },
    State: { type: String, required: false },
    gender: { type: String, required: false },
    Description: { type: String, required: false },
    EnrollmentStatus: { type: String, required: false },
    EnrollmentDetails: { type: String, required: false },
    price: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BasePrice",
      required: true,
    },
    Zip: { type: String, required: false },
    DOB: { type: Date, required: true },
    Address: { type: String, required: true },
    description: { type: String, required: false },
    SSN: { type: String, required: true },
    cs: { type: String, required: false },
    enrollment: { type: String, required: false },
    fStatus: { type: String, required: false },
    City: { type: String, required: true },
    status: { type: String, required: true, default: "Available" },
    isPaid: { type: String, default: "Not Paid" },
    productType: { type: String, default: "ssn" },
    purchaseDate: { type: Date, required: false },
    purchaseBatchNumber: { type: String, required: false },
    twoFA: { type: String, required: false },
  },
  {
    timestamps: true,
  },
);

const SsnDob = mongoose.model("SsnDob", SsnSchema);

module.exports = SsnDob;
