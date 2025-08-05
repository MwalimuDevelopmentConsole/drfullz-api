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
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    country: { type: String, required: true },
    email: { type: String, required: true },
    emailPass: { type: String, required: true },
    faUname: { type: String, required: true },
    faPass: { type: String, required: true },
    backupCode: { type: String, required: true },
    securityQa: { type: String, required: true },
    state: { type: String, required: false },
    gender: { type: String, required: false },
    price: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BasePrice",
      required: true,
    },
    zip: { type: String, required: false },
    dob: { type: Date, required: true },
    address: { type: String, required: true },
    description: { type: String, required: false },
    ssn: { type: String, required: true },
    cs: { type: String, required: false },
    city: { type: String, required: true },
    status: { type: String, default: "Available" },
    isPaid: { type: String, default: "Not Paid" },
    productType: { type: String, default: "ssn" },
    purchaseDate: { type: Date, required: false },
  },
  {
    timestamps: true,
  }
);

const SsnDob = mongoose.model("SsnDob", SsnSchema);

module.exports = SsnDob;
