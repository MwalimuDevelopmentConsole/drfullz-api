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
    
    price: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BasePrice",
      required: true,
    },
   
    status: { type: String, default: "Available" },
    isPaid: { type: String, default: "Not Paid" },
  },
  {
    timestamps: true,
  }
);

const Dob = mongoose.model("Dob", SsSchema);

module.exports = Dob;